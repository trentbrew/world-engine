/** Clone component bag data without structuredClone (Svelte $state proxies are not cloneable). */
export function cloneComponentBag(bag: Record<string, unknown>): Record<string, unknown> {
	return JSON.parse(JSON.stringify(bag));
}

export function cloneComponentMap(
	components: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
	return Object.fromEntries(
		Object.entries(components).map(([name, bag]) => [name, cloneComponentBag(bag)])
	);
}
