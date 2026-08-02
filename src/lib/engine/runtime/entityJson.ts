import { getComponent } from '$lib/engine/ontology/registry';
import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

export interface EntityJsonDoc {
	'@id': string;
	conformsTo?: string;
	components: Record<string, ComponentData>;
}

/** Serialize an entity to a JSON-LD-style fragment (formulas as `=…` strings). */
export function entityToJsonDoc(entity: Entity): EntityJsonDoc {
	const components: Record<string, ComponentData> = {};

	for (const [name, bag] of Object.entries(entity.components)) {
		const out: ComponentData = { ...bag };
		const formulaBag = entity.formulas?.[name];
		if (formulaBag) {
			for (const [field, compiled] of Object.entries(formulaBag)) {
				out[field] = compiled.src;
			}
		}
		components[name] = out;
	}

	return {
		'@id': entity.id,
		...(entity.type ? { conformsTo: entity.type } : {}),
		components
	};
}

export function entityToJsonString(entity: Entity): string {
	return JSON.stringify(entityToJsonDoc(entity), null, 2);
}

export type ApplyEntityJsonResult = { ok: true } | { ok: false; error: string };

/**
 * Apply a parsed entity JSON fragment to a live entity. Validates @id, coerces
 * fields through component schemas, and recompiles formula strings.
 */
export function parseEntityJsonPatch(
	entity: Entity,
	doc: unknown
): ApplyEntityJsonResult & { patch?: EntityJsonDoc } {
	if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
		return { ok: false, error: 'Document must be a JSON object' };
	}

	const raw = doc as Record<string, unknown>;
	const id = raw['@id'];
	if (typeof id === 'string' && id !== entity.id) {
		return { ok: false, error: `@id must match ${entity.id}` };
	}

	const components = raw.components;
	if (!components || typeof components !== 'object' || Array.isArray(components)) {
		return { ok: false, error: 'Missing or invalid components object' };
	}

	const conformsTo = raw.conformsTo;
	if (conformsTo !== undefined && typeof conformsTo !== 'string') {
		return { ok: false, error: 'conformsTo must be a string' };
	}

	return {
		ok: true,
		patch: {
			'@id': entity.id,
			...(typeof conformsTo === 'string' ? { conformsTo } : {}),
			components: components as Record<string, ComponentData>
		}
	};
}

export function buildComponentsFromJson(
	entityId: string,
	components: Record<string, ComponentData>
): ApplyEntityJsonResult & {
	components?: Record<string, ComponentData>;
	formulas?: Entity['formulas'];
} {
	const out: Record<string, ComponentData> = {};
	const formulas: NonNullable<Entity['formulas']> = {};

	for (const [name, rawBag] of Object.entries(components)) {
		const schema = getComponent(name);
		if (!schema) {
			return { ok: false, error: `Unknown component "${name}" on ${entityId}` };
		}
		if (!rawBag || typeof rawBag !== 'object' || Array.isArray(rawBag)) {
			return { ok: false, error: `Component "${name}" must be an object` };
		}

		const { bag, formulas: compiled } = createComponentBag(schema, rawBag);
		out[name] = bag;
		if (compiled) formulas[name] = compiled;
	}

	return {
		ok: true,
		components: out,
		formulas: Object.keys(formulas).length > 0 ? formulas : undefined
	};
}
