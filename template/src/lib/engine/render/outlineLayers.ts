import { Color } from 'three';
import { peerColor } from '$lib/engine/collab/peerColor';
import {
	isPlayerEntity,
	playerClientId,
	playerDesignatedColor
} from '$lib/engine/player/access';
import { session } from '$lib/engine/net/session.svelte';
import { ui } from '$lib/ui/ui.svelte';
import { world } from '$lib/engine/runtime/world.svelte';

export type OutlineLayer = {
	id: string;
	color: string;
	entityIds: string[];
	/** X-ray selection edge with white halo + color core. */
	emphasized: boolean;
	/** Optional edge strength override for non-emphasized passes. */
	edgeStrength?: number;
};

function playPlayerOutlineLayers(): OutlineLayer[] {
	if (ui.shellMode !== 'play') return [];

	const layers: OutlineLayer[] = [];
	for (const entity of world.query('Player')) {
		if (!isPlayerEntity(entity)) continue;
		const clientId = playerClientId(entity);
		layers.push({
			id: clientId ? `player:${clientId}` : `player:${entity.id}`,
			color: playerDesignatedColor(entity),
			entityIds: [entity.id],
			emphasized: false,
			edgeStrength: 5
		});
	}
	return layers;
}

/** Active outline passes derived from hover + local/remote selection. */
export function outlineLayers(): OutlineLayer[] {
	const playLayers = playPlayerOutlineLayers();
	if (playLayers.length > 0) return playLayers;

	if (ui.shellMode !== 'edit' || !ui.chrome.selectionOutline) return [];

	const layers: OutlineLayer[] = [];

	if (world.hovered && world.hovered !== world.selection) {
		const hovered = world.getEntity(world.hovered);
		if (hovered && world.canTransformEntity(world.hovered)) {
			layers.push({
				id: 'hover',
				color: '#ffffff',
				entityIds: [world.hovered],
				emphasized: false
			});
		}
	}

	if (world.selection) {
		const selected = world.getEntity(world.selection);
		if (selected && world.canTransformEntity(world.selection)) {
			const clientId = isPlayerEntity(selected) ? playerClientId(selected) : null;
			layers.push({
				id: 'local',
				color:
					clientId != null
						? peerColor(clientId)
						: session.connected
							? peerColor(session.clientId)
							: '#ffffff',
				entityIds: [world.selection],
				emphasized: true
			});
		}
	}

	for (const [peerId, selection] of Object.entries(session.peerSelections)) {
		if (!selection.entityId) continue;
		if (!world.canTransformEntity(selection.entityId)) continue;
		layers.push({
			id: `peer:${peerId}`,
			color: peerColor(peerId),
			entityIds: [selection.entityId],
			emphasized: true
		});
	}

	return layers;
}

export function hexToOutlineColor(css: string): number {
	try {
		return new Color(css).getHex();
	} catch {
		return 0xffffff;
	}
}
