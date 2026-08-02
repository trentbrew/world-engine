/**
 * WorldProfile — durable world-level switch for 2D vs 3D play semantics.
 * Authored on `entity:world/profile` in JSON-LD; hydrated at load into `worldProfile`.
 */
import type { Entity } from '$lib/engine/ontology/schema';
import {
	WORLD_PROFILE_COMPONENT,
	WORLD_PROFILE_ENTITY_ID
} from './worldConstants';

export type WorldDimensions = '3d' | '2d';
export type WorldPlane = 'xy' | 'xz';
export type WorldUnit = 'meter' | 'pixel';

export type WorldProfileData = {
	dimensions: WorldDimensions;
	plane: WorldPlane;
	unit: WorldUnit;
	pixelsPerUnit: number;
	gravity: [number, number, number];
};

export const DEFAULT_WORLD_PROFILE: WorldProfileData = {
	dimensions: '3d',
	plane: 'xz',
	unit: 'meter',
	pixelsPerUnit: 64,
	gravity: [0, -9.81, 0]
};

function num(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
	if (Array.isArray(value) && value.length >= 3) {
		return [num(value[0], fallback[0]), num(value[1], fallback[1]), num(value[2], fallback[2])];
	}
	if (value && typeof value === 'object') {
		const v = value as { x?: number; y?: number; z?: number };
		return [num(v.x, fallback[0]), num(v.y, fallback[1]), num(v.z, fallback[2])];
	}
	return fallback;
}

export function parseWorldProfile(raw: unknown): WorldProfileData {
	const base = DEFAULT_WORLD_PROFILE;
	if (!raw || typeof raw !== 'object') return { ...base };

	const doc = raw as Partial<WorldProfileData>;
	const dimensions = doc.dimensions === '2d' ? '2d' : '3d';
	const plane = doc.plane === 'xy' ? 'xy' : 'xz';

	return {
		dimensions,
		plane,
		unit: doc.unit === 'pixel' ? 'pixel' : 'meter',
		pixelsPerUnit: Math.max(1, num(doc.pixelsPerUnit, base.pixelsPerUnit)),
		gravity: vec3(doc.gravity, base.gravity)
	};
}

/** Read WorldProfile from the loaded entity graph (defaults when absent). */
export function resolveWorldProfile(entities: Entity[]): WorldProfileData {
	const node = entities.find((e) => e.id === WORLD_PROFILE_ENTITY_ID);
	const raw = node?.components[WORLD_PROFILE_COMPONENT];
	return parseWorldProfile(raw);
}

export function is2dProfile(profile: WorldProfileData): boolean {
	return profile.dimensions === '2d';
}

/** Map a ground-plane hit to 2D placement coordinates (u, v) for the active plane. */
export function placementUV(
	plane: WorldPlane,
	hit: { x: number; y: number; z: number }
): [number, number] {
	return plane === 'xy' ? [hit.x, hit.y] : [hit.x, hit.z];
}

/** Build a vec3 Transform.position from 2D placement coords. */
export function positionFromPlacement(
	plane: WorldPlane,
	u: number,
	v: number,
	layer = 0
): [number, number, number] {
	return plane === 'xy' ? [u, v, layer] : [u, layer, v];
}
