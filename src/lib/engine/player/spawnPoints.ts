/**
 * Spawn slot assignment — maps each room member to a world position from authored
 * spawn markers (or a ring around the primary marker when peers exceed markers).
 *
 * Peers that share a marker (more members than markers) are fanned onto a ring so
 * they never stack on the same point.
 */
import { world } from '$lib/engine/runtime/world.svelte';
import { colorForClient, spawnPositionFromBase } from './spawnPlayer';

/** Ring radius when multiple peers share one authored spawn marker. */
const RING_RADIUS = 1.8;

/** Minimum XZ separation enforced between any two roster spawn bases. */
const MIN_SEPARATION = 1.2;

export type SpawnMarker = {
	id: string;
	position: [number, number, number];
};

export type PlayerSpawnRing = {
	clientId: string;
	position: [number, number, number];
	color: string;
};

function isSpawnMarker(entity: { components: Record<string, unknown> }): boolean {
	const kind = (entity.components.Marker as { kind?: string } | undefined)?.kind;
	return kind === 'spawn' || kind === undefined;
}

/** Authored spawn markers in stable order. */
export function listSpawnMarkers(): SpawnMarker[] {
	return world
		.query('Marker')
		.filter(isSpawnMarker)
		.map((entity) => {
			const pos = (entity.components.Transform as { position?: [number, number, number] })
				?.position;
			return {
				id: entity.id,
				position: [pos?.[0] ?? 0, pos?.[1] ?? 0.05, pos?.[2] ?? 0] as [number, number, number]
			};
		})
		.sort((a, b) => a.id.localeCompare(b.id));
}

export function spawnSlotIndex(clientId: string, members: string[]): number {
	const sorted = effectiveMembers(members, clientId);
	const idx = sorted.indexOf(clientId);
	return idx >= 0 ? idx : 0;
}

function effectiveMembers(members: string[], clientId: string): string[] {
	const sorted = [...members].filter(Boolean).sort((a, b) => a.localeCompare(b));
	return sorted.length > 0 ? sorted : clientId ? [clientId] : [];
}

/** Ground XZ for a member slot before capsule rest height is applied. */
export function spawnBaseForSlot(
	slotIndex: number,
	memberCount: number,
	markers: SpawnMarker[] = listSpawnMarkers()
): [number, number, number] {
	const fallback: [number, number, number] = [0, 0.05, 0];
	if (markers.length === 0) {
		return ringSlotPosition(fallback, slotIndex, memberCount);
	}
	if (markers.length === 1) {
		return ringSlotPosition(markers[0]!.position, slotIndex, memberCount);
	}

	// Multiple markers: assign by slot, then ring among peers that share the marker
	// (slotIndex % N collides once memberCount > markers.length).
	const markerCount = markers.length;
	const markerIndex = ((slotIndex % markerCount) + markerCount) % markerCount;
	const ringIndex = Math.floor(slotIndex / markerCount);
	let shareCount = 0;
	for (let i = 0; i < memberCount; i++) {
		if (i % markerCount === markerIndex) shareCount += 1;
	}
	return ringSlotPosition(markers[markerIndex]!.position, ringIndex, Math.max(1, shareCount));
}

/**
 * Place peers around `center`. With N>1 every peer sits on the ring (including
 * slot 0) so nobody occupies the exact same XZ as another.
 */
export function ringSlotPosition(
	center: [number, number, number],
	slotIndex: number,
	memberCount: number,
	radius = RING_RADIUS
): [number, number, number] {
	if (memberCount <= 1) return [center[0], center[1], center[2]];
	const angle = (slotIndex * 2 * Math.PI) / memberCount;
	return [
		center[0] + Math.cos(angle) * radius,
		center[1],
		center[2] + Math.sin(angle) * radius
	];
}

export function spawnBaseForClient(
	clientId: string,
	members: string[]
): [number, number, number] {
	const bases = spawnBasesForRoster(members);
	return bases.get(clientId) ?? spawnBaseForSlot(0, 1);
}

