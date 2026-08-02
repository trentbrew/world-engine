/**
 * Loads a world from a JSON-LD document into live, validated entities.
 *
 * The document `@graph` may contain three kinds of node:
 *   - ComponentSchema  → registered as a new component definition
 *   - EntityType       → registered as a new composable type
 *   - everything else  → an entity instance (a "Thing")
 *
 * Instances declare `conformsTo` (an EntityType) and/or an inline `components`
 * bag. Type defaults are merged under instance data, then every field is coerced
 * to its schema type. Unknown components/fields are warned-and-skipped so a typo
 * never takes down the whole world (matches the resilience of the old loader).
 */
import { compile, isFormula } from '$lib/engine/formula/parse';
import {
	getComponent,
	getType,
	hasComponent,
	registerComponent,
	registerType
} from './registry';
import { isRoomMetaNode } from './roomCatalog';
import { isScriptMetaNode } from './scriptCatalog';
import { entityComponentBags, staticSource, type JsonLdNode, type WorldSource } from './source';
import type {
	CompiledFormula,
	ComponentData,
	ComponentSchema,
	Entity,
	EntityEvents,
	FieldSchema,
	FieldType
} from './schema';

const WORLD_URL = '/world.jsonld';

export async function loadOntology(source: WorldSource = staticSource()): Promise<Entity[]> {
	const document = await source();

	const graph = document?.['@graph'];
	if (!Array.isArray(graph) || graph.length === 0) {
		throw new Error('World graph is empty');
	}

	// First pass: register any schema/type definitions so instances can use them.
	for (const node of graph) {
		if (node['@type'] === 'ComponentSchema') registerComponentNode(node);
		else if (node['@type'] === 'EntityType') registerTypeNode(node);
	}

	// Second pass: build entity instances.
	const entities: Entity[] = [];
	for (const node of graph) {
		if (
			node['@type'] === 'ComponentSchema' ||
			node['@type'] === 'EntityType' ||
			isRoomMetaNode(node) ||
			isScriptMetaNode(node)
		) {
			continue;
		}
		const entity = buildEntity(node);
		if (entity) entities.push(entity);
	}

	return entities;
}

function registerComponentNode(node: JsonLdNode): void {
	const name = node['@id']?.replace(/^component:/, '') ?? (node.name as string | undefined);
	const fields = node.fields as Record<string, FieldSchema> | undefined;
	if (!name || !fields) {
		console.warn('[ontology] Skipping ComponentSchema missing name/fields:', node);
		return;
	}
	registerComponent({ name, fields });
}

function registerTypeNode(node: JsonLdNode): void {
	const name = node['@id']?.replace(/^type:/, '') ?? (node.name as string | undefined);
	const components = node.components as unknown;
	if (!name || !Array.isArray(components)) {
		console.warn('[ontology] Skipping EntityType missing name/components:', node);
		return;
	}
	registerType({
		name,
		components: components as string[],
		defaults: node.defaults as Record<string, ComponentData> | undefined,
		events: node.events as EntityEvents | undefined,
		collection: node.collection === true,
		collectionMeta: node.collectionMeta as import('./schema').CollectionMeta | undefined
	});
}

