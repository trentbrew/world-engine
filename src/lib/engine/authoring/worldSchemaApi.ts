import { readWorldFile } from '$lib/engine/authoring/worldFileStore';
import { registerComponent, registerType } from '$lib/engine/ontology/registry';
import { getComponent, getType, listComponents, listTypes } from '$lib/engine/ontology/registry';
import type { JsonLdNode } from '$lib/engine/ontology/source';

function registerGraphSchemas(graph: JsonLdNode[]): void {
	for (const node of graph) {
		if (node['@type'] === 'ComponentSchema') {
			const name = node['@id']?.replace(/^component:/, '') ?? (node.name as string | undefined);
			const fields = node.fields as Record<string, unknown> | undefined;
			if (name && fields) registerComponent({ name, fields: fields as never });
		} else if (node['@type'] === 'EntityType') {
			const name = node['@id']?.replace(/^type:/, '') ?? (node.name as string | undefined);
			const components = node.components;
			if (name && Array.isArray(components)) {
				registerType({
					name,
					components: components as string[],
					defaults: node.defaults as Record<string, Record<string, unknown>> | undefined
				});
			}
		}
	}
}

export async function worldSchemaPayload(game?: string) {
	if (game) {
		const doc = await readWorldFile(game);
		registerGraphSchemas(doc['@graph'] ?? []);
	}

	const components = listComponents().map((name) => {
		const schema = getComponent(name);
		return { name, fields: schema?.fields ?? {} };
	});
	const types = listTypes().map((name) => {
		const type = getType(name);
		return {
			name,
			components: type?.components ?? [],
			defaults: type?.defaults ?? {}
		};
	});

	return { components, types };
}
