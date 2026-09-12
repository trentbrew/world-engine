/**
 * Naruto hand signs / chakra chord state for play mode.
 *
 * Pressing and holding a modifier key (Alt / Option or Control) enters the
 * chord stance, zooming the camera into the player at waist level.
 * Releasing the modifier key unzooms back to normal third-person view.
 */

import { ui } from '$lib/ui/ui.svelte';
import { toast } from '$lib/ui/toast.svelte';
import { shadowCloneState } from './shadowClone.svelte';
import { playSfx } from '$lib/engine/audio/sfx';
import {
	gamepadHandSignsModifierHeld,
	gamepadLeftStickRadial,
	gamepadShoulderMask,
	gamepadHandSignsCancelPressed
} from './gamepad.svelte';
import { RADIAL_SECTOR_KEYS, RADIAL_ZODIAC_DEFS, type RadialZodiacDef, type RadialSectorKey } from './radialZodiac';
import {
	SHOULDER_SIGNS_MAP,
	ALL_SHOULDER_SIGNS,
	resolveShoulderChord,
	formatChordLabel,
	formatShoulderButton,
	type ShoulderSignDef,
	type ShoulderButtonId
} from './shoulderSigns';

export {
	RADIAL_SECTOR_KEYS,
	RADIAL_ZODIAC_DEFS,
	type RadialZodiacDef,
	type RadialSectorKey,
	SHOULDER_SIGNS_MAP,
	ALL_SHOULDER_SIGNS,
	resolveShoulderChord,
	formatChordLabel,
	formatShoulderButton,
	type ShoulderSignDef,
	type ShoulderButtonId
};

export interface HandSignDef {
	key: string;
	english: string;
	japanese: string;
	romaji: string;
}

export interface HandSignEntry extends HandSignDef {
	id: number;
	timestamp: number;
}

export const HAND_SIGNS_MAP: Record<string, HandSignDef> = {
	q: { key: 'q', english: 'DRAGON', japanese: '辰', romaji: 'Tatsu' },
	w: { key: 'w', english: 'TIGER', japanese: '寅', romaji: 'Tora' },
	e: { key: 'e', english: 'DOG', japanese: '戌', romaji: 'Inu' },
	r: { key: 'r', english: 'RAT', japanese: '子', romaji: 'Ne' },
	a: { key: 'a', english: 'RAM', japanese: '未', romaji: 'Hitsuji' },
	s: { key: 's', english: 'HORSE', japanese: '午', romaji: 'Uma' },
	d: { key: 'd', english: 'MONKEY', japanese: '申', romaji: 'Saru' },
	f: { key: 'f', english: 'BIRD', japanese: '酉', romaji: 'Tori' },
	z: { key: 'z', english: 'OX', japanese: '丑', romaji: 'Ushi' },
	x: { key: 'x', english: 'SERPENT', japanese: '巳', romaji: 'Mi' },
	c: { key: 'c', english: 'HARE', japanese: '卯', romaji: 'U' },
	v: { key: 'v', english: 'BOAR', japanese: '亥', romaji: 'I' }
};

const CODE_TO_KEY: Record<string, string> = {
	KeyQ: 'q',
	KeyW: 'w',
	KeyE: 'e',
	KeyR: 'r',
	KeyA: 'a',
	KeyS: 's',
	KeyD: 'd',
	KeyF: 'f',
	KeyZ: 'z',
	KeyX: 'x',
	KeyC: 'c',
	KeyV: 'v'
};

export interface JutsuAction {
	id: string;
	name: string;
	japanese: string;
	romaji: string;
	sequence: string[];
	sfx?: string;
	triggerDelayMs?: number;
}

export interface JutsuMatchResult {
	id: number;
	matched: boolean;
	jutsu: JutsuAction | null;
	symbols: string;
	chainSummary: string;
}

