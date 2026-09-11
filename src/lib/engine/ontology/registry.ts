/**
 * The ontology registry — the single source of truth for what entity types and
 * components exist, and which Svelte view renders each component.
 *
 * Built-in component schemas + entity types are registered here as pure data.
 * Concrete views are registered separately by the render layer
 * (see `render/registerViews.ts`) so the ontology stays free of `.svelte` deps.
 *
 * Agents extend the world by adding ComponentSchema / EntityType nodes to the
 * JSON-LD graph (merged in at load time) — not by editing this file.
 */
import type { Component } from 'svelte';
import type { ComponentSchema, EntityType, FieldSchema } from './schema';

const componentSchemas = new Map<string, ComponentSchema>();
const entityTypes = new Map<string, EntityType>();
const views = new Map<string, Component<{ entity: import('./schema').Entity }>>();

// ---- component schemas -----------------------------------------------------

/** Engine vocabulary — not editable via the schema UI. */
export const BUILTIN_COMPONENT_NAMES: ReadonlySet<string> = new Set([
	'Transform',
	'Render',
	'Light',
	'Marker',
	'Ground',
	'GrassField',
	'Water',
	'Terrain',
	'Surface',
	'EditorScene',
	'WorldProfile',
	'Sprite',
	'Animator',
	'Sort',
	'Alarm',
	'Collision',
	'Camera2D',
	'SkinnedMesh',
	'Mesh3DAnimator',
	'Physics',
	'Gravity',
	'Collectible',
	'Jump',
	'Player'
]);

export function isBuiltinComponent(name: string): boolean {
	return BUILTIN_COMPONENT_NAMES.has(name);
}

export function isEditableComponent(name: string): boolean {
	return componentSchemas.has(name) && !isBuiltinComponent(name);
}

export function registerComponent(schema: ComponentSchema): void {
	const existing = componentSchemas.get(schema.name);
	if (existing) {
		componentSchemas.set(schema.name, {
			name: schema.name,
			fields: { ...existing.fields, ...schema.fields },
			// A later partial re-registration must not silently drop the doc.
			doc: schema.doc ?? existing.doc
		});
		return;
	}
	componentSchemas.set(schema.name, schema);
}

/**
 * Replace a component's full field set (authoritative). Unlike `registerComponent`
 * (which merges), this removes fields absent from `fields` — the apply path for
 * `defineComponent` patches, which always carry the complete schema.
 */
export function setComponentSchema(name: string, fields: Record<string, FieldSchema>): void {
	componentSchemas.set(name, { name, fields: structuredClone(fields) });
}

export function getComponent(name: string): ComponentSchema | undefined {
	return componentSchemas.get(name);
}

export function hasComponent(name: string): boolean {
	return componentSchemas.has(name);
}

/** All registered component names (built-in + world-file schemas). */
export function listComponents(): string[] {
	return [...componentSchemas.keys()].sort((a, b) => a.localeCompare(b));
}

/** Field names on a component flagged `sync: 'realtime'` — what goes on the wire. */
export function realtimeFields(componentName: string): string[] {
	const schema = componentSchemas.get(componentName);
	if (!schema) return [];
	return Object.entries(schema.fields)
		.filter(([, spec]) => spec.sync === 'realtime')
		.map(([name]) => name);
}

// ---- entity types ----------------------------------------------------------

export function registerType(type: EntityType): void {
	entityTypes.set(type.name, type);
}

export function getType(name: string): EntityType | undefined {
	return entityTypes.get(name);
}

/** Built-in registry types — not overwritable via Save as type. */
export const BUILTIN_TYPE_NAMES: ReadonlySet<string> = new Set([
	'GroundPlane',
	'GrassField',
	'WaterSurface',
	'Terrain',
	'Prop',
	'SpriteProp',
	'SpawnPoint',
	'AmbientLight',
	'DirectionalLight',
	'Player',
	'Character'
]);

export function listTypes(): string[] {
	return [...entityTypes.keys()].sort((a, b) => a.localeCompare(b));
}

export function isBuiltinType(name: string): boolean {
	return BUILTIN_TYPE_NAMES.has(name);
}

/** World-authored types (excludes built-in registry entries). */
export function listWorldTypes(): string[] {
	return listTypes().filter((name) => !isBuiltinType(name));
}

/** Whether a registered type is a Collection (instances are game-global records). */
export function isCollection(name: string): boolean {
	return entityTypes.get(name)?.collection === true;
}

