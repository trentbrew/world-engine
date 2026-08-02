import type { SkyPresetId } from '$lib/scene/skyPresets';
import { SKY_PRESETS } from '$lib/scene/skyPresets';
import {
	ART_STYLE_LABELS,
	type ArtStyleId,
	type MaterialMode,
	type SceneStyle,
	type ToneMappingId
} from '$lib/scene/artStyles';
import {
	DEFAULT_GRID,
	DEFAULT_GROUND_GRID,
	DEFAULT_SCENE,
	type ChromeToggles,
	type GridConfig,
	type SceneSettings
} from '$lib/ui/ui.svelte';

import {
	SCENE_DOCUMENT_VERSION,
	SCENE_SETTINGS_COMPONENT,
	SCENE_SETTINGS_ENTITY_ID,
	SCENE_SETTINGS_FIELD
} from './sceneConstants';

export {
	SCENE_DOCUMENT_VERSION,
	SCENE_SETTINGS_COMPONENT,
	SCENE_SETTINGS_ENTITY_ID,
	SCENE_SETTINGS_FIELD
};

export type SceneDocument = {
	v: typeof SCENE_DOCUMENT_VERSION;
	scene: SceneSettings;
	grid: GridConfig;
	chrome: ChromeToggles;
	playCameraDefault: 'follow' | 'orbit';
};

export function defaultSceneDocument(gameTitle?: string): SceneDocument {
	return {
		v: SCENE_DOCUMENT_VERSION,
		scene: {
			...DEFAULT_SCENE,
			displayName: gameTitle?.trim() || DEFAULT_SCENE.displayName,
			groundGrid: { ...DEFAULT_GROUND_GRID },
			sky: { ...DEFAULT_SCENE.sky },
			style: structuredClone(DEFAULT_SCENE.style)
		},
		grid: { ...DEFAULT_GRID },
		chrome: {
			grid: true,
			selectionOutline: true,
			statsHud: true,
			playToolbar: false
		},
		playCameraDefault: 'follow'
	};
}

export function parseSceneDocument(raw: unknown, gameTitle?: string): SceneDocument {
	const base = defaultSceneDocument(gameTitle);
	if (!raw || typeof raw !== 'object') return base;

	const doc = raw as Partial<SceneDocument>;
	if (doc.v !== SCENE_DOCUMENT_VERSION) return base;

	const scene: Partial<SceneSettings> = doc.scene ?? {};
	const sky: Partial<SceneSettings['sky']> = scene.sky ?? {};

	return {
		v: SCENE_DOCUMENT_VERSION,
		scene: {
			displayName:
				typeof scene.displayName === 'string' && scene.displayName.trim()
					? scene.displayName.trim()
					: base.scene.displayName,
			background:
				typeof scene.background === 'string' ? scene.background : base.scene.background,
			shadows: typeof scene.shadows === 'boolean' ? scene.shadows : base.scene.shadows,
			sky: {
				enabled: typeof sky.enabled === 'boolean' ? sky.enabled : base.scene.sky.enabled,
				preset: isSkyPresetId(sky.preset) ? sky.preset : base.scene.sky.preset,
				setEnvironment:
					typeof sky.setEnvironment === 'boolean'
						? sky.setEnvironment
						: base.scene.sky.setEnvironment
			},
			groundGrid: {
				enabled:
					typeof scene.groundGrid?.enabled === 'boolean'
						? scene.groundGrid.enabled
						: base.scene.groundGrid.enabled,
				cellSize:
					typeof scene.groundGrid?.cellSize === 'number'
						? scene.groundGrid.cellSize
						: base.scene.groundGrid.cellSize,
				sectionSize:
					typeof scene.groundGrid?.sectionSize === 'number'
						? scene.groundGrid.sectionSize
						: base.scene.groundGrid.sectionSize,
				cellColor:
					typeof scene.groundGrid?.cellColor === 'string'
						? scene.groundGrid.cellColor
						: base.scene.groundGrid.cellColor,
				sectionColor:
					typeof scene.groundGrid?.sectionColor === 'string'
						? scene.groundGrid.sectionColor
						: base.scene.groundGrid.sectionColor
			},
			style: parseSceneStyle(scene.style, base.scene.style)
		},
		grid: {
			cellSize: typeof doc.grid?.cellSize === 'number' ? doc.grid.cellSize : base.grid.cellSize,
			sectionSize:
				typeof doc.grid?.sectionSize === 'number' ? doc.grid.sectionSize : base.grid.sectionSize,
			fadeDistance:
				typeof doc.grid?.fadeDistance === 'number'
					? doc.grid.fadeDistance
					: base.grid.fadeDistance,
			infinite: typeof doc.grid?.infinite === 'boolean' ? doc.grid.infinite : base.grid.infinite,
			cellColor:
				typeof doc.grid?.cellColor === 'string' ? doc.grid.cellColor : base.grid.cellColor,
			sectionColor:
				typeof doc.grid?.sectionColor === 'string'
					? doc.grid.sectionColor
					: base.grid.sectionColor
		},
		chrome: {
			grid: typeof doc.chrome?.grid === 'boolean' ? doc.chrome.grid : base.chrome.grid,
			selectionOutline:
				typeof doc.chrome?.selectionOutline === 'boolean'
					? doc.chrome.selectionOutline
					: base.chrome.selectionOutline,
			statsHud:
				typeof doc.chrome?.statsHud === 'boolean' ? doc.chrome.statsHud : base.chrome.statsHud,
			playToolbar:
				typeof doc.chrome?.playToolbar === 'boolean'
					? doc.chrome.playToolbar
					: base.chrome.playToolbar
		},
		playCameraDefault:
			doc.playCameraDefault === 'orbit' || doc.playCameraDefault === 'follow'
				? doc.playCameraDefault
				: base.playCameraDefault
	};
}

