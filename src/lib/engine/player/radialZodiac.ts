/**
 * Radial 12-Hour Chinese Zodiac / Naruto Hand Signs mapping.
 * Clock hour positions:
 *  12:00 -> Rat (r)
 *   1:00 -> Ox (z)
 *   2:00 -> Tiger (w)
 *   3:00 -> Hare (c)
 *   4:00 -> Dragon (q)
 *   5:00 -> Serpent (x)
 *   6:00 -> Horse (s)
 *   7:00 -> Ram (a)  [Shadow Clone Jutsu!]
 *   8:00 -> Monkey (d)
 *   9:00 -> Bird (f)
 *  10:00 -> Dog (e)
 *  11:00 -> Boar (v)
 */

export const RADIAL_SECTOR_KEYS = [
	'r', // 0:  12:00 Rat (子)
	'z', // 1:   1:00 Ox (丑)
	'w', // 2:   2:00 Tiger (寅)
	'c', // 3:   3:00 Hare (卯)
	'q', // 4:   4:00 Dragon (辰)
	'x', // 5:   5:00 Serpent (巳)
	's', // 6:   6:00 Horse (午)
	'a', // 7:   7:00 Ram (未)
	'd', // 8:   8:00 Monkey (申)
	'f', // 9:   9:00 Bird (酉)
	'e', // 10: 10:00 Dog (戌)
	'v'  // 11: 11:00 Boar (亥)
] as const;

export type RadialSectorKey = (typeof RADIAL_SECTOR_KEYS)[number];

export interface RadialZodiacDef {
	sector: number;
	hour: number;
	key: RadialSectorKey;
	english: string;
	japanese: string;
	romaji: string;
	cx: number;
	cy: number;
}

export const RADIAL_ZODIAC_DEFS: RadialZodiacDef[] = [
	{ sector: 0, hour: 12, key: 'r', english: 'RAT', japanese: '子', romaji: 'Ne', cx: 100, cy: 30 },
	{ sector: 1, hour: 1, key: 'z', english: 'OX', japanese: '丑', romaji: 'Ushi', cx: 135, cy: 39.4 },
	{ sector: 2, hour: 2, key: 'w', english: 'TIGER', japanese: '寅', romaji: 'Tora', cx: 160.6, cy: 65 },
	{ sector: 3, hour: 3, key: 'c', english: 'HARE', japanese: '卯', romaji: 'U', cx: 170, cy: 100 },
	{ sector: 4, hour: 4, key: 'q', english: 'DRAGON', japanese: '辰', romaji: 'Tatsu', cx: 160.6, cy: 135 },
	{ sector: 5, hour: 5, key: 'x', english: 'SERPENT', japanese: '巳', romaji: 'Mi', cx: 135, cy: 160.6 },
	{ sector: 6, hour: 6, key: 's', english: 'HORSE', japanese: '午', romaji: 'Uma', cx: 100, cy: 170 },
	{ sector: 7, hour: 7, key: 'a', english: 'RAM', japanese: '未', romaji: 'Hitsuji', cx: 65, cy: 160.6 },
	{ sector: 8, hour: 8, key: 'd', english: 'MONKEY', japanese: '申', romaji: 'Saru', cx: 39.4, cy: 135 },
	{ sector: 9, hour: 9, key: 'f', english: 'BIRD', japanese: '酉', romaji: 'Tori', cx: 30, cy: 100 },
	{ sector: 10, hour: 10, key: 'e', english: 'DOG', japanese: '戌', romaji: 'Inu', cx: 39.4, cy: 65 },
	{ sector: 11, hour: 11, key: 'v', english: 'BOAR', japanese: '亥', romaji: 'I', cx: 65, cy: 39.4 }
];

export interface RadialStickSample {
	active: boolean; // magnitude >= 0.40
	committed: boolean; // magnitude >= 0.65
	magnitude: number;
	angleDeg: number; // 0..360 (0 = 12:00 up, 90 = 3:00 right, 180 = 6:00 down, 270 = 9:00 left)
	sector: number | null; // 0..11
	key: RadialSectorKey | null;
}

/**
 * Compute radial stick deflection and 12-hour sector from analog stick coordinates.
 * @param lx - X axis (-1 = left, +1 = right)
 * @param ly - Y axis (-1 = up, +1 = down in standard Gamepad API)
 */
export function sampleRadialStick(
	lx: number,
	ly: number,
	invertY: boolean = false
): RadialStickSample {
	const effectiveY = invertY ? -ly : ly;
	const magnitude = Math.hypot(lx, effectiveY);

	if (magnitude < 0.15) {
		return {
			active: false,
			committed: false,
			magnitude: 0,
			angleDeg: 0,
			sector: null,
			key: null
		};
	}

	// 0 deg is straight UP (-Y in screen space / Gamepad standard)
	const angleRad = Math.atan2(lx, -effectiveY);
	let angleDeg = (angleRad * 180) / Math.PI;
	if (angleDeg < 0) angleDeg += 360;

	// Each 30 deg sector is centered on its hour mark (-15 deg to +15 deg)
	const sector = Math.floor(((angleDeg + 15) % 360) / 30);
	const key = RADIAL_SECTOR_KEYS[sector] ?? null;

	return {
		active: magnitude >= 0.4,
		committed: magnitude >= 0.65,
		magnitude,
		angleDeg,
		sector: magnitude >= 0.4 ? sector : null,
		key: magnitude >= 0.4 ? key : null
	};
}