/** Registered collection type names, sorted. */
export function listCollections(): string[] {
	return listTypes().filter((name) => isCollection(name));
}

/** Game object types (excludes collections). */
export function listObjectTypes(): string[] {
	return listTypes().filter((name) => !isCollection(name));
}

// ---- component views -------------------------------------------------------

export function registerView(
	componentName: string,
	view: Component<{ entity: import('./schema').Entity }>
): void {
	views.set(componentName, view);
}

export function getView(
	componentName: string
): Component<{ entity: import('./schema').Entity }> | undefined {
	return views.get(componentName);
}

/** Component names on an entity that have a renderable view, in stable order. */
export function viewComponentsFor(componentNames: Iterable<string>): string[] {
	return [...componentNames].filter((name) => views.has(name));
}

// ---- built-in vocabulary ---------------------------------------------------

registerComponent({
	name: 'Transform',
	fields: {
		position: { t: 'vec3', sync: 'realtime', default: [0, 0, 0] },
		rotation: { t: 'quat', sync: 'realtime' },
		scale: { t: 'vec3', sync: 'durable', default: [1, 1, 1] }
	}
});

registerComponent({
	name: 'Render',
	fields: {
		mesh: { t: 'ref', default: 'primitive:box' },
		color: { t: 'color', default: '#d4d4d4' },
		anchor: { t: 'string', default: 'bottom' },
		/**
		 * Self-lit colour. Unset leaves the material unlit-free (emissive black), which is
		 * the historical behaviour. The composer renders to a half-float buffer and
		 * tone-maps *after* bloom, so an `emissiveIntensity` above 1 genuinely clears
		 * `bloom.threshold` — that is what makes a neon world glow rather than just look
		 * bright. See ViewportComposer.svelte.
		 */
		emissive: { t: 'color' },
		emissiveIntensity: { t: 'number', default: 1 },
		/** Diffuse texture URL for primitive meshes (Frame Shift art frames, etc.). */
		map: { t: 'ref' },
		visible: { t: 'boolean', default: true },
		/**
		 * Delay GLTF / map load until the first Gaussian splat reports ready.
		 * Used by Frame Shift heavy props so the hall SPZ paints first.
		 */
		deferUntilSplat: { t: 'boolean', default: false }
	}
});

registerComponent({
	name: 'Light',
	fields: {
		kind: { t: 'string', default: 'ambient' },
		intensity: { t: 'number', default: 1 },
		color: { t: 'color', default: '#ffffff' },
		// Shadow controls for `kind: 'directional'`. Defaults deliberately match
		// three's own, so adding these changes no existing world's appearance.
		//
		// They exist because a large surface needs a shadow camera to match: three
		// defaults the directional shadow to an ortho frustum of ±5 world units,
		// so anything bigger (a 24-unit grass field, say) falls outside it and
		// loses its shadows entirely.
		shadowMapSize: { t: 'number', default: 1024 },
		/** Half-extent of the shadow camera's ortho frustum, in world units. */
		shadowCamSize: { t: 'number', default: 5 },
		shadowBias: { t: 'number', default: 0 },
		/** Offsets along the normal — the practical fix for acne on thin geometry. */
		shadowNormalBias: { t: 'number', default: 0 }
	}
});

/** Photoscanned Gaussian splat set-piece (World Labs / `.spz` hall backdrops). */
registerComponent({
	name: 'GaussianSplat',
	fields: {
		src: { t: 'ref', default: '/splats/nike.splat' },
		alphaTest: { t: 'number', default: 0.1 },
		toneMapped: { t: 'boolean', default: true },
		metricScale: { t: 'number', default: 1 },
		/** Extra `.spz` URLs to soft-cache after the primary `src` initializes (era swap). */
		prefetch: { t: 'json', sync: 'durable' }
	}
});

/** Frame Shift museum — host-synced decade authority for era dial + backdrop swap. */
registerComponent({
	name: 'MuseumEra',
	fields: {
		decade: { t: 'number', sync: 'realtime', default: 1890 }
	}
});

/** Frame Shift — show/hide entities by active museum decade. */
registerComponent({
	name: 'EraGate',
	fields: {
		decade: { t: 'number', default: 1890, sync: 'durable' }
	}
});

/** Frame Shift — proximity plaque metadata for sonner toasts. */
registerComponent({
	name: 'Plaque',
	fields: {
		title: { t: 'string', default: 'Untitled', sync: 'durable' },
		artist: { t: 'string', default: 'Unknown', sync: 'durable' },
		year: { t: 'string', default: '', sync: 'durable' },
		radius: { t: 'number', default: 2.5, sync: 'durable' }
	}
});

