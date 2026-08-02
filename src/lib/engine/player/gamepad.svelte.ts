/**
 * Gamepad input via the W3C Gamepad API — left stick + d-pad for movement.
 * Each client reads exactly one pad: member slot N → Nth connected controller.
 */
import { SvelteMap } from 'svelte/reactivity';
import { playSfx } from '$lib/engine/audio/sfx';

const CONTROLLER_CONNECT_SFX = '/audio/ping.wav';
const GAMEPAD_PREFS_KEY = 'engine:gamepad-prefs';

type GamepadPrefs = {
	deadzone: number;
	invertStickX: boolean;
	invertStickY: boolean;
	invertLookX: boolean;
	invertLookY: boolean;
};

function loadGamepadPrefs(): Partial<GamepadPrefs> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(GAMEPAD_PREFS_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as Partial<GamepadPrefs>;
	} catch {
		return {};
	}
}

function applyGamepadPrefs(target: GamepadState, prefs: Partial<GamepadPrefs>): void {
	if (typeof prefs.deadzone === 'number' && Number.isFinite(prefs.deadzone)) {
		target.deadzone = Math.min(0.35, Math.max(0.05, prefs.deadzone));
	}
	if (typeof prefs.invertStickX === 'boolean') target.invertStickX = prefs.invertStickX;
	if (typeof prefs.invertStickY === 'boolean') target.invertStickY = prefs.invertStickY;
	if (typeof prefs.invertLookX === 'boolean') target.invertLookX = prefs.invertLookX;
	if (typeof prefs.invertLookY === 'boolean') target.invertLookY = prefs.invertLookY;
}

function persistGamepadPrefs(target: GamepadState): void {
	if (typeof localStorage === 'undefined') return;
	const prefs: GamepadPrefs = {
		deadzone: target.deadzone,
		invertStickX: target.invertStickX,
		invertStickY: target.invertStickY,
		invertLookX: target.invertLookX,
		invertLookY: target.invertLookY
	};
	localStorage.setItem(GAMEPAD_PREFS_KEY, JSON.stringify(prefs));
}

export type GamepadLeaseContext = {
	clientId: string;
	roomId: string;
	memberIndex: number;
};

function formatLabel(pad: Gamepad): string {
	const id = pad.id.trim();
	if (!id) return `Gamepad ${pad.index + 1}`;
	const match = id.match(/\(([^)]+)\)/);
	return match?.[1] ?? id.slice(0, 48);
}

function applyDeadzone(value: number, deadzone: number): number {
	return Math.abs(value) < deadzone ? 0 : value;
}

function readPad(
	pad: Gamepad,
	deadzone: number,
	opts: { invertX?: boolean; invertY?: boolean } = {}
): { x: number; z: number } {
	let x = applyDeadzone(pad.axes[0] ?? 0, deadzone);
	let z = applyDeadzone(pad.axes[1] ?? 0, deadzone);
	if (opts.invertX) x = -x;
	// Engine locomotion uses −z as forward (see input.ts). Flip stick Y so push-up
	// matches WASD / d-pad on pads that report +Y when pushed up (common on macOS BT).
	if (opts.invertY) z = -z;

	if (pad.buttons[14]?.pressed) x -= 1;
	if (pad.buttons[15]?.pressed) x += 1;
	if (pad.buttons[12]?.pressed) z -= 1;
	if (pad.buttons[13]?.pressed) z += 1;

	return { x, z };
}

function connectedPadIndices(): number[] {
	if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
	const indices: number[] = [];
	for (const pad of navigator.getGamepads()) {
		if (pad?.connected) indices.push(pad.index);
	}
	return indices.sort((a, b) => a - b);
}

export type GamepadMappingRow = {
	control: string;
	source: string;
};

