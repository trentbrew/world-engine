/**
 * E2E / dev probe — Rapier World + shape factory from GroundSensor / PhysicsWorld.
 */
import type { World } from '@dimforge/rapier3d-compat';

type RapierShapeFactory = {
	Ball: new (radius: number) => unknown;
};

let rapierWorld: World | null = null;
let rapierShapes: RapierShapeFactory | null = null;

export function registerRapierWorldProbe(
	world: World | null,
	rapier: RapierShapeFactory | null
): void {
	rapierWorld = world;
	rapierShapes = rapier;
}

export function getRapierWorldProbe(): {
	world: World | null;
	rapier: RapierShapeFactory | null;
} {
	return { world: rapierWorld, rapier: rapierShapes };
}
