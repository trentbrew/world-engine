import type { Component } from 'svelte';
import { peerColor } from '$lib/engine/collab/peerColor';
import { toast } from '$lib/ui/toast.svelte';

export type PeerToastOptions = {
	id?: string;
	description?: string;
	duration?: number;
	icon?: Component;
};

/** Toast tinted to a collab peer — top stack under avatars. */
export function peerToast(peerId: string, message: string, opts: PeerToastOptions = {}) {
	const accent = peerColor(peerId);
	toast.message(message, {
		id: opts.id,
		description: opts.description,
		duration: opts.duration ?? 3500,
		icon: opts.icon,
		class: 'peer-toast',
		style: `--peer-accent: ${accent};`
	});
}

/** Local session actions use the same chrome without a peer id. */
export function localToast(
	message: string,
	opts: PeerToastOptions & { variant?: 'message' | 'success' | 'error' | 'warning' | 'info' } = {}
) {
	const variant = opts.variant ?? 'message';
	const payload = {
		id: opts.id,
		description: opts.description,
		duration: opts.duration,
		icon: opts.icon,
		class: 'app-toast',
		style: `--peer-accent: var(--primary);`
	};
	switch (variant) {
		case 'success':
			toast.success(message, payload);
			break;
		case 'error':
			toast.error(message, payload);
			break;
		case 'warning':
			toast.warning(message, payload);
			break;
		case 'info':
			toast.info(message, payload);
			break;
		default:
			toast.message(message, payload);
	}
}