export const JUTSU_REGISTRY: JutsuAction[] = [
	{
		id: 'chidori',
		name: 'Chidori',
		japanese: '千鳥',
		romaji: 'Chidori',
		sequence: ['z', 'c', 'd'], // Ox -> Hare -> Monkey
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1200
	},
	{
		id: 'fireball_full',
		name: 'Fire Style: Fireball Jutsu',
		japanese: '豪火球の術',
		romaji: 'Katon: Gōkākyū no Jutsu',
		sequence: ['x', 'a', 'd', 'v', 's', 'w'], // Serpent -> Ram -> Monkey -> Boar -> Horse -> Tiger
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1400
	},
	{
		id: 'fireball_short',
		name: 'Fire Style: Fireball Jutsu',
		japanese: '豪火球の術',
		romaji: 'Katon: Gōkākyū no Jutsu',
		sequence: ['x', 'w'], // Serpent -> Tiger
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1200
	},
	{
		id: 'shadow_clone',
		name: 'Shadow Clone Jutsu',
		japanese: '影分身の術',
		romaji: 'Kage Bunshin no Jutsu',
		sequence: ['a'], // Ram
		sfx: '/audio/shadowclone.wav',
		triggerDelayMs: 1200
	},
	{
		id: 'shadow_clone_pair',
		name: 'Shadow Clone Jutsu',
		japanese: '影分身の術',
		romaji: 'Kage Bunshin no Jutsu',
		sequence: ['w', 'a'], // Tiger -> Ram
		sfx: '/audio/shadowclone.wav',
		triggerDelayMs: 1200
	},
	{
		id: 'summoning',
		name: 'Summoning Jutsu',
		japanese: '口寄せの術',
		romaji: 'Kuchiyose no Jutsu',
		sequence: ['v', 'e', 'f', 'd', 'a'], // Boar -> Dog -> Bird -> Monkey -> Ram
		sfx: '/audio/impact.wav',
		triggerDelayMs: 1400
	},
	{
		id: 'water_dragon',
		name: 'Water Style: Water Dragon Jutsu',
		japanese: '水龍弾の術',
		romaji: 'Suiton: Suiryūdan no Jutsu',
		sequence: ['z', 'd', 'c', 'r'], // Ox -> Monkey -> Hare -> Rat
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1200
	},
	{
		id: 'body_flicker',
		name: 'Body Flicker Technique',
		japanese: '瞬身の術',
		romaji: 'Shunshin no Jutsu',
		sequence: ['a', 'v', 'z'], // Ram -> Boar -> Ox
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1000
	},
	{
		id: 'water_prison',
		name: 'Water Style: Water Prison Jutsu',
		japanese: '水牢の術',
		romaji: 'Suiton: Suirō no Jutsu',
		sequence: ['a', 'w', 'z', 'x'], // Ram -> Tiger -> Ox -> Serpent
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1200
	},
	{
		id: 'dragon_fire',
		name: 'Fire Style: Dragon Fire Jutsu',
		japanese: '龍火の術',
		romaji: 'Katon: Ryūka no Jutsu',
		sequence: ['x', 'q'], // Serpent -> Dragon
		sfx: '/audio/whoosh.wav',
		triggerDelayMs: 1200
	}
];

export function matchJutsu(keys: string[]): JutsuAction | null {
	if (keys.length === 0) return null;
	const keyStr = keys.join(',');
	for (const jutsu of JUTSU_REGISTRY) {
		if (jutsu.sequence.join(',') === keyStr) {
			return jutsu;
		}
	}
	return null;
}

class HandSignsState {
	/** True while the modifier key is held in play mode. */
	active = $state(false);

	/** Target camera distance from player when zoomed in (waist level). */
	zoomDistance = $state(1.8);

	/**
	 * Offset from player Transform.position (capsule center) to waist level.
	 * Transform.position is at capsule center (~0.975m above ground),
	 * so [0, 0.1, 0] focuses right at upper waist / solar plexus.
	 */
	waistLookAtOffset = $state<[number, number, number]>([0, 0.1, 0]);

	/** Saved camera distance before zoom, restored on unzoom. */
	savedDistance = $state<number | null>(null);

	/** Saved camera azimuth angle before zoom, restored on unzoom. */
	savedAzimuth = $state<number | null>(null);

	/** Current chain of hand signs entered by the player. */
	chain = $state<HandSignEntry[]>([]);

	/** Controls visibility and graceful fade-out for HUD. */
	visible = $state(false);

	/** Result of the last completed seal chain. */
	lastResult = $state<JutsuMatchResult | null>(null);

	/** Currently matching jutsu while typing (if any). */
	activeJutsu = $derived(matchJutsu(this.chain.map((s) => s.key)));

	/** Last pressed key, for brief active feedback on the grid. */
	lastPressedKey = $state<string | null>(null);

	/**
	 * True for ~3 seconds after completing a valid jutsu seal chain.
	 * Keeps the camera locked facing the player and zoomed out slightly (~2.8m)
	 * so there's time to showcase the jutsu result and animation.
	 */
	isJutsuLocked = $state(false);

