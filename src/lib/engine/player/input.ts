import Gamepad2Icon from '@lucide/svelte/icons/gamepad-2';
import { collab } from '$lib/engine/collab/collab.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { isFormFieldFocused } from '$lib/ui/shellKeyboard';
import { ui } from '$lib/ui/ui.svelte';
import { toast } from '$lib/ui/toast.svelte';
import { gamepad, gamepadAxis, gamepadJumpHeld, gamepadJumpPressed, gamepadInteractPressed } from './gamepad.svelte';
import { playCamera } from '$lib/engine/camera/playCamera.svelte';
import {
	resolveLocomotion,
	type LocomotionSample,
	type LocomotionTier
} from './playInput';
import { playInputState } from './playInputState.svelte';

const keys = new Set<string>();
const pressedThisTick = new Set<string>();
const releasedThisTick = new Set<string>();
let jumpQueued = false;
let interactQueued = false;

/** Baseline Player.speed — locomotion tiers scale relative to this. */
export const PLAYER_SPEED_BASELINE = 4;

function onDown(event: KeyboardEvent) {
	if (isFormFieldFocused()) return;
	const key = event.key.toLowerCase();
	keys.add(key);
	pressedThisTick.add(key);
	if (key === ' ' || key === 'spacebar') jumpQueued = true;
	if (key === 'e') interactQueued = true;
}

function onUp(event: KeyboardEvent) {
	if (isFormFieldFocused()) return;
	const key = event.key.toLowerCase();
	keys.delete(key);
	releasedThisTick.add(key);
}

function onFocusIn() {
	if (isFormFieldFocused()) keys.clear();
}

function keyboardAxis(): { x: number; z: number } {
	if (isFormFieldFocused()) return { x: 0, z: 0 };
	let x = 0;
	let z = 0;
	if (keys.has('a') || keys.has('arrowleft')) x -= 1;
	if (keys.has('d') || keys.has('arrowright')) x += 1;
	if (keys.has('w') || keys.has('arrowup')) z -= 1;
	if (keys.has('s') || keys.has('arrowdown')) z += 1;
	return { x, z };
}

function keyboardLocomotionTier(): Exclude<LocomotionTier, 'idle'> {
	if (keys.has('shift')) return 'sprint';
	if (keys.has('alt')) return 'run';
	if (keys.has('control')) return 'walk';
	return playInputState.config.locomotion.keyboardTier;
}

export type MovementSample = LocomotionSample & {
	x: number;
	z: number;
	source: 'keyboard' | 'gamepad' | 'none';
};

function movementSample(): MovementSample {
	const profile = playInputState.config.locomotion;
	const kb = keyboardAxis();
	const pad = gamepadAxis();

	let x = kb.x + pad.x;
	let z = kb.z + pad.z;
	const mergedLen = Math.hypot(x, z);
	if (mergedLen <= 0.01) {
		return { x: 0, z: 0, tier: 'idle', speed: 0, magnitude: 0, source: 'none' };
	}

	const dirX = mergedLen > 1 ? x / mergedLen : x;
	let dirZ = mergedLen > 1 ? z / mergedLen : z;
	let outX = dirX;

	if (playCamera.active) {
		const projected = playCamera.projectMovement(dirX, dirZ);
		outX = projected.x;
		dirZ = projected.z;
		const projectedLen = Math.hypot(outX, dirZ);
		if (projectedLen > 0.01) {
			outX /= projectedLen;
			dirZ /= projectedLen;
		}
	}

	const finalX = outX;
	const finalZ = dirZ;

	const kbMag = Math.hypot(kb.x, kb.z);
	const padMag = Math.hypot(pad.x, pad.z);
	const kbActive = kbMag > 0;
	const padActive = padMag > gamepad.deadzone;

	let loc: LocomotionSample;
	let source: MovementSample['source'];

	if (padActive && !kbActive) {
		loc = resolveLocomotion(Math.min(1, padMag), profile);
		source = 'gamepad';
	} else {
		loc = resolveLocomotion(1, profile, {
			keyboard: true,
			keyboardTier: keyboardLocomotionTier()
		});
		source = kbActive ? 'keyboard' : 'gamepad';
	}

	return { x: finalX, z: finalZ, ...loc, source };
}

