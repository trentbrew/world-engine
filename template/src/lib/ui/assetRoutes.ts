import type { AssetKind } from '$lib/assets/catalog';
import type { RailRoute } from '$lib/ui/ui.svelte';

/**
 * Top-level rail destinations for authored media. `assets` is the umbrella
 * route that hosts Models / Textures / Audio / Files as internal tabs; the
 * kind-specific routes remain valid for programmatic pick/navigation.
 */
export type AssetRoute = 'assets' | 'models' | 'textures' | 'audio' | 'files';

export const ASSET_ROUTES: AssetRoute[] = ['models', 'textures', 'audio', 'files', 'assets'];

export function isAssetRoute(route: RailRoute): route is AssetRoute {
	return (
		route === 'assets' ||
		route === 'models' ||
		route === 'textures' ||
		route === 'audio' ||
		route === 'files'
	);
}

export function assetRouteForKind(kind: AssetKind): AssetRoute {
	return kind;
}

export function assetRouteLabel(route: AssetRoute): string {
	switch (route) {
		case 'assets':
			return 'Assets';
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
