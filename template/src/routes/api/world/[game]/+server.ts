import { error, json } from '@sveltejs/kit';
import {
	entityJson,
	listEntityNodes,
	readWorldFile
} from '$lib/engine/authoring/worldFileStore';
import { normalizeGameParam } from '$lib/engine/authoring/worldPaths';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const game = normalizeGameParam(params.game);
	try {
		const doc = await readWorldFile(game);
		const graph = doc['@graph'] ?? [];
		const entities = listEntityNodes(graph).map((node) => ({
			id: node['@id'],
			type: node.conformsTo,
			components: Object.keys(node.components && !Array.isArray(node.components) ? node.components : {})
		}));
		const types = graph
			.filter((node) => node['@type'] === 'EntityType')
			.map((node) => node['@id']?.replace(/^type:/, '') ?? node.name);
		const schemas = graph
			.filter((node) => node['@type'] === 'ComponentSchema')
			.map((node) => node['@id']?.replace(/^component:/, '') ?? node.name);

		return json({
			game: params.game,
			path: game ? `/games/${game}.jsonld` : '/world.jsonld',
			entityCount: entities.length,
			entities,
			types,
			schemas
		});
	} catch {
		throw error(404, `World not found: ${params.game}`);
	}
};
