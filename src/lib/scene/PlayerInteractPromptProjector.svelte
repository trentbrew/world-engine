<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { Vector3 } from 'three';
	import {
		badgeAnchorForEntity,
		hasPromptBounds
	} from '$lib/engine/render/selectionBadge';
	import { playerInteractPrompt } from '$lib/engine/room/playerInteractPrompt.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	/** Treat targets within this many px of an edge as off-screen (chat pins out). */
	const EDGE_MARGIN = 24;

	const { camera, size } = useThrelte();
	const anchor = new Vector3();

	useTask(
		() => {
			const prompt = playerInteractPrompt.prompt;
			if (ui.shellMode !== 'play' || !prompt) return;

			const cam = camera.current;
			const { width, height } = size.current;
			const entity = world.getEntity(prompt.entityId);
			if (!cam || !entity || width === 0 || height === 0 || !hasPromptBounds(entity)) {
				playerInteractPrompt.set({ ...prompt, visible: false, onScreen: false });
				return;
			}

			const [x, y, z] = badgeAnchorForEntity(entity);
			anchor.set(x, y, z);
			anchor.project(cam);
			// Behind the camera the projection mirrors through the origin — flip it
			// back so the edge arrow points at the target's real side of the screen.
			const behind = anchor.z > 1;
			const ndcX = behind ? -anchor.x : anchor.x;
			const ndcY = behind ? -anchor.y : anchor.y;
			const sx = (ndcX * 0.5 + 0.5) * width;
			const sy = (-ndcY * 0.5 + 0.5) * height;

			playerInteractPrompt.set({
				...prompt,
				x: sx,
				y: sy,
				visible: true,
				onScreen:
					!behind &&
					sx >= EDGE_MARGIN &&
					sx <= width - EDGE_MARGIN &&
					sy >= EDGE_MARGIN &&
					sy <= height - EDGE_MARGIN
			});
		},
		{ autoInvalidate: false }
	);
</script>
