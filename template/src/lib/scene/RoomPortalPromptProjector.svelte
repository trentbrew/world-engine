<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { Vector3 } from 'three';
	import {
		badgeAnchorForEntity,
		hasPromptBounds
	} from '$lib/engine/render/selectionBadge';
	import { roomPortalPrompt } from '$lib/engine/room/roomPortalPrompt.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const { camera, size } = useThrelte();
	const anchor = new Vector3();

	useTask(
		() => {
			const prompt = roomPortalPrompt.prompt;
			if (ui.shellMode !== 'play' || !prompt) return;

			const cam = camera.current;
			const { width, height } = size.current;
			const entity = world.getEntity(prompt.entityId);
			if (!cam || !entity || width === 0 || height === 0 || !hasPromptBounds(entity)) {
				roomPortalPrompt.set({ ...prompt, visible: false });
				return;
			}

			const [x, y, z] = badgeAnchorForEntity(entity);
			anchor.set(x, y, z);
			anchor.project(cam);
			const visible = anchor.z >= -1 && anchor.z <= 1;
			roomPortalPrompt.set({
				...prompt,
				x: (anchor.x * 0.5 + 0.5) * width,
				y: (-anchor.y * 0.5 + 0.5) * height,
				visible
			});
		},
		{ autoInvalidate: false }
	);
</script>