	/** Camera showcase distance during jutsu lock (zoomed out for cinematic framing). */
	jutsuLockDistance = $state(5.2);

	/** Number of shadow clones to spawn when committing Ram (Shadow Clone Jutsu). */
	cloneMultiplier = $state(1);

	/** Duration of jutsu showcase camera lock in milliseconds. */
	jutsuLockDuration = 3000;

	/**
	 * True for ~2.8s after releasing an unmapped / invalid hand sign sequence.
	 * Triggers the Confused head-scratch animation on the player while idle.
	 */
	isFailedJutsu = $state(false);

	private _failedJutsuTimer: ReturnType<typeof setTimeout> | null = null;

	/** Real-time Left Stick radial deflection state (for fallback / compatibility). */
	radialAngle = $state<number | null>(null);
	radialMagnitude = $state<number>(0);
	radialSector = $state<number | null>(null);

	/** Real-time shoulder button chord states for the controller HUD. */
	shoulderMask = $state<number>(0);
	activeChord = $state<ShoulderSignDef | null>(null);
	committedChord = $state<ShoulderSignDef | null>(null);

	private _nextId = 0;
	private _resultId = 0;
	private _fadeTimer: ReturnType<typeof setTimeout> | null = null;
	private _keyHighlightTimer: ReturnType<typeof setTimeout> | null = null;
	private _jutsuLockTimer: ReturnType<typeof setTimeout> | null = null;
	private _jutsuTriggerTimer: ReturnType<typeof setTimeout> | null = null;
	private _gamepadLastSector: number | null = null;
	private _gamepadWasHeld = false;

	// Chord collection window state (55ms buffer)
	private _chordBufferStart: number | null = null;
	private _chordAccumulatedMask = 0;
	private _chordCommitted = false;
	private _committedChordTimer: ReturnType<typeof setTimeout> | null = null;

	/** Poll gamepad stance modifier and shoulder button chords each frame in play mode. */
	pollGamepad(): void {
		if (typeof navigator === 'undefined' || ui.shellMode !== 'play') return;
		const isHeld = gamepadHandSignsModifierHeld();

		if (isHeld && !this._gamepadWasHeld) {
			this._gamepadWasHeld = true;
			this._gamepadLastSector = null;
			this._chordBufferStart = null;
			this._chordAccumulatedMask = 0;
			this._chordCommitted = false;
			this.activate();
		} else if (!isHeld && this._gamepadWasHeld) {
			this._gamepadWasHeld = false;
			this._gamepadLastSector = null;
			this.radialAngle = null;
			this.radialMagnitude = 0;
			this.radialSector = null;
			this.shoulderMask = 0;
			this.activeChord = null;
			this._chordBufferStart = null;
			this._chordAccumulatedMask = 0;
			this._chordCommitted = false;
			this.deactivate();
			return;
		}

		if (this.active && isHeld) {
			// Check for intentional jutsu cancel button (Circle / B / East button)
			if (gamepadHandSignsCancelPressed()) {
				this.cancel();
				return;
			}

			// 1. Shoulder buttons & chords input (discrete, tactile, muscle memory)
			const mask = gamepadShoulderMask();
			this.shoulderMask = mask;
			this.activeChord = resolveShoulderChord(mask);

			const now = performance.now();

			if (mask > 0) {
				if (!this._chordCommitted) {
					if (this._chordBufferStart === null) {
						this._chordBufferStart = now;
						this._chordAccumulatedMask = mask;
					} else {
						this._chordAccumulatedMask |= mask;
					}

					// 55ms chord collection window to group simultaneous button presses
					if (now - this._chordBufferStart >= 55) {
						const sign = resolveShoulderChord(this._chordAccumulatedMask);
						if (sign) {
							this.inputSign(sign.key);
							this.committedChord = sign;
							if (this._committedChordTimer) clearTimeout(this._committedChordTimer);
							this._committedChordTimer = setTimeout(() => {
								this.committedChord = null;
							}, 400);
						}
						this._chordCommitted = true;
					}
				}
			} else {
				// Buttons released: if player tapped and released within < 55ms, commit now
				if (this._chordBufferStart !== null && !this._chordCommitted) {
					const sign = resolveShoulderChord(this._chordAccumulatedMask);
					if (sign) {
						this.inputSign(sign.key);
						this.committedChord = sign;
						if (this._committedChordTimer) clearTimeout(this._committedChordTimer);
						this._committedChordTimer = setTimeout(() => {
							this.committedChord = null;
						}, 400);
					}
				}
				// Reset unlatch so next chord can be entered
				this._chordBufferStart = null;
				this._chordAccumulatedMask = 0;
				this._chordCommitted = false;
			}
		}
	}

