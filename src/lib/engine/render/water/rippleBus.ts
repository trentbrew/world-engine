/**
 * The seam between `waterRippleSystem` (sim layer, runs on the scheduler) and
 * `WaterSurfaceView` (render layer, owns the WaterSurfaceHandle and its uniforms).
 *
 * Why a module bus rather than component state: a ripple is a transient render
 * event, not world state. Writing it into the entity graph would sync it to peers,
 * dirty the document, and land in undo history — for something that has decayed to
 * nothing 2 seconds later. This is the same shape `agentFocus.svelte.ts` uses for
 * agent highlights, minus the reactivity: the view polls it from `useTask`, so a
 * plain Map avoids 60Hz signal churn.
 *
 * Upstream's `rippleStore` was one global singleton implicitly bound to the one
 * water surface a demo had. This is KEYED BY WATER ENTITY — a world with a pond
 * and a sea has two independent queues, and neither hears the other's splashes.
 */

export type RippleImpact = { x: number; z: number };

/** Matches the shader's slot count — more per frame than that is unshowable. */
const MAX_QUEUED = 8;

const queues = new Map<string, RippleImpact[]>();

/** Queue a ripple at a world XZ point. Dropped if nothing drains it (no view mounted). */
export function emitWaterRipple(waterEntityId: string, x: number, z: number): void {
	const queue = queues.get(waterEntityId);
	if (!queue) {
		queues.set(waterEntityId, [{ x, z }]);
		return;
	}
	// Drop the oldest rather than the newest: a stale queue means no view is
	// draining, and when one mounts the most recent splashes are the truthful ones.
	if (queue.length >= MAX_QUEUED) queue.shift();
	queue.push({ x, z });
}

/** Take everything queued for one surface. Empty array when there is nothing. */
export function drainWaterRipples(waterEntityId: string): RippleImpact[] {
	const queue = queues.get(waterEntityId);
	if (!queue || queue.length === 0) return [];
	queues.set(waterEntityId, []);
	return queue;
}

/** Drop every queue — on sim stop, so leaving play doesn't splash on re-entry. */
export function clearWaterRipples(): void {
	queues.clear();
}