/**
 * All roster spawn bases with a final minimum-separation pass (guards near-duplicate
 * authored markers as well as ring math).
 */
export function spawnBasesForRoster(members: string[]): Map<string, [number, number, number]> {
	const sorted = effectiveMembers(members, members[0] ?? '');
	const markers = listSpawnMarkers();
	const bases = new Map<string, [number, number, number]>();
	for (let i = 0; i < sorted.length; i++) {
		const id = sorted[i]!;
		bases.set(id, spawnBaseForSlot(i, sorted.length, markers));
	}
	return separateSpawnBases(bases);
}

/** Push bases apart on XZ until each pair is at least MIN_SEPARATION apart. */
export function separateSpawnBases(
	bases: Map<string, [number, number, number]>,
	minSep = MIN_SEPARATION
): Map<string, [number, number, number]> {
	const ids = [...bases.keys()].sort((a, b) => a.localeCompare(b));
	if (ids.length <= 1) return bases;

	const next = new Map(bases);
	const minSq = minSep * minSep;
	// A few relaxation iterations — enough for small lobbies.
	for (let pass = 0; pass < 4; pass++) {
		let moved = false;
		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				const aId = ids[i]!;
				const bId = ids[j]!;
				const a = next.get(aId)!;
				const b = next.get(bId)!;
				const dx = b[0] - a[0];
				const dz = b[2] - a[2];
				const distSq = dx * dx + dz * dz;
				if (distSq >= minSq || distSq < 1e-8) {
					if (distSq < 1e-8) {
						// Identical points — nudge along a stable angle from id pair.
						const angle = ((i * 17 + j * 31) % 360) * (Math.PI / 180);
						const nx = Math.cos(angle) * (minSep * 0.5);
						const nz = Math.sin(angle) * (minSep * 0.5);
						next.set(aId, [a[0] - nx, a[1], a[2] - nz]);
						next.set(bId, [b[0] + nx, b[1], b[2] + nz]);
						moved = true;
					}
					continue;
				}
				const dist = Math.sqrt(distSq);
				const push = (minSep - dist) * 0.5;
				const ux = dx / dist;
				const uz = dz / dist;
				next.set(aId, [a[0] - ux * push, a[1], a[2] - uz * push]);
				next.set(bId, [b[0] + ux * push, b[1], b[2] + uz * push]);
				moved = true;
			}
		}
		if (!moved) break;
	}
	return next;
}

/** Capsule spawn position for a client in the current member roster. */
export function spawnPositionForClient(clientId: string, members: string[]): [number, number, number] {
	const bases = spawnBasesForRoster(members);
	const base = bases.get(clientId) ?? spawnBaseForClient(clientId, members);
	return spawnPositionFromBase(base);
}

/** Colored spawn rings for each connected member (play-mode overlay). */
export function playerSpawnRings(members: string[]): PlayerSpawnRing[] {
	const sorted = effectiveMembers(members, members[0] ?? '');
	const bases = spawnBasesForRoster(sorted);
	return sorted.map((clientId) => ({
		clientId,
		position: bases.get(clientId) ?? spawnBaseForClient(clientId, sorted),
		color: colorForClient(clientId)
	}));
}

export function playerEntityId(clientId: string): string {
	return `entity:player/${clientId}`;
}

/** Snap every connected player's Transform to their roster slot. */
export function reconcilePlayerSpawnPositions(members: string[]): void {
	const roster = effectiveMembers(members, members[0] ?? '');
	const bases = spawnBasesForRoster(roster);
	for (const clientId of roster) {
		const entity = world.getEntity(playerEntityId(clientId));
		if (!entity) continue;
		const base = bases.get(clientId) ?? spawnBaseForClient(clientId, roster);
		const pos = spawnPositionFromBase(base);
		const bag = entity.components.Transform as { position?: [number, number, number] } | undefined;
		if (bag) bag.position = pos;
	}
}