registerComponent({
	name: 'Marker',
	fields: {
		kind: { t: 'string', default: 'spawn' }
	}
});

registerComponent({
	name: 'Ground',
	fields: {
		size: { t: 'number', default: 20 },
		color: { t: 'color', default: '#80808080' }
	}
});

/**
 * Stylized grass field — instanced blades over a ground surface.
 *
 * Fourteen curated knobs, plus `params` as an escape hatch to the ~100 the
 * shader actually exposes (see engine/render/grass/params.ts). Flat fields for
 * everything worth an inspector row and an agent tool; the long tail rides in
 * the json bag, the same shape Mesh3DAnimator.locomotion uses. Putting all 98
 * here would make the inspector unusable and blow describe_component's 500-char
 * budget.
 *
 * `model` is optional: with no GLB the field builds its own ground plane of
 * `size` and scatters onto that, so a world can have grass with zero assets.
 *
 * All durable — this is authored geometry, not per-frame state. Animate wind
 * with a formula (`"windStrength": "=0.1 + sin(t * 0.3) * 0.05"`) rather than a
 * realtime field, which would put it on the wire every frame.
 */
registerComponent({
	name: 'GrassField',
	fields: {
		model: { t: 'ref', of: { kind: 'asset' }, optional: true },
		size: { t: 'number', default: 20 },
		preset: { t: 'select', options: ['default', 'autumn', 'mars'], default: 'default' },
		groundMesh: { t: 'string', default: 'grass-floor' },
		/**
		 * Cross-entity scatter surface: entity id whose mounted mesh blades
		 * scatter onto instead of this field's own ground. Resolved through
		 * the scatter-surface registry; unknown ids warn-and-skip.
		 */
		surfaceEntity: { t: 'string', optional: true },
		density: { t: 'number', default: 120 },
		maxCount: { t: 'number', default: 24000 },
		bladeMinLength: { t: 'number', default: 0.15 },
		bladeMaxLength: { t: 'number', default: 0.25 },
		colorBottom: { t: 'color', default: '#4f7c13' },
		colorTop: { t: 'color', default: '#79a01c' },
		windStrength: { t: 'number', default: 0.1 },
		windDirection: { t: 'number', default: 243 },
		windSpeed: { t: 'number', default: 1.3 },
		/** Freeze wind in edit mode. On by default — see GrassFieldView. */
		stillInEdit: { t: 'boolean', default: true },
		/** Full GrassParams overrides, applied last. */
		params: { t: 'json', optional: true }
	}
});

/**
 * Cel-shaded water surface. See WaterSurfaceView / render/water/waterSurface.ts.
 *
 * SCOPED DOWN from upstream (waterFloor): the GPU wave simulation, sparkles,
 * depth-intersection band, seabed and shadow-catcher are NOT ported — they either
 * own their own clock or live in a module-level singleton, both of which fight
 * this engine's entity model. Only the Voronoi surface material is here, and the
 * ripple uniforms it reads stay at count 0 (nothing emits ripples yet).
 *
 * All durable. Flow is animated by the view in play mode (or `stillInEdit: false`);
 * the surface itself is authored geometry, so a realtime field would flood the
 * relay for no gain.
 */
registerComponent({
	name: 'Water',
	fields: {
		size: { t: 'number', default: 40 },
		/** Follow the camera in XZ so the surface reads as an endless ocean. */
		infinite: { t: 'boolean', default: false },
		/** Animate flow in edit mode too. On by default off — see WaterSurfaceView. */
		stillInEdit: { t: 'boolean', default: true },
		/** Let players and `WaterRipple` entities disturb this surface. */
		ripples: { t: 'boolean', default: true },
		/** Full WaterParams overrides, applied last. */
		params: { t: 'json', optional: true }
	}
});

/**
 * Displaced terrain — a seeded procedural heightmap driving a vertex-colored
 * mesh and a matching trimesh collider. See TerrainView / render/terrain/terrain.ts.
 *
 * This is the height-variance the engine lacked: `Ground` is a flat plane, and
 * "infinite water at sea level" is meaningless without hills. An agent composes
 * hills with three numbers (seed, heightScale, noiseScale); the collider is
 * derived from the mesh's own vertices so physics can never drift from visuals.
 *
 * All durable — the heightmap is deterministic from `seed`, not authored state.
 */
