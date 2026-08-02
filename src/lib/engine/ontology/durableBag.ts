import { isDurableField } from '$lib/engine/ontology/syncPolicy';

/** Strip non-durable fields before writing a component bag to the graph. */
export function durableBagOnly(
	component: string,
	bag: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [field, value] of Object.entries(bag)) {
		if (isDurableField(component, field, value)) out[field] = value;
	}
	return out;
}

/** Durable-filter every component bag on an entity. */
export function durableComponentsOnly(
	components: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
	const out: Record<string, Record<string, unknown>> = {};
	for (const [name, bag] of Object.entries(components)) {
		out[name] = durableBagOnly(name, bag);
	}
	return out;
}
