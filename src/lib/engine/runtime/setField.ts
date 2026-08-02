import { getComponent } from '$lib/engine/ontology/registry';
import type { FieldType } from '$lib/engine/ontology/schema';

function parseNumber(raw: string): number | null {
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

/** Coerce inspector input into the typed runtime value for a component field. */
export function coerceFieldValue(type: FieldType | undefined, raw: unknown): unknown {
	switch (type) {
		case 'number':
			return typeof raw === 'number' ? raw : parseNumber(String(raw)) ?? 0;
		case 'boolean':
			return Boolean(raw);
		case 'vec2': {
			if (Array.isArray(raw) && raw.length >= 2) {
				return [Number(raw[0]) || 0, Number(raw[1]) || 0];
			}
			const parts = String(raw)
				.replace(/^\[|\]$/g, '')
				.split(',')
				.map((s) => s.trim());
			return [parseNumber(parts[0] ?? '0') ?? 0, parseNumber(parts[1] ?? '0') ?? 0];
		}
		case 'vec3': {
			if (Array.isArray(raw) && raw.length >= 3) {
				return [Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0];
			}
			const parts = String(raw)
				.replace(/^\[|\]$/g, '')
				.split(',')
				.map((s) => s.trim());
			return [parseNumber(parts[0] ?? '0') ?? 0, parseNumber(parts[1] ?? '0') ?? 0, parseNumber(parts[2] ?? '0') ?? 0];
		}
		case 'color':
		case 'string':
		case 'longtext':
		case 'select':
		case 'ref':
			return String(raw);
		default:
			return raw;
	}
}

export function fieldTypeFor(component: string, field: string): FieldType | undefined {
	return getComponent(component)?.fields[field]?.t;
}

export function isDerivedField(component: string, field: string, value: unknown): boolean {
	const spec = getComponent(component)?.fields[field];
	if (spec?.sync === 'derived') return true;
	return typeof value === 'string' && value.startsWith('=');
}

export function isReadOnlyField(component: string, field: string, value: unknown): boolean {
	return isDerivedField(component, field, value);
}
