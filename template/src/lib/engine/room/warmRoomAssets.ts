/**
 * Prefetch mesh / splat assets for rooms reachable from the active room.
 * Entity graphs are already in the catalog — this warms HTTP + GLTF cache.
 */
import { getRoomCatalog, normalizeRoomId } from '$lib/engine/ontology/roomCatalog';
import type { Entity } from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';
import { sceneLoading } from '$lib/ui/sceneLoading.svelte';
import { createConfiguredGltfLoader } from '$lib/engine/render/configureGltfLoader';

const loader = createConfiguredGltfLoader();
const warmed = new Set<string>();
const visitedRooms = new Set<string>();

function isAssetUrl(value: unknown): value is string {
	return typeof value === 'string' && (value.startsWith('/') || value.startsWith('http'));
}

function collectUrlsFromEntity(entity: Entity, into: Set<string>): void {
	const render = entity.components.Render as { mesh?: string } | undefined;
	if (isAssetUrl(render?.mesh) && !render.mesh.startsWith('primitive:')) into.add(render.mesh);

	const skin = entity.components.SkinnedMesh as { mesh?: string } | undefined;
	if (isAssetUrl(skin?.mesh) && !skin.mesh.startsWith('primitive:')) into.add(skin.mesh);

	const splat = entity.components.GaussianSplat as { src?: string } | undefined;
	if (isAssetUrl(splat?.src)) into.add(splat.src);
}

/** Room ids reachable via RoomPortal.target or Room.next from `fromRoomId`. */
export function adjacentRoomIds(fromRoomId: string | null): string[] {
	const catalog = getRoomCatalog();
	if (!catalog || !fromRoomId) return [];

	const from = normalizeRoomId(fromRoomId);
	const targets = new Set<string>();

	const meta = catalog.rooms.get(from);
	if (meta?.next) targets.add(normalizeRoomId(meta.next));

	const templates = [...(catalog.byRoom.get(from) ?? []), ...catalog.globals];
	for (const entity of templates) {
		const portal = entity.components.RoomPortal as { target?: string } | undefined;
		if (portal?.target) targets.add(normalizeRoomId(portal.target));
	}

	// Also scan live entities (press-mode portals in the current room).
	for (const entity of world.query('RoomPortal')) {
		const portal = entity.components.RoomPortal as { target?: string } | undefined;
		if (portal?.target) targets.add(normalizeRoomId(portal.target));
	}

	targets.delete(from);
	return [...targets].filter((id) => catalog.rooms.has(id));
}

function assetUrlsForRoom(roomId: string): string[] {
	const catalog = getRoomCatalog();
	if (!catalog) return [];
	const urls = new Set<string>();
	for (const entity of catalog.byRoom.get(normalizeRoomId(roomId)) ?? []) {
		collectUrlsFromEntity(entity, urls);
	}
	for (const entity of catalog.globals) collectUrlsFromEntity(entity, urls);
	return [...urls];
}

function warmUrl(url: string): Promise<void> {
	if (warmed.has(url)) return Promise.resolve();
	warmed.add(url);
	const lower = url.toLowerCase();
	if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
		return loader.loadAsync(url).then(
			() => undefined,
			() => {
				warmed.delete(url);
			}
		);
	}
	return fetch(url, { cache: 'force-cache' }).then(
		() => undefined,
		() => {
			warmed.delete(url);
		}
	);
}

/** Warm assets for every room reachable from `fromRoomId` (non-blocking). */
export function warmAdjacentRoomAssets(fromRoomId: string | null): void {
	if (fromRoomId) visitedRooms.add(normalizeRoomId(fromRoomId));

	for (const roomId of adjacentRoomIds(fromRoomId)) {
		const urls = assetUrlsForRoom(roomId).filter((url) => !warmed.has(url));
		if (urls.length === 0) continue;

		const coldFirstVisit = !visitedRooms.has(roomId);
		const title =
			getRoomCatalog()?.rooms.get(roomId)?.title?.trim() ||
			roomId.replace(/^room:/, '');

		if (coldFirstVisit) {
			sceneLoading.setPhase(`Preparing ${title}`, 'Warming adjacent room assets');
		}

		void Promise.all(urls.map((url) => warmUrl(url))).finally(() => {
			if (coldFirstVisit && sceneLoading.detail === 'Warming adjacent room assets') {
				sceneLoading.setPhase('Loading scene assets');
			}
		});
	}
}

export function resetRoomAssetWarmup(): void {
	warmed.clear();
	visitedRooms.clear();
}
