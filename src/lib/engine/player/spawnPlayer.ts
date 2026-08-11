/**
 * Player primitive. Registers the `Player` component + type and builds a player
 * entity for a given client. Each player gets a stable color derived from its id
 * so remote avatars are visually distinct. Movement lives in `playerSystem.ts`.
 */
import { getComponent, getType, registerComponent, registerType } from '$lib/engine/ontology/registry';
import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';
import { peerColor } from '$lib/engine/collab/peerColor';
import {
	capsuleRestCenterY,
	MANNEQUIN_CAPSULE_FIT,
	type FittedCapsule
} from '$lib/engine/player/playerCapsuleFit';
import { warmLocomotionPack } from '$lib/engine/player/playerLocomotionClips';
import '$lib/engine/systems/behaviors/jump';

registerComponent({
	name: 'Player',
	fields: {
		speed: { t: 'number', default: 4 },
		color: { t: 'color', default: '#d4d4d4' },
		minSlope: { t: 'number', default: 30 },
		maxSlope: { t: 'number', default: 60 },
		groundAcc: { t: 'number', default: 7 },
		airAcc: { t: 'number', default: 2 },
		airDrag: { t: 'number', default: 1 },
		velocityClipThreshold: { t: 'number', default: 0.1 },
		visualsOffsetThreshold: { t: 'number', default: 0.1 },
		visualsLerpFactor: { t: 'number', default: 20 },
		maxVisualsOffset: { t: 'number', default: 0.5 },
		maxStepVisual: { t: 'number', default: 0.5 }
	}
});

registerType({
	name: 'Player',
	components: ['Transform', 'SkinnedMesh', 'Mesh3DAnimator', 'Player', 'Physics', 'Jump'],
	defaults: {
		SkinnedMesh: {
			mesh: '/models/characters/mannequin.glb',
			anchor: 'bottom',
			rig: 'human',
			forwardYaw: 0,
			capsuleRadiusScale: 1,
			capsuleHeightScale: 1
		},
		Mesh3DAnimator: {
			catalog: 'catalog:mesh2motion-human',
			clip: 'Idle_Loop',
			speed: 1,
			loop: true,
			rootMotion: false,
			playing: true
		},
		Physics: {
			body: 'kinematicPosition',
			collider: 'capsule',
			mass: 70,
			gravityScale: 0
		},
		Jump: {}
	}
});

/** Deterministic, vivid color from a client id. */
export function colorForClient(id: string): string {
	return peerColor(id);
}

/** Capsule center when resting on the physics floor (default mannequin fit). */
export const PLAYER_REST_Y = capsuleRestCenterY(MANNEQUIN_CAPSULE_FIT);

/** World position from a ground/base spawn point (XZ on marker, Y for capsule rest). */
export function spawnPositionFromBase(
	base: [number, number, number],
	fit: FittedCapsule = MANNEQUIN_CAPSULE_FIT
): [number, number, number] {
	const floorTop = 0.05;
	const restY = base[1] + (capsuleRestCenterY(fit, floorTop) - floorTop);
	return [base[0], restY, base[2]];
}

/** Resolve a component bag through type defaults + registry schema. */
function typeBag(typeName: string, compName: string, raw: ComponentData = {}): ComponentData {
	const type = getType(typeName);
	const schema = getComponent(compName);
	if (!schema) return raw;
	const merged = { ...(type?.defaults?.[compName] ?? {}), ...raw };
	return createComponentBag(schema, merged).bag;
}

export function buildPlayer(clientId: string, spawn: [number, number, number]): Entity {
	const color = colorForClient(clientId);
	const entity: Entity = {
		id: `entity:player/${clientId}`,
		type: 'Player',
		events: getType('Player')?.events,
		components: {
			Transform: typeBag('Player', 'Transform', { position: spawn }),
			SkinnedMesh: typeBag('Player', 'SkinnedMesh', { color }),
			Mesh3DAnimator: typeBag('Player', 'Mesh3DAnimator'),
			Player: typeBag('Player', 'Player', { color }),
			Physics: typeBag('Player', 'Physics'),
			Jump: typeBag('Player', 'Jump')
		},
		raw: {}
	};
	warmLocomotionPack(entity);
	return entity;
}
