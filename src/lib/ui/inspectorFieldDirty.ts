import { getComponent, getType } from '$lib/engine/ontology/registry';
import type { Entity } from '$lib/engine/ontology/schema';

const EPS = 1e-6;

function isFormula(value: unknown): boolean {
	return typeof value === 'string' && value.startsWith('=');
}

function normalizeScalar(value: unknown): unknown {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return value;
		return Math.round(value / EPS) * EPS;
	}
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') return value.trim();
	return value;
}

function normalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeScalar(entry));
	}
	return normalizeScalar(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
	const left = normalize(a);
	const right = normalize(b);
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return false;
		return left.every((entry, index) => valuesEqual(entry, right[index]));
	}
	return left === right;
}

/** Effective schema/type default for dirty comparison — never the live instance value. */
export function resolveInspectorFieldDefault(
	entity: Entity,
	component: string,
	field: string
): unknown | undefined {
	let resolved: unknown = getComponent(component)?.fields[field]?.default;

	const typeName = entity.type;
	if (typeName) {
		const typeDefault = getType(typeName)?.defaults?.[component]?.[field];
		if (typeDefault !== undefined) resolved = typeDefault;
	}

	if (resolved === undefined || isFormula(resolved)) return undefined;
	return resolved;
}

export function isInspectorFieldDirty(
	entity: Entity,
	component: string,
	field: string,
	value: unknown
): boolean {
	if (isFormula(value)) return false;
	const defaultValue = resolveInspectorFieldDefault(entity, component, field);
	if (defaultValue === undefined) return false;
	return !valuesEqual(value, defaultValue);
}

export function isInspectorAxisDirty(
	entity: Entity,
	component: string,
	field: string,
	axisIndex: number,
	value: unknown
): boolean {
	if (isFormula(value)) return false;
	const defaultValue = resolveInspectorFieldDefault(entity, component, field);
	if (defaultValue === undefined) return false;
	const current = Array.isArray(value) ? value : [];
	const baseline = Array.isArray(defaultValue) ? defaultValue : [];
	return !valuesEqual(current[axisIndex], baseline[axisIndex] ?? 0);
}