export function getMappingTable(): GamepadMappingRow[] {
	return [
		{ control: 'Move X', source: 'Left stick axis 0' },
		{ control: 'Move Z', source: 'Left stick axis 1' },
		{ control: 'Look X', source: 'Right stick axis 2' },
		{ control: 'Look Y', source: 'Right stick axis 3' },
		{ control: 'Move left', source: 'D-pad button 14' },
		{ control: 'Move right', source: 'D-pad button 15' },
		{ control: 'Move up', source: 'D-pad button 12' },
		{ control: 'Move down', source: 'D-pad button 13' },
		{ control: 'Jump', source: 'South face button 0 (A / Cross)' },
		{ control: 'Pause / menu', source: 'Start button 9 (+ on Pro Controller)' },
		{ control: 'Reset', source: 'Select button 8 (− on Pro Controller)' },
		{ control: 'Menu up / down', source: 'D-pad 12 / 13 (while paused)' },
		{ control: 'Toggle overlay', source: 'South face button 0 (while paused)' },
		{
			control: 'Pad assignment',
			source: 'Client member slot → Nth connected pad (host = 1st, next peer = 2nd, …)'
		}
	];
}

class GamepadState {
	connected = $state(false);
	label = $state<string | null>(null);
	count = $state(0);
	deadzone = $state(0.14);
	/** Flip left-stick X (strafe) when a pad reports it backwards. */
	invertStickX = $state(false);
	/** Flip left-stick Y (forward/back) so push-up matches −z forward / WASD. */
	invertStickY = $state(false);
	/** Flip right-stick X (yaw) so controller camera orbit matches the play feel. */
	invertLookX = $state(true);
	/** Flip right-stick Y (pitch) so controller camera orbit matches the play feel. */
	invertLookY = $state(false);
	/** Pad index bound to this client, if any. */
	activeIndex = $state<number | null>(null);
	memberSlot = $state(0);

	#pads = new SvelteMap<number, string>();
	#detach: (() => void) | undefined;
	#getLeaseContext: (() => GamepadLeaseContext) | null = null;
	#refreshRaf = 0;

