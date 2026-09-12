/**
 * Discrete 4-Bit Shoulder Button & Chord Mapping for the 12 Naruto Hand Signs.
 *
 * Bitmask:
 *   L1 / LB / L  = 1 << 0 (1)
 *   L2 / LT / ZL = 1 << 1 (2)
 *   R1 / RB / R  = 1 << 2 (4)
 *   R2 / RT / ZR = 1 << 3 (8)
 */

import type { PadFamily } from './gamepad.svelte.ts';

export const SHOULDER_L1 = 1 << 0; // 1
export const SHOULDER_L2 = 1 << 1; // 2
export const SHOULDER_R1 = 1 << 2; // 4
export const SHOULDER_R2 = 1 << 3; // 8

export type ShoulderButtonId = 'L1' | 'L2' | 'R1' | 'R2';

export interface ShoulderSignDef {
	mask: number;
	key: string;
	english: string;
	japanese: string;
	romaji: string;
	buttons: ShoulderButtonId[];
	group: 'single' | 'pair' | 'chord';
}

export const SHOULDER_SIGNS_MAP: Record<number, ShoulderSignDef> = {
	// 4 Singles
	[SHOULDER_L1]: {
		mask: SHOULDER_L1,
		key: 'r',
		english: 'RAT',
		japanese: '子',
		romaji: 'Ne',
		buttons: ['L1'],
		group: 'single'
	},
	[SHOULDER_L2]: {
		mask: SHOULDER_L2,
		key: 'z',
		english: 'OX',
		japanese: '丑',
		romaji: 'Ushi',
		buttons: ['L2'],
		group: 'single'
	},
	[SHOULDER_R1]: {
		mask: SHOULDER_R1,
		key: 'w',
		english: 'TIGER',
		japanese: '寅',
		romaji: 'Tora',
		buttons: ['R1'],
		group: 'single'
	},
	[SHOULDER_R2]: {
		mask: SHOULDER_R2,
		key: 'c',
		english: 'HARE',
		japanese: '卯',
		romaji: 'U',
		buttons: ['R2'],
		group: 'single'
	},

	// 6 Pairs (Doubles)
	[SHOULDER_L1 | SHOULDER_R1]: {
		mask: SHOULDER_L1 | SHOULDER_R1,
		key: 'q',
		english: 'DRAGON',
		japanese: '辰',
		romaji: 'Tatsu',
		buttons: ['L1', 'R1'],
		group: 'pair'
	},
	[SHOULDER_L2 | SHOULDER_R2]: {
		mask: SHOULDER_L2 | SHOULDER_R2,
		key: 'x',
		english: 'SERPENT',
		japanese: '巳',
		romaji: 'Mi',
		buttons: ['L2', 'R2'],
		group: 'pair'
	},
	[SHOULDER_L1 | SHOULDER_L2]: {
		mask: SHOULDER_L1 | SHOULDER_L2,
		key: 's',
		english: 'HORSE',
		japanese: '午',
		romaji: 'Uma',
		buttons: ['L1', 'L2'],
		group: 'pair'
	},
	[SHOULDER_R1 | SHOULDER_R2]: {
		mask: SHOULDER_R1 | SHOULDER_R2,
		key: 'a',
		english: 'RAM',
		japanese: '未',
		romaji: 'Hitsuji',
		buttons: ['R1', 'R2'],
		group: 'pair' // Shadow Clone Jutsu!
	},
	[SHOULDER_L1 | SHOULDER_R2]: {
		mask: SHOULDER_L1 | SHOULDER_R2,
		key: 'd',
		english: 'MONKEY',
		japanese: '申',
		romaji: 'Saru',
		buttons: ['L1', 'R2'],
		group: 'pair'
	},
	[SHOULDER_L2 | SHOULDER_R1]: {
		mask: SHOULDER_L2 | SHOULDER_R1,
		key: 'f',
		english: 'BIRD',
		japanese: '酉',
		romaji: 'Tori',
		buttons: ['L2', 'R1'],
		group: 'pair'
	},

	// 2 Multi-Button Chords
	[SHOULDER_L1 | SHOULDER_L2 | SHOULDER_R1]: {
		mask: SHOULDER_L1 | SHOULDER_L2 | SHOULDER_R1,
		key: 'e',
		english: 'DOG',
		japanese: '戌',
		romaji: 'Inu',
		buttons: ['L1', 'L2', 'R1'],
		group: 'chord'
	},
	[SHOULDER_L1 | SHOULDER_L2 | SHOULDER_R1 | SHOULDER_R2]: {
		mask: SHOULDER_L1 | SHOULDER_L2 | SHOULDER_R1 | SHOULDER_R2,
		key: 'v',
		english: 'BOAR',
		japanese: '亥',
		romaji: 'I',
		buttons: ['L1', 'L2', 'R1', 'R2'],
		group: 'chord'
	}
};

export const ALL_SHOULDER_SIGNS: ShoulderSignDef[] = Object.values(SHOULDER_SIGNS_MAP);

/** Resolve a bitmask into a hand sign definition. */
export function resolveShoulderChord(mask: number): ShoulderSignDef | null {
	return SHOULDER_SIGNS_MAP[mask] ?? null;
}

/** Get localized controller button glyph for a shoulder button id. */
export function formatShoulderButton(btn: ShoulderButtonId, family: PadFamily = 'playstation'): string {
	switch (family) {
		case 'xbox':
			if (btn === 'L1') return 'LB';
			if (btn === 'L2') return 'LT';
			if (btn === 'R1') return 'RB';
			if (btn === 'R2') return 'RT';
			break;
		case 'switch':
			if (btn === 'L1') return 'L';
			if (btn === 'L2') return 'ZL';
			if (btn === 'R1') return 'R';
			if (btn === 'R2') return 'ZR';
			break;
		case 'playstation':
		default:
			return btn;
	}
	return btn;
}

/** Format a chord array into a readable label (e.g. "L1 + R1" or "LB + RB"). */
export function formatChordLabel(buttons: ShoulderButtonId[], family: PadFamily = 'playstation'): string {
	return buttons.map((b) => formatShoulderButton(b, family)).join(' + ');
}
