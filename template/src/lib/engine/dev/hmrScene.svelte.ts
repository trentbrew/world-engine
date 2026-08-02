/**
 * Dev-only Canvas generation counter — bumps when scene / render / physics modules
 * change so Threlte + Rapier get a clean remount instead of stale WebGL contexts.
 */

/** Path substrings that require a full Canvas rebuild (not just runtime rehydrate). */
const SCENE_HMR_PATTERNS = [
	'/scene/',
	'/engine/render/',
	'/engine/physics/',
	'PhysicsWorld',
	'PhysicsSimGate',
	'PhysicsBody',
	'ViewportComposer',
	'ensureRapier'
] as const;

export function isSceneHmrPath(path: string): boolean {
	const normalized = path.replace(/\\/g, '/');
	return SCENE_HMR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

type HmrUpdate = { path: string };

class HmrScene {
	canvasGeneration = $state(0);

	/** Returns true when the generation was bumped. */
	noteUpdates(updates: HmrUpdate[]): boolean {
		if (!import.meta.env.DEV || updates.length === 0) return false;
		const hit = updates.some((update) => isSceneHmrPath(update.path));
		if (hit) this.canvasGeneration += 1;
		return hit;
	}
}

export const hmrScene = new HmrScene();