registerComponent({
	name: 'Terrain',
	fields: {
		size: { t: 'number', default: 60 },
		segments: { t: 'number', default: 128 },
		heightScale: { t: 'number', default: 4 },
		baseHeight: { t: 'number', default: 0 },
		noiseScale: { t: 'number', default: 0.05 },
		octaves: { t: 'number', default: 4 },
		seed: { t: 'number', default: 1337 },
		color: { t: 'color', default: '#5a7a3a' },
		colorLow: { t: 'color', default: '#3f6a34' },
		colorHigh: { t: 'color', default: '#8a9a54' },
		colorRange: { t: 'number', default: 6 },
		/**
		 * Sink the rim toward `seabedY` so the plane reads as an island rather than
		 * a square slab floating in an ocean. Off by default.
		 */
		island: { t: 'boolean', default: false },
		islandInner: { t: 'number', default: 0.55 },
		islandOuter: { t: 'number', default: 0.92 },
		seabedY: { t: 'number', default: -4 },
		/**
		 * Tint vertices below `waterY` toward `underwaterColor`, so an `island`
		 * rim that sinks under the water plane reads as submerged.
		 *
		 * Replaces `Terrain.infinite`, which additionally tracked the camera in
		 * XZ the way `Water.infinite` does. That is sound for water — a flat
		 * plane is translation-invariant — but not for terrain, whose heights
		 * are baked into geometry in local space: translating the mesh drags
		 * the landscape along with the viewer and desyncs the trimesh collider.
		 * Legacy `infinite: true` still maps to this flag; endless terrain needs
		 * cell-snapped chunks, not a sliding plane.
		 */
		underwaterTint: { t: 'boolean', default: false },
		/**
		 * World Y of the water surface. Vertices below this are tinted
		 * `underwaterColor` so submerged land reads as underwater.
		 */
		waterY: { t: 'number', default: 0 },
		/**
		 * Tint applied to terrain vertices below `waterY` when
		 * `underwaterColor` is set.
		 */
		underwaterColor: { t: 'color', default: '#1a5276' },
		/**
		 * Optional grass overlay scattered onto the terrain's own heightmap.
		 * `enabled` gates it (default off); the rest map onto GrassParams curated
		 * fields, with `params` as the escape hatch.
		 */
		grass: {
			t: 'json',
			optional: true
		}
	}
});

registerComponent({
	name: 'Surface',
	fields: {
		kind: {
			t: 'select',
			options: ['grass', 'dirt', 'sand', 'stone', 'wood', 'metal', 'snow', 'water', 'floor', 'default'],
			default: 'default'
		},
		sfxBase: { t: 'ref', optional: true, sync: 'durable' },
		sfxVol: { t: 'number', default: 0, sync: 'durable' },
		variantCount: { t: 'number', default: 5, sync: 'durable' }
	}
});

/** Authoring-only scene tab config (not rendered). */
registerComponent({
	name: 'EditorScene',
	fields: {
		document: { t: 'json', sync: 'durable' }
	}
});

/** World-level dimension / play-plane switch (see docs/artifacts/world_profile_2d_spec.md). */
registerComponent({
	name: 'WorldProfile',
	fields: {
		dimensions: { t: 'string', default: '3d' },
		plane: { t: 'string', default: 'xz' },
		unit: { t: 'string', default: 'meter' },
		pixelsPerUnit: { t: 'number', default: 64 },
		gravity: { t: 'vec3', default: [0, -9.81, 0] }
	}
});

/** Billboard / sprite-sheet quad (2D-in-3D or true 2D worlds). */
registerComponent({
	name: 'Sprite',
	fields: {
		texture: { t: 'ref', default: '/logo.png' },
		frame: { t: 'json', default: [0, 0, 64, 64] },
		anchor: { t: 'string', default: 'bottom' },
		sortKey: { t: 'number', default: 0 },
		flipX: { t: 'boolean', default: false },
		color: { t: 'color', default: '#ffffff' },
		mask: { t: 'string', default: 'box' }
	}
});

/** Sprite-sheet animation parameters — frame index derived via formulaSystem. */
registerComponent({
	name: 'Animator',
	fields: {
		fps: { t: 'number', default: 8 },
		frameCount: { t: 'number', default: 1 },
		columns: { t: 'number', default: 1 },
		frameWidth: { t: 'number', default: 64 },
		frameHeight: { t: 'number', default: 64 },
		frameIndex: {
			t: 'number',
			sync: 'derived',
			default: '=floor(t * fps) % max(frameCount, 1)'
		}
	}
});

