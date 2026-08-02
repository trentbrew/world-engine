/** Client-side catalog prefs: view mode, stars, recents (assets + object types). */

export type CatalogViewMode = 'grid' | 'list';

const STORAGE_KEY = 'playlab-catalog-prefs';
const RECENT_LIMIT = 8;

type StoredPrefs = {
	assetsViewMode?: CatalogViewMode;
	objectsViewMode?: CatalogViewMode;
	starredAssets?: string[];
	starredTypes?: string[];
	recentAssets?: string[];
	recentTypes?: string[];
};

function loadStored(): StoredPrefs {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as StoredPrefs) : {};
	} catch {
		return {};
	}
}

function persistStored(prefs: StoredPrefs) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		/* quota / private mode */
	}
}

function bumpRecent(list: string[], id: string): string[] {
	const next = [id, ...list.filter((entry) => entry !== id)];
	return next.slice(0, RECENT_LIMIT);
}

class CatalogPrefsState {
	assetsViewMode = $state<CatalogViewMode>('grid');
	objectsViewMode = $state<CatalogViewMode>('grid');
	starredAssets = $state<Set<string>>(new Set());
	starredTypes = $state<Set<string>>(new Set());
	recentAssets = $state<string[]>([]);
	recentTypes = $state<string[]>([]);

	constructor() {
		const stored = loadStored();
		this.assetsViewMode = stored.assetsViewMode ?? 'grid';
		this.objectsViewMode = stored.objectsViewMode ?? 'grid';
		this.starredAssets = new Set(stored.starredAssets ?? []);
		this.starredTypes = new Set(stored.starredTypes ?? []);
		this.recentAssets = stored.recentAssets ?? [];
		this.recentTypes = stored.recentTypes ?? [];
	}

	#save() {
		persistStored({
			assetsViewMode: this.assetsViewMode,
			objectsViewMode: this.objectsViewMode,
			starredAssets: [...this.starredAssets],
			starredTypes: [...this.starredTypes],
			recentAssets: this.recentAssets,
			recentTypes: this.recentTypes
		});
	}

	setAssetsViewMode(mode: CatalogViewMode) {
		this.assetsViewMode = mode;
		this.#save();
	}

	setObjectsViewMode(mode: CatalogViewMode) {
		this.objectsViewMode = mode;
		this.#save();
	}

	isAssetStarred(url: string): boolean {
		return this.starredAssets.has(url);
	}

	isTypeStarred(name: string): boolean {
		return this.starredTypes.has(name);
	}

	toggleAssetStar(url: string) {
		const next = new Set(this.starredAssets);
		if (next.has(url)) next.delete(url);
		else next.add(url);
		this.starredAssets = next;
		this.#save();
	}

	toggleTypeStar(name: string) {
		const next = new Set(this.starredTypes);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		this.starredTypes = next;
		this.#save();
	}

	touchRecentAsset(url: string) {
		this.recentAssets = bumpRecent(this.recentAssets, url);
		this.#save();
	}

	touchRecentType(name: string) {
		this.recentTypes = bumpRecent(this.recentTypes, name);
		this.#save();
	}
}

export const catalogPrefs = new CatalogPrefsState();
