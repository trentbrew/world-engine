<script lang="ts">
	import { TransformControls } from '@threlte/extras';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { isGroundEntity, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { clampPositionToPlane, gizmoAxisVisibility } from '$lib/scene/playPlane';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { editHistory } from '$lib/engine/authoring/editHistory.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import type { Object3D } from 'three';

	const MIN_SCALE = 0.01;

	let { entity, object }: { entity: Entity; object: Object3D } = $props();

	let dragging = $state(false);
	let shiftHeld = $state(false);
	let scaleDragStart: [number, number, number] | null = null;

	const use2dEdit = $derived(worldProfile.is2d && ui.shellMode === 'edit');
	const isGround = $derived(isGroundEntity(entity));
	const playPlane = $derived(worldProfile.profile.plane);
	const gizmoAxes = $derived(
		use2dEdit || isGround
			? gizmoAxisVisibility(playPlane)
			: { showX: true, showY: true, showZ: true }
	);
	const translationSnap = $derived(ui.chrome.grid ? ui.grid.cellSize : undefined);
	const scaleSnap = $derived(
		ui.chrome.grid ? Math.max(ui.grid.cellSize / 10, 0.01) : 0.1
	);
	const gizmoMode = $derived(use2dEdit ? 'translate' : ui.transformGizmoMode);

	$effect(() => {
		if (dragging) return;
		const p = position(entity);
		object.position.set(p[0], p[1], p[2]);
		const r = rotationQuat(entity);
		object.quaternion.set(r[0], r[1], r[2], r[3]);
		const s = scaleVec(entity);
		object.scale.set(s[0], s[1], s[2]);
	});

	function clampScale(value: number): number {
		return Math.max(MIN_SCALE, value);
	}

	function uniformScaleFactor(
		start: [number, number, number],
		current: { x: number; y: number; z: number }
	): number {
		let factor = 1;
		let maxLogDiff = -1;
		for (let i = 0; i < 3; i++) {
			const startAxis = start[i];
			if (startAxis === 0) continue;
			const ratio = current[i === 0 ? 'x' : i === 1 ? 'y' : 'z'] / startAxis;
			const diff = Math.abs(Math.log(Math.max(ratio, 1e-8)));
			if (diff > maxLogDiff) {
				maxLogDiff = diff;
				factor = ratio;
			}
		}
		return factor;
	}

	function applyUniformScaleFromDrag() {
		if (!scaleDragStart || gizmoMode !== 'scale' || !shiftHeld) return;
		const factor = uniformScaleFactor(scaleDragStart, object.scale);
		object.scale.set(
			clampScale(scaleDragStart[0] * factor),
			clampScale(scaleDragStart[1] * factor),
			clampScale(scaleDragStart[2] * factor)
		);
	}

	$effect(() => {
		const syncShift = (event: Event) => {
			if ('shiftKey' in event) shiftHeld = Boolean((event as { shiftKey: unknown }).shiftKey);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Shift') shiftHeld = true;
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key === 'Shift') shiftHeld = false;
		};
		const onBlur = () => {
			shiftHeld = false;
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('pointerdown', syncShift);
		window.addEventListener('pointermove', syncShift);
		window.addEventListener('blur', onBlur);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('pointerdown', syncShift);
			window.removeEventListener('pointermove', syncShift);
			window.removeEventListener('blur', onBlur);
		};
	});

	$effect(() => {
		if (!dragging || !shiftHeld || gizmoMode !== 'scale' || !scaleDragStart) return;
		applyUniformScaleFromDrag();
		syncTransform(false);
	});

	function syncTransform(commitScale = false) {
		const p = object.position;
		const nextPos =
			use2dEdit || isGround
				? clampPositionToPlane(playPlane, [p.x, p.y, p.z])
				: [p.x, p.y, p.z];
		if (use2dEdit || isGround) {
			object.position.set(nextPos[0], nextPos[1], nextPos[2]);
		}
		world.setField(entity.id, 'Transform', 'position', nextPos);
		const q = object.quaternion;
		world.setField(entity.id, 'Transform', 'rotation', [q.x, q.y, q.z, q.w]);

		if (commitScale) {
			const s = object.scale;
			world.setField(entity.id, 'Transform', 'scale', [
				clampScale(s.x),
				clampScale(s.y),
				clampScale(s.z)
			]);
		}
	}

	function onobjectChange() {
		applyUniformScaleFromDrag();
		syncTransform(false);
	}

	function onmouseDown() {
		dragging = true;
		if (gizmoMode === 'scale') {
			const s = object.scale;
			scaleDragStart = [s.x, s.y, s.z];
		}
		editHistory.beginTransaction('transform');
	}

	function onmouseUp() {
		applyUniformScaleFromDrag();
		dragging = false;
		scaleDragStart = null;
		syncTransform(!use2dEdit);
		editHistory.commitTransaction({ label: 'transform', selection: entity.id });
	}
</script>

<TransformControls
	{object}
	mode={gizmoMode}
	showX={gizmoAxes.showX}
	showY={gizmoAxes.showY}
	showZ={gizmoAxes.showZ}
	{translationSnap}
	{scaleSnap}
	autoPauseControls
	{onobjectChange}
	{onmouseDown}
	{onmouseUp}
/>
