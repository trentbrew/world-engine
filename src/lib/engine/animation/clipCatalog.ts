/**
 * Clip catalog loader — resolves a clip *name* to a Three.js `AnimationClip`,
 * checking clips embedded in the character's own GLB first, then the shared
 * animation packs declared by the catalog. Every GLB loads through one
 * URL-keyed cache, so two characters sharing a mesh or a pack never double-fetch
 * (Phase 1 acceptance: "share catalog GLBs without duplicate payload").
 *
 * See docs/artifacts/skinned_mesh_animation_spec.md.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createConfiguredGltfLoader } from '$lib/engine/render/configureGltfLoader';
import type { AnimationClip } from 'three';

export interface CatalogClip {
	id: string;
	category?: string;
	/** Pack key in `packs` that holds this clip. */
	file?: string;
	dur?: number;
	loop?: boolean;
	rootMotion?: boolean;
	/** Optional author-facing blurb; falls back to clipSemantics.describeClip. */
	description?: string;
}

export type LocomotionBindingKey =
	| 'idle'
	| 'walk'
	| 'jog'
	| 'run'
	| 'sprint'
	| 'jumpStart'
	| 'jumpLoop'
	| 'jumpLand'
	| 'doubleJumpStart'
	| 'doubleJumpLoop'
	| 'doubleJumpLand';

export type LocomotionBindings = Record<LocomotionBindingKey, string>;

export interface LocomotionBindingPack {
	bindings: LocomotionBindings;
	/** Whether a clip id should loop (from catalog clip metadata). */
	clipLoop: (clipId: string) => boolean;
}

export interface ClipCatalog {
	'@id': string;
	name?: string;
	rig?: string;
	source?: string;
	/** Bone carrying locomotion travel for root-motion clips. */
	rootBone?: string;
	hipBone?: string;
	/** Short key → GLB url of a shared animation pack. */
	packs?: Record<string, string>;
	/** Semantic locomotion tier / jump phase → clip id. */
	locomotion?: Partial<LocomotionBindings>;
	clips?: CatalogClip[];
}

/** Mesh2motion human defaults — used when a catalog omits keys. */
export const M2M_HUMAN_LOCOMOTION: LocomotionBindings = {
	idle: 'Idle_Loop',
	walk: 'Walk_Loop',
	jog: 'Jog_Fwd_Loop',
	run: 'Sprint_Loop',
	sprint: 'Sprint_Loop',
	jumpStart: 'Jump_Start',
	jumpLoop: 'Jump_Loop',
	jumpLand: 'Jump_Land',
	doubleJumpStart: 'NinjaJump_Start',
	doubleJumpLoop: 'NinjaJump_Idle_Loop',
	doubleJumpLand: 'NinjaJump_Land'
};

export const LOCOMOTION_BINDING_KEYS: LocomotionBindingKey[] = [
	'idle',
	'walk',
	'jog',
	'run',
	'sprint',
	'jumpStart',
	'jumpLoop',
	'jumpLand',
	'doubleJumpStart',
	'doubleJumpLoop',
	'doubleJumpLand'
];

const locomotionPackCache = new Map<string, Promise<LocomotionBindingPack>>();

function mergeLocomotionBindings(catalog: ClipCatalog): LocomotionBindings {
	const partial = catalog.locomotion ?? {};
	const useM2mFallback = catalog['@id'] === 'catalog:mesh2motion-human';
	const out = {} as LocomotionBindings;
	for (const key of LOCOMOTION_BINDING_KEYS) {
		const declared = partial[key];
		if (declared) {
			out[key] = declared;
			continue;
		}
		if (useM2mFallback) {
			out[key] = M2M_HUMAN_LOCOMOTION[key];
			continue;
		}
		console.warn(
			`[catalog] ${catalog['@id']} missing locomotion.${key}, using mesh2motion fallback`
		);
		out[key] = M2M_HUMAN_LOCOMOTION[key];
	}
	return out;
}

/** Coerce a type/entity locomotion override bag — unknown keys ignored; empty = catalog-only. */
export function parseLocomotionOverride(raw: unknown): Partial<LocomotionBindings> {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const out: Partial<LocomotionBindings> = {};
	for (const key of LOCOMOTION_BINDING_KEYS) {
		const value = (raw as Record<string, unknown>)[key];
		if (typeof value === 'string' && value.trim()) out[key] = value.trim();
	}
	return out;
}

/** Apply type/entity override on top of a catalog binding map (override wins per key). */
export function applyLocomotionOverride(
	bindings: LocomotionBindings,
	override: Partial<LocomotionBindings>
): LocomotionBindings {
	const out = { ...bindings };
	for (const key of LOCOMOTION_BINDING_KEYS) {
		const next = override[key];
		if (next) out[key] = next;
	}
	return out;
}

