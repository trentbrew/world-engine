/**
 * Depth bias for floor/backdrop meshes so objects resting on the ground win the
 * depth test. Without this, OutlineEffect sees coplanar contact pixels (especially
 * on PlaneGeometry's center diagonal at world origin) and drops half the silhouette.
 */
export const BACKDROP_POLYGON_OFFSET = {
	polygonOffset: true,
	polygonOffsetFactor: 3,
	polygonOffsetUnits: 6
} as const;