export const input = {
	/** Pad presence — edit + play. Connect toast / Controller.wav fire here. */
	attachGamepad() {
		if (typeof window === 'undefined') return;
		gamepad.attach({
			notify: (message) => toast(message, { icon: Gamepad2Icon }),
			getLeaseContext: () => ({
				clientId: session.clientId,
				roomId: collab.roomId,
				memberIndex: Math.max(0, session.members.indexOf(session.clientId))
			})
		});
	},

	detachGamepad() {
		if (typeof window === 'undefined') return;
		gamepad.detach();
	},

	/** Keyboard locomotion — play mode only. */
	attach() {
		if (typeof window === 'undefined') return;
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		window.addEventListener('focusin', onFocusIn);
		this.attachGamepad();
	},

	detach() {
		if (typeof window === 'undefined') return;
		window.removeEventListener('keydown', onDown);
		window.removeEventListener('keyup', onUp);
		window.removeEventListener('focusin', onFocusIn);
		keys.clear();
		jumpQueued = false;
	},

	/** Direction + locomotion tier/speed for play-mode movement. */
	movement(): MovementSample {
		const sample = movementSample();
		playInputState.locomotion = {
			tier: sample.tier,
			speed: sample.speed,
			magnitude: sample.magnitude
		};
		return sample;
	},

	/** WASD / arrows / left stick / d-pad → normalized {x, z} on the ground plane (−z = forward). */
	axis(): { x: number; z: number } {
		const move = movementSample();
		if (move.magnitude <= 0.01) return { x: 0, z: 0 };
		return { x: move.x * move.magnitude, z: move.z * move.magnitude };
	},

	/** True while a movement key is currently held (case-insensitive). */
	pressed(key: string): boolean {
		return keys.has(key.toLowerCase());
	},

	/** True while any of the given keys is held (case-insensitive). */
	anyPressed(...keysToCheck: string[]): boolean {
		return keysToCheck.some((key) => keys.has(key.toLowerCase()));
	},

	/** True once on the frame Space or the pad's south button was pressed
	 * (edit-safe; cleared after read). */
	jumpPressed(): boolean {
		if (ui.shellMode === 'play' && ui.playPaused) return false;
		// Poll the pad every frame so edge state stays fresh even when ignored.
		const padJump = gamepadJumpPressed();
		if (isFormFieldFocused()) return false;
		const queued = jumpQueued;
		jumpQueued = false;
		return queued || padJump;
	},

	/** True once on the frame E or pad West (□/X) was pressed — interact / use. */
	interactPressed(): boolean {
		if (ui.shellMode === 'play' && ui.playPaused) return false;
		const padInteract = gamepadInteractPressed();
		if (isFormFieldFocused()) return false;
		const queued = interactQueued;
		interactQueued = false;
		return queued || padInteract;
	},

	/** True while Space or the pad's south button is currently held. */
	jumpHeld(): boolean {
		if (ui.shellMode === 'play' && ui.playPaused) return false;
		if (isFormFieldFocused()) return false;
		return keys.has(' ') || keys.has('spacebar') || gamepadJumpHeld();
	}
};

/** Keys that transitioned down this tick (cleared after read). */
export function drainPressedEdges(): string[] {
	const out = [...pressedThisTick];
	pressedThisTick.clear();
	return out;
}

/** Keys that transitioned up this tick (cleared after read). */
export function drainReleasedEdges(): string[] {
	const out = [...releasedThisTick];
	releasedThisTick.clear();
	return out;
}

/** Playwright / dev probe — inject a synthetic key edge without DOM events. */
export function __testInjectKeyEdge(kind: 'down' | 'up', key: string): void {
	if (!import.meta.env.DEV) return;
	const k = key.toLowerCase();
	if (kind === 'down') {
		keys.add(k);
		pressedThisTick.add(k);
		if (k === ' ' || k === 'spacebar') jumpQueued = true;
		if (k === 'e') interactQueued = true;
	} else {
		keys.delete(k);
		releasedThisTick.add(k);
	}
}

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		// Keyboard only — pad listeners are session-long; hmrLifecycle re-attaches lease context.
		input.detach();
	});
}
