/**
 * Frame Shift era backdrop swap — reads host-synced MuseumEra.decade and updates
 * the Marble hall splat + invisible collider mesh paths.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';

const MUSEUM_CLOCK_ID = 'entity:museum/clock';
const BACKDROP_ID = 'entity:backdrop/marble';
const COLLIDER_ID = 'entity:backdrop/collider';

const DECADE_SLUGS: Record<number, string> = {
	1890: 'era-1890',
	1960: 'era-1960'
};

registerComponent({
	name: 'MuseumEra',
	fields: {
		decade: { t: 'number', sync: 'realtime', default: 1890 }
	}
});

let lastDecade: number | null = null;

export function resetEraSwapState(): void {
	lastDecade = null;
}

export function eraSwapSystem(_ctx: TickContext): void {
	const clock = world.getEntity(MUSEUM_CLOCK_ID);
	if (!clock) return;

	const decade = Number(clock.components.MuseumEra?.decade ?? 1890);
	if (decade === lastDecade) return;
	lastDecade = decade;

	const slug = DECADE_SLUGS[decade] ?? DECADE_SLUGS[1890];
	const backdrop = world.getEntity(BACKDROP_ID);
	if (backdrop) {
		world.applyFieldLocal(BACKDROP_ID, 'GaussianSplat', 'src', `/worldlabs/${slug}/hall.spz`);
	}

	const collider = world.getEntity(COLLIDER_ID);
	if (collider) {
		world.applyFieldLocal(COLLIDER_ID, 'Render', 'mesh', `/worldlabs/${slug}/collider-walls.glb`);
	}
}
