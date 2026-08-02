import type { IntersectionEvent } from '@threlte/extras';
import { camera } from '$lib/engine/render/camera.svelte';
import { deferViewportPick } from '$lib/scene/viewportPick';
import { ui } from '$lib/ui/ui.svelte';
import { world } from '$lib/engine/runtime/world.svelte';

export function pickHandlers(entityId: string) {
	return {
		onpointerdown(event: IntersectionEvent<PointerEvent>) {
			event.stopPropagation();
			deferViewportPick({ kind: 'select', entityId }, event.nativeEvent);
		},
		ondblclick(event: IntersectionEvent<MouseEvent>) {
			if (ui.shellMode !== 'edit') return;
			event.stopPropagation();
			event.stopImmediatePropagation();
			if (ui.isAnimatableEntity(entityId)) {
				ui.editObject(entityId);
				return;
			}
			if (!world.trySelect(entityId)) return;
			camera.focusSelection();
		},
		onpointerenter(event: IntersectionEvent<PointerEvent>) {
			if (ui.shellMode !== 'edit') return;
			event.stopPropagation();
			if (!world.canTransformEntity(entityId)) return;
			world.setHover(entityId);
		},
		onpointerleave(event: IntersectionEvent<PointerEvent>) {
			if (ui.shellMode !== 'edit') return;
			event.stopPropagation();
			if (world.hovered === entityId) world.setHover(null);
		}
	};
}
