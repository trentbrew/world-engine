import { error, json } from '@sveltejs/kit';
import { catalogDetail } from '$lib/engine/authoring/animationCatalogApi';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const catalog = url.searchParams.get('catalog');
	if (!catalog) throw error(400, 'Missing ?catalog= query parameter');
	const detail = await catalogDetail(catalog);
	if (!detail) throw error(404, `Unknown catalog: ${catalog}`);
	return json(detail);
};
