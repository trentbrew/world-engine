import type { FieldSchema, FieldType, RefTarget } from '$lib/engine/ontology/schema';

export const COMPONENT_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;
export const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;

export function validateComponentName(name: string): { ok: true } | { ok: false; error: string } {
	const trimmed = name.trim();
	if (!trimmed) return { ok: false, error: 'Name required' };
	if (!COMPONENT_NAME_PATTERN.test(trimmed)) {
		return { ok: false, error: 'Use PascalCase (e.g. QuestData)' };
	}
	return { ok: true };
}

export function validateFieldName(name: string): { ok: true } | { ok: false; error: string } {
	const trimmed = name.trim();
	if (!trimmed) return { ok: false, error: 'Field name required' };
	if (!FIELD_NAME_PATTERN.test(trimmed)) {
		return { ok: false, error: 'Use camelCase (e.g. displayName)' };
	}
	return { ok: true };
}

export function defaultForFieldType(t: FieldType, of?: RefTarget, options?: string[]): unknown {
	switch (t) {
		case 'number':
			return 0;
		case 'boolean':
			return false;
		case 'color':
			return '#ffffff';
		case 'string':
		case 'longtext':
			return '';
		case 'select':
			return options?.[0] ?? '';
		case 'ref':
			return of?.kind === 'record' || of?.kind === 'entity' ? '' : '';
		default:
			return undefined;
	}
}

export function buildFieldSchema(
	t: FieldType,
	opts: { of?: RefTarget; options?: string[]; default?: unknown } = {}
): FieldSchema {
	const spec: FieldSchema = { t };
	if (opts.of) spec.of = opts.of;
	const cleanOptions = opts.options?.map((o) => o.trim()).filter(Boolean);
	if (t === 'select' && cleanOptions && cleanOptions.length > 0) spec.options = cleanOptions;
	const fallback = defaultForFieldType(t, opts.of, cleanOptions);
	if (opts.default !== undefined) spec.default = opts.default;
	else if (fallback !== undefined) spec.default = fallback;
	return spec;
}
