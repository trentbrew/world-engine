/**
 * Physics component — Rapier-backed rigid bodies (see PhysicsBody.svelte).
 * Registration only; simulation runs in the render layer via @threlte/rapier.
 */
import { registerComponent } from '$lib/engine/ontology/registry';

registerComponent({
	name: 'Physics',
	fields: {
		body: { t: 'string', default: 'dynamic' },
		collider: { t: 'string', default: 'box' },
		mass: { t: 'number', default: 1 },
		restitution: { t: 'number', default: 0.2 },
		friction: { t: 'number', default: 0.8 },
		gravityScale: { t: 'number', default: 1 }
	}
});
