<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { HalfFloatType, NoToneMapping, type Camera, type Mesh } from 'three';
	import {
		BloomEffect,
		BlendFunction,
		EffectComposer,
		EffectPass,
		KernelSize,
		NoiseEffect,
		OutlineEffect,
		Pass,
		RenderPass,
		ToneMappingEffect,
		ToneMappingMode,
		VignetteEffect
	} from 'postprocessing';
	import {
		hexToOutlineColor,
		outlineLayers,
		type OutlineLayer
	} from '$lib/engine/render/outlineLayers';
	import { outlineRegistry } from '$lib/engine/render/outlineRegistry.svelte';
	import { outlineStateKey } from '$lib/engine/render/outlineStateKey';
	import { OUTLINE_COMPOSER_TASK } from '$lib/scene/viewportRenderTasks';
	import { SKY_PRESETS } from '$lib/scene/skyPresets';
	import { SketchEffect } from '$lib/scene/effects/SketchEffect';
	import type { SceneStyle, ToneMappingId } from '$lib/scene/artStyles';
	import { camera as cameraStore } from '$lib/engine/render/camera.svelte';
	import { session } from '$lib/engine/net/session.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const { scene, renderer, camera, size, autoRender, autoRenderTask, renderStage, invalidate } =
		useThrelte();

	const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
	const renderPass = new RenderPass(scene);
	composer.addPass(renderPass);

	type PassSpec = {
		key: string;
		color: number;
		edgeStrength: number;
		xRay: boolean;
		meshes: Mesh[];
	};

	type ManagedPass = {
		key: string;
		effect: OutlineEffect;
		pass: EffectPass;
	};

	/** Internal pass lists — not reactive; syncing must not re-enter effects. */
	let managedPasses: ManagedPass[] = [];
	/** Scene-style post passes (art outline / bloom / grade). */
	let scenePasses: Pass[] = [];
	let toneMappingEffect: ToneMappingEffect | undefined;
	let toneMappingPass: EffectPass | undefined;
	let composerRendering = false;

	const selectionEnabled = $derived(
		(ui.shellMode === 'edit' && ui.chrome.selectionOutline) || ui.shellMode === 'play'
	);

	const outlineEffectDefaults = {
		blendFunction: BlendFunction.ALPHA,
		pulseSpeed: 0,
		blur: true,
		kernelSize: KernelSize.VERY_SMALL,
		multisampling: 0,
		resolutionScale: 1
	} as const;

	const POSTPROCESSING_TONE_MODE: Record<ToneMappingId, ToneMappingMode> = {
		none: ToneMappingMode.LINEAR,
		linear: ToneMappingMode.LINEAR,
		reinhard: ToneMappingMode.REINHARD,
		cineon: ToneMappingMode.CINEON,
		aces: ToneMappingMode.ACES_FILMIC,
		agx: ToneMappingMode.AGX,
		neutral: ToneMappingMode.NEUTRAL
	};

	function meshesForLayer(layer: OutlineLayer): Mesh[] {
		return layer.entityIds.flatMap((entityId) => outlineRegistry.get(entityId));
	}

	function createOutlineEffect(
		color: number,
		edgeStrength: number,
		xRay: boolean
	): OutlineEffect {
		return new OutlineEffect(scene, camera.current as Camera, {
			...outlineEffectDefaults,
			edgeStrength,
			xRay,
			visibleEdgeColor: color,
			hiddenEdgeColor: color
		});
	}

	function addEffect(spec: PassSpec): ManagedPass {
		const effect = createOutlineEffect(spec.color, spec.edgeStrength, spec.xRay);
		effect.selection.set(spec.meshes);
		const pass = new EffectPass(camera.current as Camera, effect);
		composer.addPass(pass);
		return { key: spec.key, effect, pass };
	}

	function removeManagedPass(managed: ManagedPass) {
		composer.removePass(managed.pass);
		managed.pass.dispose();
		managed.effect.dispose();
	}

	function clearOutlinePasses() {
		for (const managed of managedPasses) removeManagedPass(managed);
		managedPasses = [];
	}

	function ensureToneMappingPass() {
		if (toneMappingPass) return;
		toneMappingEffect = new ToneMappingEffect({
			mode: POSTPROCESSING_TONE_MODE[ui.scene.style.toneMapping]
		});
		toneMappingPass = new EffectPass(camera.current as Camera, toneMappingEffect);
		composer.addPass(toneMappingPass);
	}

	function syncToneMappingPass(style: SceneStyle) {
		ensureToneMappingPass();
		if (!toneMappingEffect) return;
		const mode = POSTPROCESSING_TONE_MODE[style.toneMapping];
		if (toneMappingEffect.mode !== mode) toneMappingEffect.mode = mode;
	}

	function updatePassCameras() {
		const cam = camera.current;
		if (!cam) return;
		renderPass.mainCamera = cam;
		for (const { effect, pass } of managedPasses) {
			pass.mainCamera = cam;
			effect.mainCamera = cam;
		}
		for (const pass of scenePasses) pass.mainCamera = cam;
		if (toneMappingPass) toneMappingPass.mainCamera = cam;
	}

	function applyPassSpec(managed: ManagedPass, spec: PassSpec) {
		const { effect } = managed;
		effect.selection.set(spec.meshes);
		effect.visibleEdgeColor.setHex(spec.color);
		effect.hiddenEdgeColor.setHex(spec.color);
		effect.edgeStrength = spec.edgeStrength;
		effect.xRay = spec.xRay;
	}

	function buildPassSpecs(): PassSpec[] {
		const specs: PassSpec[] = [];

		for (const layer of outlineLayers()) {
			const meshes = meshesForLayer(layer);
			if (meshes.length === 0) continue;

			if (!layer.emphasized) {
				// Hover / play silhouettes — colored mesh edge.
				specs.push({
					key: `${layer.id}:hover`,
					color: hexToOutlineColor(layer.color),
					edgeStrength: layer.edgeStrength ?? 3.5,
					xRay: false,
					meshes
				});
				continue;
			}

			specs.push({
				key: `${layer.id}:halo`,
				color: 0xffffff,
				edgeStrength: 6,
				xRay: true,
				meshes
			});
			if (layer.color.toLowerCase() !== '#ffffff') {
				specs.push({
					key: `${layer.id}:core`,
					color: hexToOutlineColor(layer.color),
					edgeStrength: 4,
					xRay: true,
					meshes
				});
			}
		}

		return specs;
	}

	function reorderOutputPasses() {
		for (const pass of scenePasses) {
			composer.removePass(pass);
			composer.addPass(pass);
		}
		if (toneMappingPass) {
			composer.removePass(toneMappingPass);
			composer.addPass(toneMappingPass);
		}
	}

	function syncOutlinePasses() {
		if (!selectionEnabled) {
			clearOutlinePasses();
			reorderOutputPasses();
			return;
		}

		const desired = buildPassSpecs();
		const existing = new Map(managedPasses.map((managed) => [managed.key, managed]));
		const next: ManagedPass[] = [];

		for (const spec of desired) {
			const managed = existing.get(spec.key);
			if (managed) {
				applyPassSpec(managed, spec);
				next.push(managed);
				existing.delete(spec.key);
			} else {
				next.push(addEffect(spec));
			}
		}

		for (const managed of existing.values()) removeManagedPass(managed);

		managedPasses = next;
		reorderOutputPasses();
		updatePassCameras();
	}

	// --- Scene-style post passes (art outline / bloom / grade) ---

	function sceneStyleKey(style: SceneStyle, registryFp: string): string {
		const { outline: o, bloom: b, vignette: v, grain: g, sketch: s, toneMapping } = style;
		return [
			o.enabled ? `o:${o.color}:${o.thickness}:${registryFp}` : 'o0',
			b.enabled ? `b:${b.intensity}:${b.threshold}` : 'b0',
			v.enabled ? `v:${v.darkness}` : 'v0',
			g.enabled ? `g:${g.opacity}` : 'g0',
			s.enabled ? `s:${s.intensity}` : 's0',
			`tm:${toneMapping}`
		].join('|');
	}

	function clearScenePasses() {
		for (const pass of scenePasses) {
			composer.removePass(pass);
			pass.dispose();
		}
		scenePasses = [];
	}

	function buildScenePasses(style: SceneStyle): Pass[] {
		const cam = camera.current as Camera;
		const passes: Pass[] = [];

		if (style.outline.enabled) {
			const outline = new OutlineEffect(scene, cam, {
				...outlineEffectDefaults,
				edgeStrength: Math.max(1, style.outline.thickness * 2),
				xRay: false,
				visibleEdgeColor: hexToOutlineColor(style.outline.color),
				hiddenEdgeColor: hexToOutlineColor(style.outline.color)
			});
			outline.selection.set(outlineRegistry.all());
			passes.push(new EffectPass(cam, outline));
		}

		if (style.bloom.enabled) {
			const bloom = new BloomEffect({
				intensity: style.bloom.intensity,
				luminanceThreshold: style.bloom.threshold,
				luminanceSmoothing: 0.1,
				mipmapBlur: true,
				radius: 0.6
			});
			passes.push(new EffectPass(cam, bloom));
		}

		// Per-pixel grade effects merge into a single pass.
		const grade = [];
		if (style.sketch.enabled) grade.push(new SketchEffect(style.sketch.intensity));
		if (style.vignette.enabled) {
			grade.push(new VignetteEffect({ darkness: style.vignette.darkness, offset: 0.3 }));
		}
		if (style.grain.enabled) {
			const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
			noise.blendMode.opacity.value = style.grain.opacity;
			grade.push(noise);
		}
		if (grade.length > 0) passes.push(new EffectPass(cam, ...grade));

		return passes;
	}

	function syncScenePasses(style: SceneStyle) {
		clearScenePasses();
		const next = buildScenePasses(style);
		for (const pass of next) composer.addPass(pass);
		scenePasses = next;
		syncToneMappingPass(style);
		reorderOutputPasses();
		updatePassCameras();
	}

	function sceneExposure(style: SceneStyle): number {
		const skyExposure = ui.scene.sky.enabled ? SKY_PRESETS[ui.scene.sky.preset].exposure : 1;
		return style.exposure * skyExposure;
	}

	function shouldUseComposer(): boolean {
		return selectionEnabled || managedPasses.length > 0 || scenePasses.length > 0;
	}

	function setComposerRendering(active: boolean) {
		composerRendering = active;
		autoRender.set(!active);
	}

	let cachedOutlineKey = '';
	let cachedStyleKey = '';

	$effect(() => {
		composer.setSize(size.current.width, size.current.height);
		invalidate();
	});

	$effect(() => {
		camera.current;
		updatePassCameras();
		invalidate();
	});

	// On-demand viewport must repaint when hover/selection/play outlines change.
	$effect(() => {
		world.hovered;
		world.selection;
		ui.shellMode;
		session.members;
		invalidate();
	});

	$effect(() => {
		return () => {
			setComposerRendering(false);
			clearOutlinePasses();
			clearScenePasses();
			if (toneMappingPass) {
				composer.removePass(toneMappingPass);
				toneMappingPass.dispose();
				toneMappingEffect?.dispose();
				toneMappingPass = undefined;
				toneMappingEffect = undefined;
			}
			composer.removePass(renderPass);
			renderPass.dispose();
			composer.dispose();
		};
	});

	useTask(
		OUTLINE_COMPOSER_TASK,
		(delta) => {
			const style = ui.scene.style;
			const registryFp = outlineRegistry.fingerprint();

			const outlineKey = outlineStateKey(outlineLayers(), registryFp, selectionEnabled);
			if (outlineKey !== cachedOutlineKey) {
				cachedOutlineKey = outlineKey;
				syncOutlinePasses();
			}

			const styleKey = sceneStyleKey(style, registryFp);
			if (styleKey !== cachedStyleKey) {
				cachedStyleKey = styleKey;
				syncScenePasses(style);
				syncToneMappingPass(style);
			}

			if (cameraStore.projection === 'orthographic') {
				// WorldScene owns the ortho render path — don't flip autoRender back on.
				if (composerRendering) {
					composerRendering = false;
				}
				autoRender.set(false);
				return;
			}

			if (!shouldUseComposer()) {
				const wasActive = composerRendering;
				setComposerRendering(false);
				if (wasActive) invalidate();
				return;
			}

			ensureToneMappingPass();
			syncToneMappingPass(style);
			reorderOutputPasses();

			const prevToneMapping = renderer.toneMapping;
			const prevExposure = renderer.toneMappingExposure;
			renderer.toneMapping = NoToneMapping;
			renderer.toneMappingExposure = sceneExposure(style);
			setComposerRendering(true);
			updatePassCameras();
			composer.render(delta);
			renderer.toneMapping = prevToneMapping;
			renderer.toneMappingExposure = prevExposure;
			invalidate();
		},
		{ stage: renderStage, autoInvalidate: false, after: autoRenderTask }
	);
</script>