/** Explicit draw-order layer for 2D entities (lower draws first). */
registerComponent({
	name: 'Sort',
	fields: {
		order: { t: 'number', default: 0 }
	}
});

/** Owner-local countdown timers for GameMaker alarm events (runtime-only, not synced). */
registerComponent({
	name: 'Alarm',
	fields: Object.fromEntries(
		Array.from({ length: 12 }, (_, i) => [`t${i}`, { t: 'number', default: -1 }])
	)
});

/** XZ proximity radius for collision event dispatch (runtime-only probe). */
registerComponent({
	name: 'Collision',
	fields: {
		radius: { t: 'number', default: 0.5 },
		mask: { t: 'string', default: 'circle_xz' }
	}
});

/** 2D camera bounds / follow tuning (durable; applied in play mode). */
registerComponent({
	name: 'Camera2D',
	fields: {
		deadZoneX: { t: 'number', default: 1.2 },
		deadZoneY: { t: 'number', default: 0.8 },
		lookAhead: { t: 'number', default: 0.6 },
		zoom: { t: 'number', default: 1.6 }
	}
});

/**
 * Skinned character mesh (rigged GLB with skeleton). Renders via SkinnedMeshView.
 * Splits "what to draw" from "how it moves" — Mesh3DAnimator is the 3D counterpart
 * to Animator. See docs/artifacts/skinned_mesh_animation_spec.md.
 */
registerComponent({
	name: 'SkinnedMesh',
	fields: {
		mesh: { t: 'ref', default: '/models/characters/mannequin.glb' },
		anchor: { t: 'string', default: 'bottom' },
		rig: { t: 'string', default: 'human' },
		color: { t: 'color', default: '#ffffff' },
		/** Rig export yaw offset (deg) added to the skinned visual under PhysicsBody. */
		forwardYaw: { t: 'number', default: 0 },
		/** Multiplier on AABB-derived capsule radius (Player motor). */
		capsuleRadiusScale: { t: 'number', default: 1 },
		/** Multiplier on AABB-derived capsule halfHeight (Player motor). */
		capsuleHeightScale: { t: 'number', default: 1 },
		castShadow: { t: 'boolean', default: true },
		receiveShadow: { t: 'boolean', default: true }
	}
});

/** Clip playback for a SkinnedMesh — resolves clip name against a catalog. */
registerComponent({
	name: 'Mesh3DAnimator',
	fields: {
		catalog: { t: 'ref', default: 'catalog:mesh2motion-human' },
		clip: { t: 'string', sync: 'realtime', default: 'Idle_Loop' },
		speed: { t: 'number', default: 1 },
		loop: { t: 'boolean', default: true },
		rootMotion: { t: 'boolean', default: false },
		playing: { t: 'boolean', sync: 'realtime', default: true },
		/** Partial locomotion tier → clip id; overrides catalog map. Absent/`{}` = catalog-only. */
		locomotion: { t: 'json', sync: 'durable' }
	}
});

registerType({ name: 'GroundPlane', components: ['Transform', 'Ground'] });
registerType({ name: 'GrassField', components: ['Transform', 'GrassField'] });
registerType({ name: 'WaterSurface', components: ['Transform', 'Water'] });
registerType({ name: 'Terrain', components: ['Transform', 'Terrain'] });
registerType({ name: 'Prop', components: ['Transform', 'Render'] });
registerType({ name: 'SpriteProp', components: ['Transform', 'Sprite'] });
registerType({ name: 'SpawnPoint', components: ['Transform', 'Marker'] });
registerType({
	name: 'AmbientLight',
	components: ['Light'],
	defaults: { Light: { kind: 'ambient' } }
});
registerType({
	name: 'DirectionalLight',
	components: ['Light', 'Transform'],
	defaults: { Light: { kind: 'directional' } }
});
registerType({
	name: 'Character',
	components: ['Transform', 'SkinnedMesh', 'Mesh3DAnimator']
});
registerType({
	name: 'CharacterFemale',
	components: ['Transform', 'SkinnedMesh', 'Mesh3DAnimator'],
	defaults: {
		SkinnedMesh: {
			mesh: '/models/characters/xbot.glb',
			anchor: 'bottom',
			rig: 'human',
			forwardYaw: 0
		},
		Mesh3DAnimator: {
			catalog: 'catalog:mesh2motion-human',
			clip: 'Idle_Loop',
			speed: 1,
			loop: true,
			rootMotion: false,
			playing: true
		}
	}
});
