import { resolveCharacterDefaults } from '$lib/engine/animation/characterMeshDefaults';
import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import { getComponent } from '$lib/engine/ontology/registry';
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

export const ASSET_PREVIEW_ENTITY_ID = 'preview:asset';

export type AssetPreviewOverrides = {
	clip?: string;
};

/** Ephemeral entity for asset-route animated model preview — never in world.entities. */
export function buildAssetPreviewEntity(
	meshUrl: string,
	overrides: AssetPreviewOverrides = {}
): Entity {
	const defaults = resolveCharacterDefaults(meshUrl);
	const components: Record<string, ComponentData> = {};

	const skinnedSchema = getComponent('SkinnedMesh');
	if (skinnedSchema) {
		const { bag } = createComponentBag(skinnedSchema, {
			mesh: meshUrl,
			anchor: 'bottom',
			forwardYaw: defaults.forwardYaw ?? 0
		});
		components.SkinnedMesh = bag;
	}

	const animatorSchema = getComponent('Mesh3DAnimator');
	if (animatorSchema) {
		const { bag } = createComponentBag(animatorSchema, {
			catalog: defaults.catalog,
			clip: overrides.clip ?? defaults.clip,
			playing: true,
			loop: true
		});
		components.Mesh3DAnimator = bag;
	}

	return {
		id: ASSET_PREVIEW_ENTITY_ID,
		type: 'Character',
		components,
		raw: {}
	};
}