/** Load semantic locomotion bindings for a catalog ref (cached). */
export function getLocomotionBindings(ref: string): Promise<LocomotionBindingPack> {
	let p = locomotionPackCache.get(ref);
	if (!p) {
		p = loadCatalog(ref).then((catalog) => {
			const bindings = mergeLocomotionBindings(catalog);
			const meta = new Map(
				(catalog.clips ?? []).map((c) => [c.id, c.loop ?? !c.id.startsWith('Jump_')])
			);
			const clipLoop = (clipId: string): boolean => {
				if (meta.has(clipId)) return meta.get(clipId)!;
				if (
					clipId === bindings.jumpStart ||
					clipId === bindings.jumpLand ||
					clipId === bindings.doubleJumpStart ||
					clipId === bindings.doubleJumpLand
				) {
					return false;
				}
				return true;
			};
			return { bindings, clipLoop };
		});
		locomotionPackCache.set(ref, p);
	}
	return p;
}

const loader = createConfiguredGltfLoader();
const gltfCache = new Map<string, Promise<GLTF>>();
const catalogCache = new Map<string, Promise<ClipCatalog>>();

/** `catalog:foo` → `/catalogs/foo.json`; a plain path/url passes through. */
export function catalogRefToUrl(ref: string): string {
	return ref.startsWith('catalog:') ? `/catalogs/${ref.slice('catalog:'.length)}.json` : ref;
}

/** Load (and cache) a GLB by url. Shared across character meshes and clip packs. */
export function loadGltf(url: string): Promise<GLTF> {
	let p = gltfCache.get(url);
	if (!p) {
		p = loader.loadAsync(url);
		gltfCache.set(url, p);
	}
	return p;
}

/** Load (and cache) a clip catalog by ref or url. */
export function loadCatalog(ref: string): Promise<ClipCatalog> {
	const url = catalogRefToUrl(ref);
	let p = catalogCache.get(url);
	if (!p) {
		p = fetch(url).then((r) => {
			if (!r.ok) throw new Error(`catalog ${url}: ${r.status}`);
			return r.json() as Promise<ClipCatalog>;
		});
		catalogCache.set(url, p);
	}
	return p;
}

const byName = (clips: AnimationClip[], name: string): AnimationClip | undefined =>
	clips.find((c) => c.name === name);

/**
 * Resolve a clip name to an `AnimationClip`.
 * Order: embedded clips (from the character GLB) → the catalog's declared pack →
 * any pack as a fallback. Returns `undefined` if the clip exists nowhere.
 */
export async function resolveClip(
	catalogRef: string,
	clipId: string,
	embedded: AnimationClip[] = []
): Promise<AnimationClip | undefined> {
	// 1. embedded in the character's own mesh GLB
	const local = byName(embedded, clipId);
	if (local) return local;

	// 2. shared pack declared by the catalog
	const catalog = await loadCatalog(catalogRef).catch(() => undefined);
	if (!catalog?.packs) return undefined;

	const declared = catalog.clips?.find((c) => c.id === clipId)?.file;
	const packUrl = declared ? catalog.packs[declared] : undefined;
	if (packUrl) {
		const gltf = await loadGltf(packUrl).catch(() => undefined);
		const found = gltf && byName(gltf.animations, clipId);
		if (found) return found;
	}

	// 3. fallback: scan every pack (clip not declared or in an unexpected file)
	for (const url of Object.values(catalog.packs)) {
		if (url === packUrl) continue;
		const gltf = await loadGltf(url).catch(() => undefined);
		const found = gltf && byName(gltf.animations, clipId);
		if (found) return found;
	}
	return undefined;
}

/**
 * True if a model GLB is a skinned character — carries a `SkinnedMesh` or embedded
 * clips. Used by placement to route a dropped rigged GLB to a `Character` (animated)
 * instead of a `Prop` (static). Loads through the shared cache, so the subsequent
 * SkinnedMeshView load is free.
 */
export async function isRiggedModel(url: string): Promise<boolean> {
	const gltf = await loadGltf(url).catch(() => null);
	if (!gltf) return false;
	if (gltf.animations?.length) return true;
	let rigged = false;
	gltf.scene.traverse((o) => {
		if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) rigged = true;
	});
	return rigged;
}

/** Catalog metadata (loop/dur/rootMotion/…) for a clip, if declared. */
export async function getClipMeta(
	catalogRef: string,
	clipId: string
): Promise<CatalogClip | undefined> {
	const catalog = await loadCatalog(catalogRef).catch(() => undefined);
	return catalog?.clips?.find((c) => c.id === clipId);
}
