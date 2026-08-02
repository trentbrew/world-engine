import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import { getComponent, getType, viewComponentsFor } from '$lib/engine/ontology/registry';
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

export const TYPE_PREVIEW_ENTITY_PREFIX = 'preview:type/';

export type TypePreviewOverrides = {
	/** Local clip override for Objects Animations preview (builtins can't setTypeDefault). */
	clip?: string;
};

/** Ephemeral entity for the Objects-route type canvas — never added to world.entities. */
export function buildTypePreviewEntity(
	typeName: string,
	overrides: TypePreviewOverrides = {}
): Entity | null {
	const type = getType(typeName);
	if (!type) return null;

	const components: Record<string, ComponentData> = {};
	const formulas: NonNullable<Entity['formulas']> = {};

	for (const compName of type.components) {
		const schema = getComponent(compName);
		if (!schema) continue;
		const raw = { ...(type.defaults?.[compName] ?? {}) };
		if (compName === 'Mesh3DAnimator' && overrides.clip) {
			raw.clip = overrides.clip;
		}
		const { bag, formulas: compiled } = createComponentBag(schema, raw);
		components[compName] = bag;
		if (compiled) formulas[compName] = compiled;
	}

	return {
		id: `${TYPE_PREVIEW_ENTITY_PREFIX}${typeName}`,
		type: typeName,
		components,
		formulas: Object.keys(formulas).length > 0 ? formulas : undefined,
		raw: {}
	};
}

export function typePreviewHasVisual(typeName: string): boolean {
	const type = getType(typeName);
	if (!type) return false;
	return viewComponentsFor(type.components).length > 0;
}
