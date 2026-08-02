import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/** World authoring mutations are dev-only until Trellis-backed prod API lands. */
export function assertWorldAuthorDev(): void {
	if (!dev) throw error(404, 'Not found');
}
