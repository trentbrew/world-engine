/** View modes for the Assets route full-screen inspector. */

import type { GltfInspection } from '$lib/assets/inspectGltf';

export type MaterialChannel =
	| 'lit'
	| 'baseColor'
	| 'normals'
	| 'emissive'
	| 'roughness'
	| 'metalness'
	| 'uvChecker';

export const MATERIAL_CHANNEL_LABELS: Record<MaterialChannel, string> = {
	lit: 'Lit',
	baseColor: 'Base color',
	normals: 'Normals',
	emissive: 'Emissive',
	roughness: 'Roughness',
	metalness: 'Metalness',
	uvChecker: 'UV checker'
};

export type AssetPreviewViewMode = {
	wireframe: boolean;
	showBones: boolean;
	showNormals: boolean;
	materialChannel: MaterialChannel;
};

const DEFAULT_VIEW: AssetPreviewViewMode = {
	wireframe: false,
	showBones: false,
	showNormals: false,
	materialChannel: 'lit'
};

class AssetPreviewState {
	view = $state<AssetPreviewViewMode>({ ...DEFAULT_VIEW });
	inspection = $state<GltfInspection | null>(null);
	audioLoop = $state(true);
	audioVolume = $state(1);

	toggle(key: 'wireframe' | 'showBones' | 'showNormals') {
		this.view = { ...this.view, [key]: !this.view[key] };
	}

	setMaterialChannel(channel: MaterialChannel) {
		this.view = { ...this.view, materialChannel: channel };
	}

	setInspection(inspection: GltfInspection | null) {
		this.inspection = inspection;
	}

	setAudioLoop(loop: boolean) {
		this.audioLoop = loop;
	}

	setAudioVolume(volume: number) {
		this.audioVolume = Math.max(0, Math.min(1, volume));
	}

	resetView() {
		this.view = { ...DEFAULT_VIEW };
	}
}

export const assetPreview = new AssetPreviewState();
