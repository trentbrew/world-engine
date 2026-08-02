import { getComponent } from '$lib/engine/ontology/registry';
import type { SyncPolicy } from '$lib/engine/ontology/schema';
import { isDerivedField } from '$lib/engine/runtime/setField';

/** Effective sync policy for a component field (omitted → durable). */
export function syncPolicyFor(component: string, field: string): SyncPolicy {
	const spec = getComponent(component)?.fields[field];
	if (spec?.sync) return spec.sync;
	return 'durable';
}

/** Field names on a component flagged `sync: 'durable'` (default policy). */
export function durableFields(component: string): string[] {
	const schema = getComponent(component);
	if (!schema) return [];
	return Object.entries(schema.fields)
		.filter(([, spec]) => (spec.sync ?? 'durable') === 'durable')
		.map(([name]) => name);
}

/** Whether a runtime value should be persisted in the durable tier. */
export function isDurableField(component: string, field: string, value: unknown): boolean {
	if (isDerivedField(component, field, value)) return false;
	return syncPolicyFor(component, field) === 'durable';
}
