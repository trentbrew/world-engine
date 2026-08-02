import type { AssetKind } from '$lib/assets/catalog';
import type { RailRoute } from '$lib/ui/ui.svelte';

/** Top-level rail destinations for authored media. */
export type AssetRoute = 'models' | 'textures' | 'audio' | 'files';

export const ASSET_ROUTES: AssetRoute[] = ['models', 'textures', 'audio', 'files'];

export function isAssetRoute(route: RailRoute): route is AssetRoute {
	return route === 'models' || route === 'textures' || route === 'audio' || route === 'files';
}

export function assetRouteForKind(kind: AssetKind): AssetRoute {
	return kind;
}

export function assetRouteLabel(route: AssetRoute): string {
	switch (route) {
		case 'models':
			return 'Models';
		case 'textures':
			return 'Textures';
		case 'audio':
			return 'Audio';
		case 'files':
			return 'Files';
	}
}

/** Legacy section id → rail route (shapes fold into models). */
export function assetRouteForSection(section: 'shapes' | AssetKind): AssetRoute {
	return section === 'shapes' ? 'models' : section;
}
