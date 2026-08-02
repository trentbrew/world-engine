/**
 * Build a runtime component bag from schema defaults + optional overrides.
 * Mirrors loadOntology resolution so inspector adds match world-file hydration.
 */
import { compile, isFormula } from '$lib/engine/formula/parse';
import type {
	ComponentData,
	ComponentSchema,
	CompiledFormula,
	FieldType
} from '$lib/engine/ontology/schema';

export function createComponentBag(
	schema: ComponentSchema,
	raw: ComponentData = {}
): { bag: ComponentData; formulas?: Record<string, CompiledFormula> } {
	const formulaFields: Record<string, string> = {};
	const bag = resolveFields(schema, raw, formulaFields);
	const formulas =
		Object.keys(formulaFields).length > 0
			? Object.fromEntries(
					Object.entries(formulaFields).map(([field, src]) => [field, compile(src)])
				)
			: undefined;
	return { bag, formulas };
}

function resolveFields(
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
	return out;
}

function coerce(t: FieldType, value: unknown): unknown {
	switch (t) {
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
