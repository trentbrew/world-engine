import { peerColor } from '$lib/engine/collab/peerColor';
import { isPlayerEntity, playerClientId } from '$lib/engine/player/access';
import { session } from '$lib/engine/net/session.svelte';
import { ui } from '$lib/ui/ui.svelte';
import { world } from '$lib/engine/runtime/world.svelte';

export type OutlineLayer = {
	id: string;
	color: string;
	entityIds: string[];
	/** X-ray selection edge with white halo + color core. */
	emphasized: boolean;
};

/** Active outline passes derived from hover + local/remote selection. */
export function outlineLayers(): OutlineLayer[] {
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

export function hexToOutlineColor(hex: string): number {
	return Number.parseInt(hex.replace('#', ''), 16);
}
