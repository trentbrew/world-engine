<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { Vector3 } from 'three';
	import { collab } from '$lib/engine/collab/collab.svelte';
	import { peerColor } from '$lib/engine/collab/peerColor';
	import {
		peerSelectionLabels,
		type ProjectedPeerBadge
	} from '$lib/engine/render/peerSelectionLabels.svelte';
	import { badgeAnchorForEntity } from '$lib/engine/render/selectionBadge';
	import { isPlayerEntity, playerClientId } from '$lib/engine/player/access';
	import { session } from '$lib/engine/net/session.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	type BadgeSource = {
		key: string;
		entityId: string;
		name: string;
		color: string;
	};

	const { camera, size } = useThrelte();
	const anchor = new Vector3();

	const badges = $derived.by((): BadgeSource[] => {
		if (!session.connected) return [];

		// Play mode: a name tag over every player avatar (who's who).
		if (ui.shellMode === 'play') {
			const result: BadgeSource[] = [];
			for (const entity of world.query('Player')) {
				const clientId = playerClientId(entity);
				if (!clientId) continue;
				result.push({
					key: `player:${clientId}`,
					entityId: entity.id,
					name: collab.displayNameFor(clientId),
					color: peerColor(clientId)
				});
			}
			return result;
		}

		// Edit mode: badges for what peers have selected.
		if (ui.shellMode === 'edit' && ui.chrome.selectionOutline && session.peerCount > 1) {
			const result: BadgeSource[] = [];
			for (const [peerId, selection] of Object.entries(session.peerSelections)) {
				if (!selection.entityId || !world.canTransformEntity(selection.entityId)) continue;
				result.push({
					key: peerId,
					entityId: selection.entityId,
					name: collab.displayNameFor(peerId, selection.name),
					color: peerColor(peerId)
				});
			}
			return result;
		}

		return [];
	});

	useTask(
		() => {
			const cam = camera.current;
			const { width, height } = size.current;
			if (!session.connected || !cam || width === 0 || height === 0) {
				peerSelectionLabels.clear();
				return;
			}

			const stackByEntity = new Map<string, number>();
			const projected: ProjectedPeerBadge[] = [];

			for (const badge of badges) {
				const entity = world.getEntity(badge.entityId);
				if (!entity) continue;

				const stack = stackByEntity.get(badge.entityId) ?? 0;
				stackByEntity.set(badge.entityId, stack + 1);

				const [x, y, z] = badgeAnchorForEntity(entity);
				anchor.set(x, y + stack * 0.18, z);
				anchor.project(cam);

				const visible = anchor.z >= -1 && anchor.z <= 1;
				projected.push({
					key: badge.key,
					entityId: badge.entityId,
					name: badge.name,
					color: badge.color,
					x: (anchor.x * 0.5 + 0.5) * width,
					y: (-anchor.y * 0.5 + 0.5) * height - stack * 22,
					visible
				});
			}

			peerSelectionLabels.setLabels(projected);
		},
		{ autoInvalidate: false }
	);
</script>