	#assignedSlot(): number {
		const ctx = this.#getLeaseContext?.();
		return Math.max(0, ctx?.memberIndex ?? 0);
	}

	/** Registry order when the browser has not woken pads yet (common after HMR). */
	#registryIndices(): number[] {
		return [...this.#pads.keys()].sort((a, b) => a - b);
	}

	#padAtSlot(slot: number): Gamepad | null {
		if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
		const live = connectedPadIndices();
		const liveIndex = live[slot] ?? null;
		if (liveIndex !== null) return navigator.getGamepads()[liveIndex] ?? null;
		const registryIndex = this.#registryIndices()[slot] ?? null;
		if (registryIndex === null) return null;
		return navigator.getGamepads()[registryIndex] ?? null;
	}

	/** Read the pad assigned to this client without touching reactive UI fields. */
	resolveActivePad(): Gamepad | null {
		return this.#padAtSlot(this.#assignedSlot());
	}

	#ensureAssignmentPoll() {
		if (this.#detach) this.#startAssignmentPoll();
	}

	#startAssignmentPoll() {
		if (typeof window === 'undefined' || this.#refreshRaf) return;
		const poll = () => {
			this.refreshActivePad();
			this.#refreshRaf = requestAnimationFrame(poll);
		};
		this.#refreshRaf = requestAnimationFrame(poll);
	}

	#stopAssignmentPoll() {
		if (!this.#refreshRaf) return;
		cancelAnimationFrame(this.#refreshRaf);
		this.#refreshRaf = 0;
	}

	#sync() {
		this.count = this.#pads.size;
		this.connected = this.count > 0;
		this.refreshActivePad();
		const hot = import.meta.hot;
		if (hot) {
			const data = hot.data as GamepadHmrData;
			data.padRegistry = [...this.#pads.entries()];
		}
	}

	/** Dev — restore pad labels after module swap when listeners were preserved. */
	restorePadRegistry(entries: [number, string][]) {
		for (const [index, label] of entries) {
			if (!this.#pads.has(index)) this.#pads.set(index, label);
		}
		this.#sync();
	}

	savePrefs(): void {
		persistGamepadPrefs(this);
	}

	/** Resolve which pad this tab/client owns and refresh UI metadata. */
	refreshActivePad(): Gamepad | null {
		const slot = this.#assignedSlot();
		this.memberSlot = slot;

		const live = connectedPadIndices();
		const liveIndex = live[slot] ?? null;
		const registryIndex = this.#registryIndices()[slot] ?? null;
		const index = liveIndex ?? registryIndex;
		this.activeIndex = index;
		this.label =
			index !== null ? (this.#pads.get(index) ?? formatLabelFromIndex(index)) : null;

		return index !== null ? (navigator.getGamepads()[index] ?? null) : null;
	}

	#connect(pad: Gamepad, notify?: (message: string) => void, opts?: { announce?: boolean }) {
		if (this.#pads.has(pad.index)) return;
		this.#pads.set(pad.index, formatLabel(pad));
		this.#sync();
		if (opts?.announce !== false) {
			playSfx(CONTROLLER_CONNECT_SFX);
			notify?.(`${formatLabel(pad)} connected`);
		}
	}

	/** Reconcile registry with live pads — never drop asleep slots (post-HMR). */
	#resyncConnectedPads() {
		if (!navigator.getGamepads) return;
		for (const index of [...this.#pads.keys()]) {
			const pad = navigator.getGamepads()[index];
			// Only prune when the browser explicitly reports disconnected.
			if (pad && !pad.connected) {
				this.#pads.delete(index);
				jumpHeld.delete(index);
				pauseHeld.delete(index);
				resetHeld.delete(index);
				menuUpHeld.delete(index);
				menuDownHeld.delete(index);
				menuStickDir.delete(index);
				menuConfirmHeld.delete(index);
				interactHeld.delete(index);
			}
		}
		for (const pad of navigator.getGamepads()) {
			if (pad?.connected) this.#connect(pad, undefined, { announce: false });
		}
		this.#sync();
	}

	#disconnect(pad: Gamepad, notify?: (message: string) => void) {
		const name = this.#pads.get(pad.index);
		if (!this.#pads.delete(pad.index)) return;
		jumpHeld.delete(pad.index);
		pauseHeld.delete(pad.index);
		resetHeld.delete(pad.index);
		menuUpHeld.delete(pad.index);
		menuDownHeld.delete(pad.index);
		menuStickDir.delete(pad.index);
		menuConfirmHeld.delete(pad.index);
		interactHeld.delete(pad.index);
		this.#sync();
		if (name) notify?.(`${name} disconnected`);
	}

	attach(opts?: {
		notify?: (message: string) => void;
		getLeaseContext?: () => GamepadLeaseContext;
	}) {
		if (typeof window === 'undefined') return;

		this.#getLeaseContext = opts?.getLeaseContext ?? null;
		// Presence listening is session-long (edit + play). Idempotent so soft
		// reloads / HMR can call attach without double-binding or re-toasting.
		if (this.#detach) {
			this.#getLeaseContext = opts?.getLeaseContext ?? null;
			this.#resyncConnectedPads();
			this.#ensureAssignmentPoll();
			this.refreshActivePad();
			return;
		}

		const onConnect = (event: GamepadEvent) => this.#connect(event.gamepad, opts?.notify);
		const onDisconnect = (event: GamepadEvent) => this.#disconnect(event.gamepad, opts?.notify);

		window.addEventListener('gamepadconnected', onConnect);
		window.addEventListener('gamepaddisconnected', onDisconnect);

		if (navigator.getGamepads) {
			for (const pad of navigator.getGamepads()) {
				if (pad?.connected) this.#connect(pad, opts?.notify);
			}
		}

		this.#startAssignmentPoll();

		this.#detach = () => {
			this.#stopAssignmentPoll();
			window.removeEventListener('gamepadconnected', onConnect);
			window.removeEventListener('gamepaddisconnected', onDisconnect);
			this.#pads.clear();
			this.#getLeaseContext = null;
			this.activeIndex = null;
			this.label = null;
			this.memberSlot = 0;
			jumpHeld.clear();
			pauseHeld.clear();
			resetHeld.clear();
			menuUpHeld.clear();
			menuDownHeld.clear();
			menuStickDir.clear();
			menuConfirmHeld.clear();
			interactHeld.clear();
			this.#sync();
		};
	}

	detach() {
		this.#detach?.();
		this.#detach = undefined;
	}

	/** Dev HMR — wake asleep pads and refresh lease without tearing down listeners. */
	rehydrateAfterHmr() {
		const hot = import.meta.hot;
		const registry = hot ? (hot.data as GamepadHmrData).padRegistry : undefined;
		if (registry?.length && this.#pads.size === 0) this.restorePadRegistry(registry);

		if (!this.#detach) return;
		this.#resyncConnectedPads();
		this.#ensureAssignmentPoll();
		this.refreshActivePad();
		this.#wakeAsleepPads();
	}

	#wakeAsleepPads(attempt = 0) {
		if (typeof window === 'undefined' || attempt > 120) return;
		this.#resyncConnectedPads();
		if (connectedPadIndices().length > 0) return;
		requestAnimationFrame(() => this.#wakeAsleepPads(attempt + 1));
	}
}

function formatLabelFromIndex(index: number): string {
	const pad = navigator.getGamepads()[index];
	return pad ? formatLabel(pad) : `Gamepad ${index + 1}`;
}

type GamepadHmrData = {
	gamepad?: GamepadState;
	padRegistry?: [number, string][];
	jumpHeld?: SvelteMap<number, boolean>;
	pauseHeld?: SvelteMap<number, boolean>;
	resetHeld?: SvelteMap<number, boolean>;
	menuUpHeld?: SvelteMap<number, boolean>;
	menuDownHeld?: SvelteMap<number, boolean>;
	menuStickDir?: SvelteMap<number, number>;
	menuConfirmHeld?: SvelteMap<number, boolean>;
	interactHeld?: SvelteMap<number, boolean>;
};

function acquireGamepadState(): GamepadState {
	const hot = import.meta.hot;
	const data = (hot?.data ?? {}) as GamepadHmrData;
	const existing = data.gamepad;
	if (existing && typeof existing === 'object' && 'attach' in existing && 'detach' in existing) {
		return existing as GamepadState;
	}
	const state = new GamepadState();
	applyGamepadPrefs(state, loadGamepadPrefs());
	if (data.padRegistry?.length) state.restorePadRegistry(data.padRegistry);
	if (hot) data.gamepad = state;
	return state;
}

function acquireHeldMap(
	key: keyof Pick<
		GamepadHmrData,
		| 'jumpHeld'
		| 'pauseHeld'
		| 'resetHeld'
		| 'menuUpHeld'
		| 'menuDownHeld'
		| 'menuConfirmHeld'
		| 'interactHeld'
	>
): SvelteMap<number, boolean> {
	const hot = import.meta.hot;
	const data = (hot?.data ?? {}) as GamepadHmrData;
	const existing = data[key];
	if (existing) return existing;
	const map = new SvelteMap<number, boolean>();
	if (hot) data[key] = map;
	return map;
}

function acquireStickDirMap(): SvelteMap<number, number> {
	const hot = import.meta.hot;
	const data = (hot?.data ?? {}) as GamepadHmrData;
	if (data.menuStickDir) return data.menuStickDir;
	const map = new SvelteMap<number, number>();
	if (hot) data.menuStickDir = map;
	return map;
}

export const gamepad = acquireGamepadState();

/** Per-pad held state for rising-edge detection on the active pad only. */
const jumpHeld = acquireHeldMap('jumpHeld');
const pauseHeld = acquireHeldMap('pauseHeld');
const resetHeld = acquireHeldMap('resetHeld');
const menuUpHeld = acquireHeldMap('menuUpHeld');
const menuDownHeld = acquireHeldMap('menuDownHeld');
const menuStickDir = acquireStickDirMap();
const menuConfirmHeld = acquireHeldMap('menuConfirmHeld');
const interactHeld = acquireHeldMap('interactHeld');

/** Standard W3C indices: 8 = Select/View (−), 9 = Start/Menu (+). */
const GAMEPAD_SELECT = 8;
const GAMEPAD_START = 9;
const GAMEPAD_DPAD_UP = 12;
const GAMEPAD_DPAD_DOWN = 13;
const GAMEPAD_SOUTH = 0;
/** West face (□ / X / Y depending on layout) — interact / use. */
const GAMEPAD_WEST = 2;
/** Left-stick deflection that counts as a menu step (rising-edge across threshold). */
const MENU_STICK_THRESHOLD = 0.55;

function localPad(): Gamepad | null {
	return gamepad.resolveActivePad();
}

function risingEdge(
	pad: Gamepad,
	index: number,
	held: Map<number, boolean>
): boolean {
	const pressed = pad.buttons[index]?.pressed ?? false;
	const was = held.get(pad.index) ?? false;
	held.set(pad.index, pressed);
	return pressed && !was;
}

/** True once on the frame Start / + is pressed on this client's pad. */
export function gamepadPausePressed(): boolean {
	const pad = localPad();
	if (!pad) return false;
	return risingEdge(pad, GAMEPAD_START, pauseHeld);
}

/** True once on the frame Select / − is pressed on this client's pad. */
export function gamepadResetPressed(): boolean {
	const pad = localPad();
	if (!pad) return false;
	return risingEdge(pad, GAMEPAD_SELECT, resetHeld);
}

/** Prime rising-edge button state when entering play so held menu buttons don't fire immediately. */
export function primePlayMenuButtons(): void {
	const pad = localPad();
	if (!pad) return;
	pauseHeld.set(pad.index, pad.buttons[GAMEPAD_START]?.pressed ?? false);
	resetHeld.set(pad.index, pad.buttons[GAMEPAD_SELECT]?.pressed ?? false);
	jumpHeld.set(pad.index, pad.buttons[GAMEPAD_SOUTH]?.pressed ?? false);
	menuUpHeld.set(pad.index, pad.buttons[GAMEPAD_DPAD_UP]?.pressed ?? false);
	menuDownHeld.set(pad.index, pad.buttons[GAMEPAD_DPAD_DOWN]?.pressed ?? false);
	const y = pad.axes[1] ?? 0;
	menuStickDir.set(
		pad.index,
		y < -MENU_STICK_THRESHOLD ? -1 : y > MENU_STICK_THRESHOLD ? 1 : 0
	);
	menuConfirmHeld.set(pad.index, pad.buttons[GAMEPAD_SOUTH]?.pressed ?? false);
	interactHeld.set(pad.index, pad.buttons[GAMEPAD_WEST]?.pressed ?? false);
}

/**
 * Pause-menu navigation delta for this frame (−1 up, +1 down, 0 none).
 * D-pad and left-stick Y share one rising-edge so a single poll can't double-fire.
 */
export function gamepadMenuNavDelta(): -1 | 0 | 1 {
	const pad = localPad();
	if (!pad) return 0;

	if (risingEdge(pad, GAMEPAD_DPAD_UP, menuUpHeld)) return -1;
	if (risingEdge(pad, GAMEPAD_DPAD_DOWN, menuDownHeld)) return 1;

	const y = pad.axes[1] ?? 0;
	const stickDir = (y < -MENU_STICK_THRESHOLD ? -1 : y > MENU_STICK_THRESHOLD ? 1 : 0) as
		| -1
		| 0
		| 1;
	const was = (menuStickDir.get(pad.index) ?? 0) as -1 | 0 | 1;
	menuStickDir.set(pad.index, stickDir);
	if (stickDir !== 0 && stickDir !== was) return stickDir;
	return 0;
}

/** South face — confirm / toggle selected overlay while paused. */
export function gamepadMenuConfirmPressed(): boolean {
	const pad = localPad();
	if (!pad) return false;
	return risingEdge(pad, GAMEPAD_SOUTH, menuConfirmHeld);
}

/** West face — interact / use (room portals, etc.). South stays jump. */
export function gamepadInteractPressed(): boolean {
	const pad = localPad();
	if (!pad) return false;
	return risingEdge(pad, GAMEPAD_WEST, interactHeld);
}

export type PadFamily = 'switch' | 'playstation' | 'xbox' | 'unknown';

const TEST_PAD_FAMILY_KEY = '__playlabTestPadFamily';

let testPadFamilyOverride: PadFamily | null = null;

function readTestPadFamily(): PadFamily | null {
	if (testPadFamilyOverride) return testPadFamilyOverride;
	if (!import.meta.env.DEV || typeof window === 'undefined') return null;
	const raw = (window as unknown as Record<string, unknown>)[TEST_PAD_FAMILY_KEY];
	if (raw === 'switch' || raw === 'playstation' || raw === 'xbox' || raw === 'unknown') {
		return raw;
	}
	return null;
}

/** Dev / Playwright — force pad family for glyph assertions (window-bridged for HMR/dual-import). */
export function __testSetPadFamily(family: PadFamily | null): void {
	if (!import.meta.env.DEV) return;
	testPadFamilyOverride = family;
	if (typeof window === 'undefined') return;
	const w = window as unknown as Record<string, unknown>;
	if (family) w[TEST_PAD_FAMILY_KEY] = family;
	else delete w[TEST_PAD_FAMILY_KEY];
}

/** Infer controller family from Gamepad.id / label heuristics. */
export function detectPadFamily(idOrLabel: string | null | undefined): PadFamily {
	const s = (idOrLabel ?? '').toLowerCase();
	if (!s.trim()) return 'unknown';
	if (
		s.includes('nintendo') ||
		s.includes('switch') ||
		s.includes('pro controller') ||
		s.includes('joy-con')
	) {
		return 'switch';
	}
	if (
		s.includes('dualsense') ||
		s.includes('dualshock') ||
		s.includes('sony') ||
		s.includes('playstation') ||
		/\bps[0-9]?\b/.test(s)
	) {
		return 'playstation';
	}
	if (s.includes('xbox') || s.includes('xinput') || s.includes('microsoft')) {
		return 'xbox';
	}
	return 'unknown';
}

/**
 * Single West-face glyph for the active pad family.
 * No pad / unknown → `E`. Switch → `Y`. PlayStation → `□`. Xbox → `X`.
 */
export function gamepadWestLabel(): string {
	const override = readTestPadFamily();
	if (override) return familyWestGlyph(override);
	if (!gamepad.connected) return 'E';
	const pad = localPad();
	const family = detectPadFamily(pad?.id ?? gamepad.label);
	return familyWestGlyph(family);
}

function familyWestGlyph(family: PadFamily): string {
	switch (family) {
		case 'switch':
			return 'Y';
		case 'playstation':
			return '□';
		case 'xbox':
			return 'X';
		default:
			return 'E';
	}
}

/** True once on the frame the south face button (0) is pressed on this client's pad. */
export function gamepadJumpPressed(): boolean {
	const pad = localPad();
	if (!pad) return false;
	const held = pad.buttons[0]?.pressed ?? false;
	const edge = held && !jumpHeld.get(pad.index);
	jumpHeld.set(pad.index, held);
	return edge;
}

/** True while the south face button (0) is held on this client's pad. */
export function gamepadJumpHeld(): boolean {
	const pad = localPad();
	if (!pad) return false;
	return pad.buttons[0]?.pressed ?? false;
}

/** This client's assigned pad axis, or neutral when unassigned / idle.
 * Low-pass filters stick (~15 Hz) to damp full-deflection micro-noise. */
let stickEx = 0;
let stickEz = 0;
let stickLastMs = 0;
const STICK_EMA_HZ = 15;

export function gamepadAxis(): { x: number; z: number } {
	const pad = localPad();
	if (!pad) {
		stickEx = 0;
		stickEz = 0;
		return { x: 0, z: 0 };
	}
	const raw = readPad(pad, gamepad.deadzone, {
		invertX: gamepad.invertStickX,
		invertY: gamepad.invertStickY
	});
	const now = performance.now();
	const dt = stickLastMs ? Math.min(0.05, (now - stickLastMs) / 1000) : 1 / 60;
	stickLastMs = now;
	const a = 1 - Math.exp(-STICK_EMA_HZ * dt);
	stickEx += (raw.x - stickEx) * a;
	stickEz += (raw.z - stickEz) * a;
	if (Math.hypot(stickEx, stickEz) < gamepad.deadzone * 0.5) {
		stickEx = 0;
		stickEz = 0;
	}
	return { x: stickEx, z: stickEz };
}

/** Right stick for camera orbit in play mode (axes 2–3). */
export function gamepadLookAxis(): { x: number; y: number } {
	const pad = localPad();
	if (!pad) return { x: 0, y: 0 };
	const dz = gamepad.deadzone;
	let x = applyDeadzone(pad.axes[2] ?? 0, dz);
	let y = applyDeadzone(pad.axes[3] ?? 0, dz);
	if (gamepad.invertLookX) x = -x;
	if (gamepad.invertLookY) y = -y;
	return { x, y };
}
