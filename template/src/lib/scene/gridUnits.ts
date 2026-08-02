/** Authoring primitives sized to match the editor grid — one cell = one world unit. */

export function boxSize(cellSize: number): number {
	return cellSize;
}

export function sphereRadius(cellSize: number): number {
	return cellSize / 2;
}

/** CapsuleGeometry args: [radius, cylinderLength, capSegments, radialSegments] */
export function capsuleGeometryArgs(cellSize: number): [number, number, number, number] {
	return [cellSize * 0.32, cellSize * 0.5, 4, 14];
}

/** Rapier cuboid half-extents for a 1-cell box. */
export function cuboidHalfExtents(cellSize: number): [number, number, number] {
	const h = cellSize / 2;
	return [h, h, h];
}

/** Y position so a primitive's bottom rests on y = 0 (center-pivot meshes). */
export function primitiveRestY(mesh: string, cellSize: number): number {
	if (mesh === 'primitive:capsule') return cellSize * 0.57;
	if (mesh === 'primitive:sphere') return sphereRadius(cellSize);
	return cellSize / 2;
}

/** Snap world X/Z to the nearest cell center. */
export function snapCellCenter(value: number, cellSize: number): number {
	return Math.round(value / cellSize) * cellSize;
}

export function footprintCell(
	position: [number, number, number],
	cellSize: number
): [number, number, number] {
	return [
		snapCellCenter(position[0], cellSize),
		0.025,
		snapCellCenter(position[2], cellSize)
	];
}