	/**
	 * Test if a keyboard event is the hand sign modifier key.
	 * Uses Control ('ctrl').
	 */
	isModifier(event: KeyboardEvent): boolean {
		const key = event.key.toLowerCase();
		return key === 'control' || event.code === 'ControlLeft' || event.code === 'ControlRight';
	}

	resolveKey(event: KeyboardEvent): string | null {
		const key = event.key.toLowerCase();
		if (HAND_SIGNS_MAP[key]) return key;
		if (event.code && CODE_TO_KEY[event.code]) return CODE_TO_KEY[event.code];
		return null;
	}

	isHandSignKey(event: KeyboardEvent): boolean {
		return this.resolveKey(event) !== null;
	}

	inputSign(eventOrKey: KeyboardEvent | string): HandSignEntry | null {
		const key =
			typeof eventOrKey === 'string' ? eventOrKey.toLowerCase() : this.resolveKey(eventOrKey);
		if (!key) return null;
		const def = HAND_SIGNS_MAP[key];
		if (!def) return null;

		// Normalize ignoring multiple consecutive presses of the same hand sign
		// UNLESS it's the Shadow Clone seal (Ram = 'a'), where repeats increment clone count
		const lastEntry = this.chain.length > 0 ? this.chain[this.chain.length - 1] : null;
		if (lastEntry && lastEntry.key === key) {
			if (key === 'a') {
				// Shadow Clone Jutsu multiplier: increment clone count without sound or duplicate chain entry
				this.cloneMultiplier = Math.min(12, this.cloneMultiplier + 1);
				this.lastPressedKey = key;
				if (this._keyHighlightTimer) clearTimeout(this._keyHighlightTimer);
				this._keyHighlightTimer = setTimeout(() => {
					if (this.lastPressedKey === key) this.lastPressedKey = null;
				}, 200);
				return lastEntry;
			} else {
				// Ignore consecutive presses of regular hand signs
				return null;
			}
		}

		if (this._fadeTimer) {
			clearTimeout(this._fadeTimer);
			this._fadeTimer = null;
		}

		if (key === 'a' && this.chain.length === 0) {
			this.cloneMultiplier = 1;
		}

		this.lastPressedKey = key;
		if (this._keyHighlightTimer) clearTimeout(this._keyHighlightTimer);
		this._keyHighlightTimer = setTimeout(() => {
			if (this.lastPressedKey === key) this.lastPressedKey = null;
		}, 200);

		this.visible = true;
		const entry: HandSignEntry = {
			...def,
			id: ++this._nextId,
			timestamp: Date.now()
		};
		this.chain = [...this.chain, entry];
		playSfx('/audio/handsign.wav');
		return entry;
	}

	activate(currentDistance?: number, currentAzimuth?: number) {
		if (ui.shellMode !== 'play' || this.active) return;
		if (currentDistance !== undefined && Number.isFinite(currentDistance)) {
			this.savedDistance = currentDistance;
		}
		if (currentAzimuth !== undefined && Number.isFinite(currentAzimuth)) {
			this.savedAzimuth = currentAzimuth;
		}
		if (this._fadeTimer) {
			clearTimeout(this._fadeTimer);
			this._fadeTimer = null;
		}
		if (this._jutsuLockTimer) {
			clearTimeout(this._jutsuLockTimer);
			this._jutsuLockTimer = null;
		}
		if (this._jutsuTriggerTimer) {
			clearTimeout(this._jutsuTriggerTimer);
			this._jutsuTriggerTimer = null;
		}
		this.isJutsuLocked = false;
		this.clearFailedJutsu();
		this.chain = [];
		this.lastResult = null;
		this.cloneMultiplier = 1;
		this.active = true;
		this.visible = true;
	}

	/**
	 * Cancel the active jutsu stance and clear all formed seals without casting.
	 * Shinobi can intentionally abort chakra molding before release.
	 */
	cancel() {
		if (!this.active) return;
		this.active = false;
		this.isJutsuLocked = false;
		if (this._jutsuTriggerTimer) {
			clearTimeout(this._jutsuTriggerTimer);
			this._jutsuTriggerTimer = null;
		}
		this.clearFailedJutsu();
		this.clearChain();
		this.cloneMultiplier = 1;
		toast.warning('Jutsu cancelled', {
			description: 'Chakra mold dispelled before release.'
		});
	}