function buildEntity(node: JsonLdNode): Entity | null {
	const id = node['@id'];
	if (!id) {
		console.warn('[ontology] Skipping node missing @id:', node);
		return null;
	}

	const typeName = node.conformsTo;
	const type = typeName ? getType(typeName) : undefined;
	if (typeName && !type) {
		console.warn(`[ontology] Unknown type "${typeName}" for ${id}, treating as untyped`);
	}

	// Component names: those required by the type plus any declared inline.
	const inline = entityComponentBags(node);
	const names = new Set<string>([...(type?.components ?? []), ...Object.keys(inline)]);

	const components: Record<string, ComponentData> = {};
	const formulas: Record<string, Record<string, CompiledFormula>> = {};
	for (const name of names) {
		const schema = getComponent(name);
		if (!schema) {
			console.warn(`[ontology] Unknown component "${name}" on ${id}, skipping`);
			continue;
		}
		const typeDefault = type?.defaults?.[name] ?? {};
		const raw = { ...typeDefault, ...(inline[name] ?? {}) };
		const formulaFields: Record<string, string> = {};
		components[name] = resolveComponent(id, schema, raw, formulaFields);
		if (Object.keys(formulaFields).length > 0) {
			formulas[name] = Object.fromEntries(
				Object.entries(formulaFields).map(([field, src]) => [field, compile(src)])
			);
		}
	}

	if (!hasAnyComponent(names)) {
		console.warn(`[ontology] Entity ${id} has no known components, rendering nothing`);
	}

	// Events come from the instance (inline) or, failing that, the type it conforms to.
	const events = (node.events as EntityEvents | undefined) ?? type?.events;

	return {
		id,
		type: typeName,
		components,
		formulas: Object.keys(formulas).length > 0 ? formulas : undefined,
		events,
		children: Array.isArray(node.children) ? (node.children as string[]) : undefined,
		raw: node as Record<string, unknown>
	};
}

function hasAnyComponent(names: Set<string>): boolean {
	for (const name of names) if (hasComponent(name)) return true;
	return false;
}

/**
 * Apply field defaults and coerce each field to its declared type. Formula values
 * (literal or default) are routed into `formulaFields` for the formula engine to
 * derive each tick, rather than stored as data.
 */
function resolveComponent(
	entityId: string,
	schema: ComponentSchema,
	raw: ComponentData,
	formulaFields: Record<string, string>
): ComponentData {
	const out: ComponentData = {};
	for (const [field, spec] of Object.entries(schema.fields)) {
		let value = raw[field];
		if (value === undefined) {
			if (spec.default === undefined) continue;
			value = spec.default;
		}
		if (isFormula(value)) {
			formulaFields[field] = value;
			continue;
		}
		out[field] = coerce(spec.t, value);
	}
	for (const field of Object.keys(raw)) {
		if (!(field in schema.fields)) {
			console.warn(`[ontology] Unknown field "${field}" on ${entityId}, ignoring`);
		}
	}
	return out;
}

function coerce(t: FieldType, value: unknown): unknown {
	switch (t) {
		case 'vec2':
			return toVec2(value);
		case 'vec3':
			return toVec3(value);
		case 'quat':
			return toQuat(value);
		case 'ref':
			return toRef(value);
		case 'number':
			return typeof value === 'number' ? value : Number(value);
		case 'boolean':
			return Boolean(value);
		default:
			return value;
	}
}

function toVec2(value: unknown): [number, number] {
	if (Array.isArray(value)) return [num(value[0]), num(value[1])];
	if (value && typeof value === 'object') {
		const v = value as { x?: number; y?: number };
		return [num(v.x), num(v.y)];
	}
	return [0, 0];
}

function toVec3(value: unknown): [number, number, number] {
	if (Array.isArray(value)) return [num(value[0]), num(value[1]), num(value[2])];
	if (value && typeof value === 'object') {
		const v = value as { x?: number; y?: number; z?: number };
		return [num(v.x), num(v.y), num(v.z)];
	}
	return [0, 0, 0];
}

function toQuat(value: unknown): [number, number, number, number] | undefined {
	if (!value) return undefined;
	if (Array.isArray(value)) return [num(value[0]), num(value[1]), num(value[2]), num(value[3], 1)];
	if (typeof value === 'object') {
		const q = value as { x?: number; y?: number; z?: number; w?: number };
		return [num(q.x), num(q.y), num(q.z), num(q.w, 1)];
	}
	return undefined;
}

function toRef(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object' && '@id' in value) {
		const id = (value as { '@id'?: string })['@id'];
		return typeof id === 'string' ? id : undefined;
	}
	return undefined;
}

function num(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export { WORLD_URL };