export function serializeSceneDocument(doc: SceneDocument): string {
	return JSON.stringify(doc);
}

export function sceneDocumentFromEntity(entity: {
	components: Record<string, Record<string, unknown>>;
}): SceneDocument | null {
	const bag = entity.components[SCENE_SETTINGS_COMPONENT];
	if (!bag) return null;
	return parseSceneDocument(bag[SCENE_SETTINGS_FIELD]);
}

export function storageKeyForWorld(worldKey: string): string {
	return `threlte-scene/v${SCENE_DOCUMENT_VERSION}/${worldKey}`;
}

function isSkyPresetId(value: unknown): value is SkyPresetId {
	return typeof value === 'string' && value in SKY_PRESETS;
}

const TONE_MAPPING_IDS: ToneMappingId[] = [
	'none',
	'linear',
	'reinhard',
	'cineon',
	'aces',
	'agx',
	'neutral'
];

function num(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function parseSceneStyle(raw: unknown, base: SceneStyle): SceneStyle {
	const s = (raw ?? {}) as Partial<SceneStyle>;
	const artStyle: ArtStyleId =
		typeof s.artStyle === 'string' && s.artStyle in ART_STYLE_LABELS
			? (s.artStyle as ArtStyleId)
			: base.artStyle;
	const materialMode: MaterialMode = s.materialMode === 'toon' ? 'toon' : 'standard';
	const toneMapping: ToneMappingId = TONE_MAPPING_IDS.includes(s.toneMapping as ToneMappingId)
		? (s.toneMapping as ToneMappingId)
		: base.toneMapping;

	return {
		artStyle,
		materialMode,
		toneMapping,
		exposure: num(s.exposure, base.exposure),
		fog: {
			enabled: bool(s.fog?.enabled, base.fog.enabled),
			color: str(s.fog?.color, base.fog.color),
			near: num(s.fog?.near, base.fog.near),
			far: num(s.fog?.far, base.fog.far)
		},
		bloom: {
			enabled: bool(s.bloom?.enabled, base.bloom.enabled),
			intensity: num(s.bloom?.intensity, base.bloom.intensity),
			threshold: num(s.bloom?.threshold, base.bloom.threshold)
		},
		vignette: {
			enabled: bool(s.vignette?.enabled, base.vignette.enabled),
			darkness: num(s.vignette?.darkness, base.vignette.darkness)
		},
		grain: {
			enabled: bool(s.grain?.enabled, base.grain.enabled),
			opacity: num(s.grain?.opacity, base.grain.opacity)
		},
		outline: {
			enabled: bool(s.outline?.enabled, base.outline.enabled),
			color: str(s.outline?.color, base.outline.color),
			thickness: num(s.outline?.thickness, base.outline.thickness)
		},
		sketch: {
			enabled: bool(s.sketch?.enabled, base.sketch.enabled),
			intensity: num(s.sketch?.intensity, base.sketch.intensity)
		}
	};
}