	deactivate() {
		if (!this.active) return;
		this.active = false;
		if (this._fadeTimer) clearTimeout(this._fadeTimer);
		if (this.chain.length > 0) {
			const keys = this.chain.map((s) => s.key);
			const jutsu = matchJutsu(keys);
			const symbols = this.chain.map((s) => s.japanese).join(' ');
			const chainSummary = this.chain.map((s) => s.romaji).join(' → ');
			const matched = jutsu !== null;
			this.lastResult = {
				id: ++this._resultId,
				matched,
				jutsu,
				symbols,
				chainSummary
			};
			this._fadeTimer = setTimeout(() => {
				this.visible = false;
				this._fadeTimer = null;
			}, 3500);

			if (matched && jutsu) {
				// Play authentic Naruto jutsu completion SFX (charge / release)
				playSfx('/audio/jutsu.wav');
				this.clearFailedJutsu();

				// Dynamic jutsu showcase zoom: zoom out wider (5.2m up to 7.6m) to frame player and summoned squad
				this.jutsuLockDistance = 5.2 + Math.min(2.4, (this.cloneMultiplier - 1) * 0.5);

				// Lock camera facing player and zoom out
				if (this._jutsuLockTimer) clearTimeout(this._jutsuLockTimer);
				if (this._jutsuTriggerTimer) clearTimeout(this._jutsuTriggerTimer);
				this.isJutsuLocked = true;

				const delayMs = jutsu.triggerDelayMs ?? 1200;
				const cloneCount = this.cloneMultiplier;

				// After the delay, trigger the jutsu effect and jutsu-specific SFX!
				this._jutsuTriggerTimer = setTimeout(() => {
					this._jutsuTriggerTimer = null;

					// Play jutsu specific execution SFX (e.g. shadowclone.wav)
					if (jutsu.sfx) {
						playSfx(jutsu.sfx);
					}

					// If Shadow Clone Jutsu was cast, spawn clones!
					if (jutsu.id.startsWith('shadow_clone')) {
						shadowCloneState.spawnClones(cloneCount);
					}
				}, delayMs);

				// Total lock duration covers the trigger delay + showcase after spawn
				const totalLockDuration = delayMs + this.jutsuLockDuration;
				this._jutsuLockTimer = setTimeout(() => {
					this.isJutsuLocked = false;
					this._jutsuLockTimer = null;
				}, totalLockDuration);
			} else {
				// Invalid jutsu combo: trigger Confused head-scratch reaction emote
				this.isFailedJutsu = true;
				if (this._failedJutsuTimer) clearTimeout(this._failedJutsuTimer);
				this._failedJutsuTimer = setTimeout(() => {
					this.isFailedJutsu = false;
					this._failedJutsuTimer = null;
				}, 2800);
			}
			this.cloneMultiplier = 1;
		} else {
			this.visible = false;
			this.cloneMultiplier = 1;
		}
	}

	clearFailedJutsu() {
		this.isFailedJutsu = false;
		if (this._failedJutsuTimer) {
			clearTimeout(this._failedJutsuTimer);
			this._failedJutsuTimer = null;
		}
	}

	clearChain() {
		this.chain = [];
		this.lastResult = null;
		this.visible = false;
		this.cloneMultiplier = 1;
		this.clearFailedJutsu();
		if (this._fadeTimer) {
			clearTimeout(this._fadeTimer);
			this._fadeTimer = null;
		}
		if (this._jutsuLockTimer) {
			clearTimeout(this._jutsuLockTimer);
			this._jutsuLockTimer = null;
		}
		if (this._jutsuTriggerTimer) {
			clearTimeout(this._jutsuTriggerTimer);
			this._jutsuTriggerTimer = null;
		}
		this.isJutsuLocked = false;
		this.radialAngle = null;
		this.radialMagnitude = 0;
		this.radialSector = null;
		this._gamepadLastSector = null;
		this.shoulderMask = 0;
		this.activeChord = null;
		this.committedChord = null;
		this._chordBufferStart = null;
		this._chordAccumulatedMask = 0;
		this._chordCommitted = false;
		if (this._committedChordTimer) {
			clearTimeout(this._committedChordTimer);
			this._committedChordTimer = null;
		}
	}

	reset() {
		this.active = false;
		this.savedDistance = null;
		this.savedAzimuth = null;
		this._gamepadWasHeld = false;
		this.clearChain();
	}
}

export const handSigns = new HandSignsState();
