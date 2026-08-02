<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import {
		AnimationMixer,
		LoopOnce,
		LoopRepeat,
		Mesh,
		Group,
		Quaternion,
		Vector3,
		type AnimationAction,
		type AnimationClip,
		type Object3D
	} from 'three';
	import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { PHYSICS_LOCAL_KEY } from '$lib/engine/physics/context';
	import { meshAnchorOffset, meshBounds, type MeshAnchor } from '$lib/engine/render/meshAnchor';
	import { resolveMeshUrl } from '$lib/engine/render/meshRef';
	import { outlineRegistry } from '$lib/engine/render/outlineRegistry.svelte';
	import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import { loadCatalog, loadGltf, resolveClip } from '$lib/engine/animation/clipCatalog';
	import { catalogSkeletonMismatch, collectBoneNames } from '$lib/engine/animation/rigFamily';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { getContext } from 'svelte';
	import { OBJECT_STAGE_KEY, type ObjectStageContext } from '$lib/scene/objectStage';

	const CROSSFADE = 0.2;
	const JUMP_CROSSFADE = 0.06;

	let { entity }: { entity: Entity } = $props();

	let transformRoot = $state<Group | undefined>();
	let object = $state<Object3D | undefined>();
	let anchorOffset = $state<[number, number, number]>([0, 0, 0]);

	// Non-reactive animation state (driven imperatively; not part of render output).
	let mixer: AnimationMixer | undefined;
	let currentAction: AnimationAction | undefined;
	let embeddedClips: AnimationClip[] = [];
	let appliedClip = '';
	// Root-motion tracking: the root bone's last local pose + its action time.
	let rootBone: Object3D | undefined;
	let prevRoot: Vector3 | null = null;
	let lastActionTime = 0;
	const _delta = new Vector3();
	const _v = new Vector3();
	const _q = new Quaternion();

	const skin = $derived(
		comp<{
			mesh?: string;
			anchor?: MeshAnchor;
			color?: string;
			forwardYaw?: number;
			castShadow?: boolean;
			receiveShadow?: boolean;
		}>(entity, 'SkinnedMesh') ?? {}
	);
	const anim = $derived(
		comp<{
			catalog?: string;
			clip?: string;
			speed?: number;
			loop?: boolean;
			playing?: boolean;
			rootMotion?: boolean;
		}>(entity, 'Mesh3DAnimator') ?? {}
	);

	const physicsLocal = getContext<boolean>(PHYSICS_LOCAL_KEY) ?? false;
	const objectStage = getContext<ObjectStageContext | undefined>(OBJECT_STAGE_KEY);
	const pos = $derived<[number, number, number]>(
		objectStage?.atOrigin ? [0, 0, 0] : physicsLocal ? [0, 0, 0] : position(entity)
	);
	const rot = $derived<[number, number, number, number]>(
		objectStage?.atOrigin ? [0, 0, 0, 1] : physicsLocal ? [0, 0, 0, 1] : rotationQuat(entity)
	);
	const scale = $derived<[number, number, number]>(
		objectStage?.atOrigin ? [1, 1, 1] : physicsLocal ? [1, 1, 1] : scaleVec(entity)
	);

	const rigYaw = $derived(((skin.forwardYaw ?? 0) * Math.PI) / 180);
	const meshUrl = $derived(skin.mesh ? resolveMeshUrl(skin.mesh) : '');
	const anchor = $derived<MeshAnchor>(skin.anchor ?? 'bottom');
	const catalogRef = $derived(anim.catalog ?? 'catalog:mesh2motion-human');
	const clip = $derived(
		objectStage && ui.previewAnimClip ? ui.previewAnimClip : (anim.clip ?? 'Idle_Loop')
	);
	const speed = $derived(anim.speed ?? 1);
	const loop = $derived(anim.loop ?? true);
	const playing = $derived(
		objectStage ? ui.objectPreviewPlaying : (anim.playing ?? true)
	);
	const rootMotion = $derived(anim.rootMotion ?? false);

	const pick = $derived(pickHandlers(entity.id));
	const showTransformGizmo = $derived(
		!objectStage &&
			ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			!physicsLocal &&
			world.selection === entity.id &&
			world.canTransformEntity(entity.id)
	);

	function disposeAnim() {
		mixer?.stopAllAction();
		mixer = undefined;
		currentAction = undefined;
		appliedClip = '';
	}

	// Load + clone the skinned GLB when the mesh url changes. Each entity gets its
	// own skeleton via SkeletonUtils.clone so instances animate independently.
	$effect(() => {
		const url = meshUrl;
		let cancelled = false;
		disposeAnim();
		object = undefined;
		if (!url) return;

		loadGltf(url)
			.then(async (gltf) => {
				if (cancelled) return;
				const cloned = skeletonClone(gltf.scene);
				embeddedClips = gltf.animations ?? [];
				// Root-motion bone (catalog declares it; M2M human = "root").
				const cat = await loadCatalog(catalogRef).catch(() => undefined);
				if (cancelled) return;
				rootBone = cloned.getObjectByName(cat?.rootBone ?? 'root') ?? undefined;
				prevRoot = null;
				lastActionTime = 0;
				const cast = (skin.castShadow ?? true) && ui.scene.shadows;
				const receive = (skin.receiveShadow ?? true) && ui.scene.shadows;
				cloned.traverse((o) => {
					if ((o as Mesh).isMesh) {
						o.castShadow = cast;
						o.receiveShadow = receive;
					}
				});
				anchorOffset = meshAnchorOffset(cloned, anchor);
				renderBounds.set(entity.id, meshBounds(cloned, anchor));
				const bones = collectBoneNames(cloned);
				const mismatch = catalogSkeletonMismatch(catalogRef, bones);
				if (mismatch) {
					const base = meshUrl.split('/').pop() ?? meshUrl;
					console.warn(
						`[skinned] ${base}: catalog expects ${mismatch.expected} skeleton but mesh is ${mismatch.actual}. ` +
							`Retarget via Mesh2Motion (https://mesh2motion.org/) or run: node scripts/audit-characters.mjs`
					);
				}
				mixer = new AnimationMixer(cloned);
				object = cloned;
				void applyClip(clip, catalogRef);
			})
			.catch((err) => console.warn(`[skinned] load failed for ${url}`, err));

		return () => {
			cancelled = true;
			renderBounds.clear(entity.id);
			disposeAnim();
		};
	});

	// Crossfade to a new clip when clip / catalog changes (after the mixer exists).
	$effect(() => {
		const target = clip;
		const cat = catalogRef;
		if (mixer && target !== appliedClip) void applyClip(target, cat);
	});

	async function applyClip(clipName: string, cat: string) {
		const m = mixer;
		if (!m) return;
		const resolved = await resolveClip(cat, clipName, embeddedClips);
		if (!resolved || m !== mixer) return; // reloaded meanwhile
		const next = m.clipAction(resolved);
		next.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
		next.clampWhenFinished = !loop;
		next.enabled = true;
		const fade = clipName.startsWith('Jump_') ? JUMP_CROSSFADE : CROSSFADE;
		next.reset().setEffectiveWeight(1).fadeIn(fade).play();
		if (currentAction && currentAction !== next) currentAction.fadeOut(fade);
		currentAction = next;
		appliedClip = clipName;
		// New clip → restart root-motion tracking so we don't apply a cross-clip jump.
		prevRoot = null;
		lastActionTime = 0;
	}

	// Seek requests from the Objects playback bar (scrub while paused or mid-play).
	$effect(() => {
		const seek = ui.previewAnimSeek;
		if (!objectStage || seek == null || !currentAction) return;
		currentAction.time = seek;
		mixer?.update(0);
		ui.previewAnimTime = seek;
		ui.previewAnimDuration = currentAction.getClip().duration || 0;
		queueMicrotask(() => ui.clearPreviewAnimSeek());
	});

	// Advance the mixer on the render loop (runs in edit mode too, for preview).
	useTask((delta) => {
		if (!mixer) return;
		if (objectStage) {
			if (playing) mixer.update(delta * speed);
			if (currentAction) {
				ui.previewAnimTime = currentAction.time;
				ui.previewAnimDuration = currentAction.getClip().duration || 0;
			}
			return;
		}
		if (!playing) return;
		mixer.update(delta * speed);
		if (rootMotion && rootBone && object && currentAction && ui.shellMode === 'play')
			applyRootMotion();
	});

	/**
	 * Consume the root bone's per-frame horizontal travel into the entity Transform.
	 * The bone's XZ is zeroed on every client so the mesh stays centered on its
	 * origin; only the owner writes the delta to Transform.position (peers receive
	 * it via sync). Loop wraps (action time resets) are skipped so the clip's
	 * end→start jump never teleports the character.
	 */
	function applyRootMotion() {
		const root = rootBone!;
		const host = object!;
		const at = currentAction!.time;
		// Root bone position in the character's own frame — independent of where the
		// entity sits, and folding in any baked GLB/armature orientation.
		const cur = host.worldToLocal(root.getWorldPosition(_v));
		if (prevRoot && at >= lastActionTime && world.isOwner(entity.id)) {
			const dx = cur.x - prevRoot.x;
			const dz = cur.z - prevRoot.z;
			if (dx !== 0 || dz !== 0) {
				// character-local delta → world via the mesh's true world orientation
				// (entity rotation × baked orientation), so a turned character travels
				// along its actual facing.
				_delta.set(dx, 0, dz).applyQuaternion(host.getWorldQuaternion(_q));
				const p = position(entity);
				world.applyFieldLocal(entity.id, 'Transform', 'position', [
					p[0] + _delta.x,
					p[1],
					p[2] + _delta.z
				]);
			}
		}
		(prevRoot ??= new Vector3()).copy(cur);
		lastActionTime = at;
		root.position.x = 0;
		root.position.z = 0;
	}

	// Drive the transform root from world state while the gizmo is inactive.
	$effect(() => {
		if (!transformRoot || showTransformGizmo) return;
		transformRoot.position.set(pos[0], pos[1], pos[2]);
		transformRoot.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
	});

	$effect(() => {
		if (!object) return;
		const meshes: Mesh[] = [];
		object.traverse((child) => {
			if (child instanceof Mesh) meshes.push(child);
		});
		const unsubs = meshes.map((mesh) => outlineRegistry.register(entity.id, mesh));
		return () => {
			for (const unsub of unsubs) unsub();
		};
	});
</script>

{#if object}
	<T.Group bind:ref={transformRoot} position={pos} {scale}>
		{#if physicsLocal && rigYaw !== 0}
			<T.Group rotation.y={rigYaw}>
				<T is={object} position={anchorOffset} {...pick} />
			</T.Group>
		{:else}
			<T is={object} position={anchorOffset} {...pick} />
		{/if}
	</T.Group>
{/if}

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
