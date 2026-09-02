import {
	DEFAULT_REGISTRY_URL,
	fetchRegistryCatalog,
	toRegistryGameEntry,
	type RegistryWorld
} from '$lib/engine/worldRegistry';
import type { GameEntry } from '$lib/engine/games';

function prettifyWorldUrl(worldUrl: string): string {
	const slug = worldUrl.split('/').pop()?.replace(/\.jsonld$/i, '') ?? 'World';
	return (
		slug
			.split(/[-_/]+/)
			.filter(Boolean)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ') || slug
	);
}

class WorldRegistryState {
	worlds = $state<RegistryWorld[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	catalogUrl = $state(DEFAULT_REGISTRY_URL);

	registryGames = $derived(this.worlds.map(toRegistryGameEntry));

	async load(catalogUrl = DEFAULT_REGISTRY_URL): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			this.worlds = await fetchRegistryCatalog(catalogUrl);
			this.catalogUrl = catalogUrl;
		} catch (err) {
			this.worlds = [];
			this.error = err instanceof Error ? err.message : 'Failed to load registry';
		} finally {
			this.loading = false;
		}
	}

	findByUrl(worldUrl: string): GameEntry | null {
		return this.registryGames.find((entry) => entry.worldUrl === worldUrl) ?? null;
	}

	findByParam(param: string): GameEntry | null {
		return this.registryGames.find((entry) => entry.param === param) ?? null;
	}
}

export const worldRegistry = new WorldRegistryState();

export function resolveRemoteWorld(worldUrl: string): GameEntry {
	return (
		worldRegistry.findByUrl(worldUrl) ?? {
			title: prettifyWorldUrl(worldUrl),
			description: '',
			dimensions: '3d',
			source: 'registry',
			worldUrl
		}
	);
}
