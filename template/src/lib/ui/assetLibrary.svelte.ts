/** Shared asset library state for the left-panel Assets tab. */

import { dev } from '$app/environment';
import {
	fetchAssets,
	sortAssets,
	uploadAsset,
	type AssetEntry,
	type AssetKind
} from '$lib/assets/catalog';
import {
	canStartPlacement,
	cancelPlacement,
	startPlacement,
	type PlacementDraft
} from '$lib/scene/placementSession';
import { writePlacementDrag } from '$lib/scene/placementDrag';
import { world } from '$lib/engine/runtime/world.svelte';
import { ui } from '$lib/ui/ui.svelte';
import { isAssetRoute } from '$lib/ui/assetRoutes';
import { catalogPrefs } from '$lib/ui/catalogPrefs.svelte';
import { toast } from '$lib/ui/toast.svelte';
import type { ShapeEntry } from '$lib/assets/shapes';
import { SHAPE_CATALOG } from '$lib/assets/shapes';

class AssetLibraryState {
	assets = $state<AssetEntry[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);
	uploadingKind = $state<AssetKind | null>(null);
	searchQuery = $state('');
	playingAudioUrl = $state<string | null>(null);
	#audioPreview: HTMLAudioElement | null = null;
	#loaded = false;

	matchesSearch(label: string, query = this.searchQuery): boolean {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		return label.toLowerCase().includes(q);
	}

	grouped(kind: AssetKind, query = this.searchQuery): AssetEntry[] {
		void catalogPrefs.starredAssets;
		const filtered = this.assets.filter(
			(asset) => asset.kind === kind && this.matchesSearch(asset.name, query)
		);
		return [...filtered].sort((a, b) => {
			const aStar = catalogPrefs.isAssetStarred(a.url) ? 0 : 1;
			const bStar = catalogPrefs.isAssetStarred(b.url) ? 0 : 1;
			if (aStar !== bStar) return aStar - bStar;
			return a.name.localeCompare(b.name);
		});
	}

	filteredShapes(query = this.searchQuery): ShapeEntry[] {
		return SHAPE_CATALOG.filter(
			(shape) =>
				this.matchesSearch(shape.label, query) || this.matchesSearch(shape.mesh, query)
		);
	}

	async ensureLoaded() {
		if (this.#loaded && !this.error) return;
		await this.refresh();
	}

	async refresh() {
		this.loading = true;
		this.error = null;
		try {
			this.assets = await fetchAssets();
			this.#loaded = true;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to load assets';
		} finally {
			this.loading = false;
		}
	}

	/** Inject assets without a follow-up fetch overwriting them (tests/dev). */
	replaceAssets(assets: AssetEntry[]) {
		this.assets = sortAssets(assets);
		this.loading = false;
		this.error = null;
		this.#loaded = true;
	}

	selectAsset(asset: AssetEntry) {
		const target = ui.assetPickTarget;
		if (target) {
			if ('typeName' in target) {
				world.setTypeDefault(target.typeName, target.component, target.field, asset.url);
			} else {
				world.setField(target.entityId, target.component, target.field, asset.url);
			}
			toast.success(`Applied ${asset.name}`);
			ui.assetPickTarget = null;
			if ('typeName' in target) {
				ui.setRoute('objects');
			} else if (isAssetRoute(ui.railRoute)) {
				ui.setRoute('rooms');
			}
			return;
		}

		ui.openAssetPreview(asset);
		catalogPrefs.touchRecentAsset(asset.url);
	}

	selectShape(shape: ShapeEntry) {
		const target = ui.assetPickTarget;
		if (target && target.field === 'mesh') {
			if ('typeName' in target) {
				world.setTypeDefault(target.typeName, target.component, target.field, shape.mesh);
			} else {
				world.setField(target.entityId, target.component, target.field, shape.mesh);
			}
			toast.success(`Applied ${shape.label}`);
			ui.assetPickTarget = null;
			if ('typeName' in target) {
				ui.setRoute('objects');
			} else if (isAssetRoute(ui.railRoute)) {
				ui.setRoute('rooms');
			}
			return;
		}
		this.previewShape(shape);
	}

	previewShape(shape: ShapeEntry) {
		if (ui.assetPickTarget) return;
		ui.openShapePreview(shape);
		catalogPrefs.touchRecentAsset(`shape:${shape.id}`);
	}

	toggleAudioPlayback(url: string) {
		if (this.playingAudioUrl === url && this.#audioPreview && !this.#audioPreview.paused) {
			this.#audioPreview.pause();
			this.playingAudioUrl = null;
			return;
		}

		this.#audioPreview?.pause();
		const audio = new Audio(url);
		this.#audioPreview = audio;
		this.playingAudioUrl = url;

		const clearIfCurrent = () => {
			if (this.playingAudioUrl === url) this.playingAudioUrl = null;
		};

		audio.addEventListener('ended', clearIfCurrent, { once: true });
		audio.addEventListener('error', clearIfCurrent, { once: true });

		void audio.play().catch(clearIfCurrent);
	}

	beginPlacementDrag(event: DragEvent, draft: PlacementDraft) {
		if (!canStartPlacement() || this.uploadingKind !== null || !event.dataTransfer) return;
		writePlacementDrag(event.dataTransfer, draft);
		startPlacement(draft);
	}

	endPlacementDrag() {
		if (ui.placementDraft) cancelPlacement();
	}

	shouldAutoApply(asset: AssetEntry): boolean {
		const target = ui.assetPickTarget;
		if (!target) return false;
		if (target.field === 'mesh') return asset.kind === 'models';
		return true;
	}

	registerAsset(asset: AssetEntry) {
		this.assets = sortAssets([...this.assets.filter((entry) => entry.url !== asset.url), asset]);
		if (this.shouldAutoApply(asset)) this.selectAsset(asset);
		else toast.success(`Added ${asset.name}`);
	}

	async uploadFiles(kind: AssetKind, files: File[]) {
		if (!dev || files.length === 0) return;

		this.uploadingKind = kind;
		try {
			for (const file of files) {
				const asset = await uploadAsset(kind, file);
				this.registerAsset(asset);
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Upload failed');
		} finally {
			this.uploadingKind = null;
		}
	}
}

export const assetLibrary = new AssetLibraryState();
