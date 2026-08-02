import type { ColliderShapeCastHit } from '@dimforge/rapier3d-compat';

export const PROBE_RADIUS = 0.08;
export const OUTER_RADIUS = 0.35;
export const INNER_RADIUS = 0.15;
export const STEP_HEIGHT = 0.35;
export const FLOOR_FUDGE = 0.05;
export const MAX_SLOPE_DEG = 60;
export const CAST_DISTANCE = STEP_HEIGHT + FLOOR_FUDGE + PROBE_RADIUS;
const MAX_SLOPE_COS = Math.cos((MAX_SLOPE_DEG * Math.PI) / 180);
const OUTER_DIAG = OUTER_RADIUS * 0.7071067811865476;

export type SampleOffset = readonly [number, number];

/** Center, inner ring (4), outer ring (8) — 13 samples total. */
export const SAMPLE_OFFSETS: SampleOffset[] = [
	[0, 0],
	[0, INNER_RADIUS],
	[0, -INNER_RADIUS],
	[INNER_RADIUS, 0],
	[-INNER_RADIUS, 0],
	[OUTER_RADIUS, 0],
	[-OUTER_RADIUS, 0],
	[0, OUTER_RADIUS],
	[0, -OUTER_RADIUS],
	[OUTER_DIAG, OUTER_DIAG],
	[-OUTER_DIAG, OUTER_DIAG],
	[OUTER_DIAG, -OUTER_DIAG],
	[-OUTER_DIAG, -OUTER_DIAG]
];

export type GroundSampleHit = {
	point: [number, number, number];
	normal: [number, number, number];
	toi: number;
	bodyHandle: number | null;
};

export function slopeNormalFromHit(hit: ColliderShapeCastHit): [number, number, number] {
	const n = hit.normal2;
	const ny = n.y >= 0 ? n.y : -n.y;
	const nx = n.y >= 0 ? n.x : -n.x;
	const nz = n.y >= 0 ? n.z : -n.z;
	return [nx, ny, nz];
}

export function isWalkableHit(hit: ColliderShapeCastHit): boolean {
	return Math.abs(hit.normal2.y) >= MAX_SLOPE_COS;
}

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0]
	];
}

function lenSq(v: Vec3): number {
	return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

function normalize(v: Vec3): Vec3 {
	const len = Math.hypot(v[0], v[1], v[2]);
	if (len < 1e-8) return [0, 1, 0];
	return [v[0] / len, v[1] / len, v[2] / len];
}

function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
	const crossProd = cross(sub(b, a), sub(c, a));
	if (lenSq(crossProd) < 1e-8) return null;
	const n = normalize(crossProd);
	return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n;
}

function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
	return Math.hypot(...cross(sub(b, a), sub(c, a))) * 0.5;
}

/** Area-weighted average of fan triangles from center to the outer ring. */
export function estimateGroundNormal(
	hits: (GroundSampleHit | null)[],
	centerHit: GroundSampleHit | null
): [number, number, number] {
	if (!centerHit) return [0, 1, 0];

	const center = centerHit.point;
	const outerStart = 5;
	let nx = 0;
	let ny = 0;
	let nz = 0;

	for (let i = 0; i < 8; i++) {
		const a = hits[outerStart + i];
		const b = hits[outerStart + ((i + 1) % 8)];
		if (!a || !b) continue;
		const face = triangleNormal(center, a.point, b.point);
		if (!face) continue;
		const area = triangleArea(center, a.point, b.point);
		nx += face[0] * area;
		ny += face[1] * area;
		nz += face[2] * area;
	}

	if (nx * nx + ny * ny + nz * nz < 1e-8) {
		return centerHit.normal;
	}
	return normalize([nx, ny, nz]);
}
