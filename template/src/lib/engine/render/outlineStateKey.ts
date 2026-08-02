import type { OutlineLayer } from '$lib/engine/render/outlineLayers';

/** Stable key for outline pass rebuilds — avoids reactive ping-pong with mesh registration. */
export function outlineStateKey(
	layers: OutlineLayer[],
	registryFingerprint: string,
	enabled: boolean
): string {
	if (!enabled) return 'off';

	const layerKey = layers
		.map((layer) => `${layer.id}:${layer.entityIds.join('+')}:${layer.emphasized}:${layer.color}`)
		.join('|');

	return `${registryFingerprint}::${layerKey}`;
}
