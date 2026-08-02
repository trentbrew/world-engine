import { comp, isGroundEntity, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import type { Entity } from '$lib/engine/ontology/schema';
import { isPrimitiveMesh } from '$lib/engine/render/meshRef';
import type { WorldPlane } from '$lib/engine/world/worldProfile';

const LAYER_OFFSET = 0.03;
const MIN_FOOTPRINT = 0.35;

export type EntityFootprint = {
	center: [number, number, number];
	width: number;
	depth: number;
	yaw: number;
	shape: 'rect' | 'circle';
	radius: number;
	/** When false, skip the translucent fill — border only (used for ground plane). */
	fill?: boolean;
};

/** Y-axis rotation (radians) from a transform quaternion. */
export function yawFromQuat(quat: [number, number, number, number]): number {
	const [x, y, z, w] = quat;
	return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
}

function layerCoord(plane: WorldPlane): number {
	return LAYER_OFFSET;
}

function primitiveFootprint(
	entity: Entity,
	plane: WorldPlane,
	mesh: string | undefined,
	scale: [number, number, number],
	yaw: number
): EntityFootprint {
	const pos = position(entity);
	const [sx, sy, sz] = scale;

	if (plane === 'xy') {
		const [px, py] = [pos[0], pos[1]];
		if (mesh === 'primitive:sphere' || mesh === 'primitive:capsule') {
			const radius = Math.max(
				MIN_FOOTPRINT / 2,
				0.5 * Math.max(mesh === 'primitive:capsule' ? sx : sx, sy, sz)
			);
			return {
				center: [px, py, layerCoord(plane)],
				width: radius * 2,
				depth: radius * 2,
				yaw: 0,
				shape: 'circle',
				radius
			};
		}
		const width = Math.max(MIN_FOOTPRINT, sx);
		const depth = Math.max(MIN_FOOTPRINT, sy);
		return {
			center: [px, py, layerCoord(plane)],
			width,
			depth,
			yaw: 0,
			shape: 'rect',
			radius: Math.max(width, depth) / 2
		};
	}

	const [px, , pz] = pos;
	if (mesh === 'primitive:sphere') {
		const radius = Math.max(MIN_FOOTPRINT / 2, 0.5 * Math.max(sx, sy, sz));
		return {
			center: [px, layerCoord(plane), pz],
			width: radius * 2,
			depth: radius * 2,
			yaw,
			shape: 'circle',
			radius
		};
	}

	if (mesh === 'primitive:capsule') {
		const radius = Math.max(MIN_FOOTPRINT / 2, 0.32 * Math.max(sx, sz));
		return {
			center: [px, layerCoord(plane), pz],
			width: radius * 2,
			depth: radius * 2,
			yaw,
			shape: 'circle',
			radius
		};
	}

	const width = Math.max(MIN_FOOTPRINT, sx);
	const depth = Math.max(MIN_FOOTPRINT, sz);
	return {
		center: [px, layerCoord(plane), pz],
		width,
		depth,
		yaw,
		shape: 'rect',
		radius: Math.max(width, depth) / 2
	};
}

/** Play-plane footprint for editor selection projection. */
export function entityFootprint(
	entity: Entity,
	plane: WorldPlane = 'xz'
): EntityFootprint | null {
	if (isGroundEntity(entity)) {
		const ground = comp<{ size?: number }>(entity, 'Ground') ?? {};
		const groundSize = ground.size ?? 20;
		const pos = position(entity);
		if (plane === 'xy') {
			return {
				center: [pos[0], pos[1], layerCoord(plane)],
				width: groundSize,
				depth: groundSize,
				yaw: 0,
				shape: 'rect',
				radius: groundSize / 2,
				fill: false
			};
		}
		return {
			center: [pos[0], layerCoord(plane), pos[2]],
			width: groundSize,
			depth: groundSize,
			yaw: 0,
			shape: 'rect',
			radius: groundSize / 2,
			fill: false
		};
	}

	const pos = position(entity);
	const scale = scaleVec(entity);
	const yaw = yawFromQuat(rotationQuat(entity));
	const bounds = renderBounds.get(entity.id);

	if (bounds) {
		if (plane === 'xy') {
			const width = Math.max(MIN_FOOTPRINT, bounds.size[0]);
			const depth = Math.max(MIN_FOOTPRINT, bounds.size[1]);
			const circular =
				Math.abs(width - depth) < 0.25 && Math.abs(width - bounds.size[2]) < 0.35;
			return {
				center: [
					pos[0] + bounds.center[0],
					pos[1] + bounds.center[1],
					layerCoord(plane)
				],
				width,
				depth,
				yaw: 0,
				shape: circular ? 'circle' : 'rect',
				radius: Math.max(width, depth) / 2
			};
		}

		const width = Math.max(MIN_FOOTPRINT, bounds.size[0]);
		const depth = Math.max(MIN_FOOTPRINT, bounds.size[2]);
		const height = bounds.size[1];
		const circular =
			Math.abs(width - depth) < 0.25 && Math.abs(width - height) < 0.35;

		return {
			center: [
				pos[0] + bounds.center[0],
				layerCoord(plane),
				pos[2] + bounds.center[2]
			],
			width,
			depth,
			yaw,
			shape: circular ? 'circle' : 'rect',
			radius: Math.max(width, depth) / 2
		};
	}

	if ('Marker' in entity.components) {
		const radius = 0.55;
		if (plane === 'xy') {
			return {
				center: [pos[0], pos[1], layerCoord(plane)],
				width: radius * 2,
				depth: radius * 2,
				yaw: 0,
				shape: 'circle',
				radius
			};
		}
		return {
			center: [pos[0], layerCoord(plane), pos[2]],
			width: radius * 2,
			depth: radius * 2,
			yaw,
			shape: 'circle',
			radius
		};
	}

	const mesh = comp<{ mesh?: string }>(entity, 'Render')?.mesh;
	if (!mesh || isPrimitiveMesh(mesh)) {
		return primitiveFootprint(entity, plane, mesh, scale, yaw);
	}

	if (plane === 'xy') {
		return {
			center: [pos[0], pos[1], layerCoord(plane)],
			width: Math.max(MIN_FOOTPRINT, scale[0]),
			depth: Math.max(MIN_FOOTPRINT, scale[1]),
			yaw: 0,
			shape: 'rect',
			radius: Math.max(Math.max(MIN_FOOTPRINT, scale[0]), scale[1]) / 2
		};
	}

	return {
		center: [pos[0], layerCoord(plane), pos[2]],
		width: Math.max(MIN_FOOTPRINT, scale[0]),
		depth: Math.max(MIN_FOOTPRINT, scale[2]),
		yaw,
		shape: 'rect',
		radius: Math.max(Math.max(MIN_FOOTPRINT, scale[0]), scale[2]) / 2
	};
}
