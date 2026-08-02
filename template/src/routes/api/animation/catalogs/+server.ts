import { json } from '@sveltejs/kit';
import { listCatalogs } from '$lib/engine/authoring/animationCatalogApi';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ catalogs: await listCatalogs() });
};
