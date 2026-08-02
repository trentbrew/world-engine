/**
 * Local-player proximity plaques — sonner toast when near entities with `Plaque`.
 * Frame Shift wedge 2 (TRL-241). No host authority; read-only HUD.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';
import { toast } from '$lib/ui/toast.svelte';
import { ui } from '$lib/ui/ui.svelte';

registerComponent({
	name: 'Plaque',
	fields: {
		title: { t: 'string', default: 'Untitled', sync: 'durable' },
		artist: { t: 'string', default: 'Unknown', sync: 'durable' },
		year: { t: 'string', default: '', sync: 'durable' },
		radius: { t: 'number', default: 2.5, sync: 'durable' }
	}
});

let activePlaqueId: string | null = null;

export function resetPlaqueProximityState(): void {
	activePlaqueId = null;
}

function xzDistance(a: [number, number, number], b: [number, number, number]): number {
	const dx = a[0] - b[0];
	const dz = a[2] - b[2];
	return Math.sqrt(dx * dx + dz * dz);
}

function formatPlaqueMessage(plaque: { title?: string; artist?: string; year?: string }): string {
	const title = String(plaque.title ?? 'Untitled');
	const artist = String(plaque.artist ?? 'Unknown');
	const year = String(plaque.year ?? '').trim();
	return year ? `${title} — ${artist} (${year})` : `${title} — ${artist}`;
}

export function plaqueProximitySystem(_ctx: TickContext): void {
	if (ui.shellMode !== 'play') return;

	const playerId = world.localPlayerId;
	if (!playerId) return;

	const player = world.getEntity(playerId);
	if (!player) return;

	const playerPos = player.components.Transform?.position as [number, number, number] | undefined;
	if (!playerPos) return;

	let nearestId: string | null = null;
	let nearestDist = Infinity;

	for (const entity of world.query('Plaque')) {
		const render = entity.components.Render as { visible?: boolean } | undefined;
		if (render?.visible === false) continue;

		const plaque = entity.components.Plaque as {
			title?: string;
			artist?: string;
			year?: string;
			radius?: number;
		};
		const pos = entity.components.Transform?.position as [number, number, number] | undefined;
		if (!pos) continue;

		const radius = Number(plaque.radius ?? 2.5);
		const dist = xzDistance(playerPos, pos);
		if (dist <= radius && dist < nearestDist) {
			nearestDist = dist;
			nearestId = entity.id;
		}
	}

	if (nearestId === activePlaqueId) return;

	if (nearestId) {
		const entity = world.getEntity(nearestId);
		const plaque = entity?.components.Plaque;
		if (plaque) toast(formatPlaqueMessage(plaque), { duration: 5000 });
	}

	activePlaqueId = nearestId;
}
