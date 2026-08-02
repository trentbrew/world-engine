/** Threlte Sky presets — https://threlte.xyz/docs/reference/extras/sky/ */

export type SkyPresetId = 'noon' | 'afternoon' | 'sunset' | 'night';

export type SkyPreset = {
	azimuth: number;
	elevation: number;
	exposure: number;
	mieCoefficient: number;
	mieDirectionalG: number;
	rayleigh: number;
	turbidity: number;
};

export const SKY_PRESETS: Record<SkyPresetId, SkyPreset> = {
	afternoon: {
		azimuth: 180,
		elevation: 30,
		exposure: 0.65,
		mieCoefficient: 0.002,
		mieDirectionalG: 0.86,
		rayleigh: 0.3,
		turbidity: 4.78
	},
	night: {
		azimuth: 180,
		elevation: -5,
		exposure: 0.26,
		mieCoefficient: 0.038,
		mieDirectionalG: 0,
		rayleigh: 0.57,
		turbidity: 20
	},
	noon: {
		azimuth: 180,
		elevation: 85,
		exposure: 1,
		mieCoefficient: 0.013,
		mieDirectionalG: 0.7,
		rayleigh: 0.17,
		turbidity: 0.65
	},
	sunset: {
		azimuth: 180,
		elevation: 0.5,
		exposure: 0.37,
		mieCoefficient: 0.005,
		mieDirectionalG: 0.7,
		rayleigh: 3,
		turbidity: 10
	}
};

export const SKY_PRESET_LABELS: Record<SkyPresetId, string> = {
	noon: 'Noon',
	afternoon: 'Afternoon',
	sunset: 'Sunset',
	night: 'Night'
};
