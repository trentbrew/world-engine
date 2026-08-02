import type { MeshAnchor } from '$lib/engine/render/meshAnchor';

export type SpriteAnchor = MeshAnchor;

/** Offset for a sprite quad so the chosen anchor sits on Transform.position. */
export function spriteAnchorOffset(
	width: number,
	height: number,
	anchor: SpriteAnchor
): [number, number] {
	if (anchor === 'origin') return [0, 0];
	if (anchor === 'bottom') return [0, height / 2];
	return [0, 0];
}

/** World-unit size for a sprite frame given pixels-per-unit. */
export function spriteWorldSize(
	frameWidth: number,
	frameHeight: number,
	pixelsPerUnit: number
): [number, number] {
	const ppu = Math.max(1, pixelsPerUnit);
	return [frameWidth / ppu, frameHeight / ppu];
}
