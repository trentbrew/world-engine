/**
 * Remote world registry — fetches catalog.json from github.com/turtlehq/worlds
 * (or any compatible manifest) and maps entries into the scene picker.
 */

export const DEFAULT_REGISTRY_URL =
	'https://raw.githubusercontent.com/turtlehq/worlds/main/catalog.json';

export const DEFAULT_REGISTRY_RAW_BASE =
	'https://raw.githubusercontent.com/turtlehq/worlds/main';

export type RegistryWorld = {
	id: string;
	title: string;
	description: string;
	url: string;
	dimensions: '2d' | '3d';
	category?: 'demo';
	tags?: string[];
};

export type WorldCatalog = {
	version: number;
	worlds: RegistryWorld[];
};

export function registryParam(id: string): string {
	return `registry:${id}`;
}

export function registryWorldUrl(id: string, base = DEFAULT_REGISTRY_RAW_BASE): string {
	return `${base.replace(/\/$/, '')}/${id}.jsonld`;
}

export function toRegistryGameEntry(world: RegistryWorld) {
	return {
		param: registryParam(world.id),
		title: world.title,
		description: world.description,
		dimensions: world.dimensions,
		category: world.category,
		source: 'registry' as const,
		worldUrl: world.url
	};
}

function isRegistryWorld(value: unknown): value is RegistryWorld {
	if (!value || typeof value !== 'object') return false;
	const world = value as RegistryWorld;
	return (
		typeof world.id === 'string' &&
		world.id.length > 0 &&
		typeof world.title === 'string' &&
		typeof world.url === 'string' &&
		world.url.length > 0 &&
		(world.dimensions === '2d' || world.dimensions === '3d')
	);
}

export async function fetchRegistryCatalog(
	catalogUrl = DEFAULT_REGISTRY_URL,
	fetchImpl: typeof fetch = fetch
): Promise<RegistryWorld[]> {
	const response = await fetchImpl(catalogUrl, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`Registry fetch failed: ${response.status} ${response.statusText}`);
	}

	let doc: WorldCatalog;
	try {
		doc = (await response.json()) as WorldCatalog;
	} catch {
		throw new Error('Registry catalog is not valid JSON');
	}

	if (!Array.isArray(doc.worlds)) return [];
	return doc.worlds.filter(isRegistryWorld);
}
