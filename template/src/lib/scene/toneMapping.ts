import {
	ACESFilmicToneMapping,
	AgXToneMapping,
	CineonToneMapping,
	LinearToneMapping,
	NeutralToneMapping,
	NoToneMapping,
	ReinhardToneMapping,
	type ToneMapping
} from 'three';
import type { ToneMappingId } from '$lib/scene/artStyles';

export const TONE_MAPPING: Record<ToneMappingId, ToneMapping> = {
	none: NoToneMapping,
	linear: LinearToneMapping,
	reinhard: ReinhardToneMapping,
	cineon: CineonToneMapping,
	aces: ACESFilmicToneMapping,
	agx: AgXToneMapping,
	neutral: NeutralToneMapping
};
