import { DataTexture, NearestFilter, RedFormat, type Texture } from 'three';

/**
 * Cached stepped gradient maps for MeshToonMaterial. A toon material samples
 * this 1D ramp by light intensity, so N texels => N flat shading bands.
 */
const cache = new Map<number, Texture>();

export function toonGradientMap(steps = 4): Texture {
	const clamped = Math.max(2, Math.min(8, Math.round(steps)));
	const existing = cache.get(clamped);
	if (existing) return existing;

	const data = new Uint8Array(clamped);
	for (let i = 0; i < clamped; i++) {
		data[i] = Math.round((i / (clamped - 1)) * 255);
	}

	const texture = new DataTexture(data, clamped, 1, RedFormat);
	texture.minFilter = NearestFilter;
	texture.magFilter = NearestFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;

	cache.set(clamped, texture);
	return texture;
}
