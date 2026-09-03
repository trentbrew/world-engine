/**
 * Physics component — Rapier-backed rigid bodies (see PhysicsBody.svelte).
 * Registration only; simulation runs in the render layer via @threlte/rapier.
 */
import { registerComponent } from '$lib/engine/ontology/registry';

registerComponent({
	name: 'Physics',
	fields: {
		body: { t: 'string', default: 'dynamic', options: ['fixed', 'dynamic', 'kinematic'] },
		// `options` is what surfaces these shapes to agents via describe_component —
		// hull/trimesh derive real geometry from a glTF, box/ball/capsule are fitted.
		collider: {
			t: 'string',
			default: 'box',
			options: ['box', 'ball', 'capsule', 'hull', 'trimesh']
		},
		mass: { t: 'number', default: 1 },
		restitution: { t: 'number', default: 0.2 },
		friction: { t: 'number', default: 0.8 },
		gravityScale: { t: 'number', default: 1 }
	}
});
