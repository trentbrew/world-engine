/**
 * Wires built-in systems into the scheduler and exposes start/stop. Behavior
 * systems run first (mutating realtime fields), then the formula system derives
 * from the updated state. Import order also registers behavior components.
 *
 * Edit mode keeps the sim paused — only play mode ticks.
 */
import { isHmrTeardown } from '$lib/engine/dev/editorSession';
import { input } from '$lib/engine/player/input';
import { playerSystem, resetPlayerMovementState } from '$lib/engine/player/playerSystem';
import { resetPlayerVisualLag } from '$lib/engine/player/playerVisualStepLag';
import type { TickContext } from '$lib/engine/ontology/schema';
import './behaviors/jump';
import { jumpSystem, resetJumpInputState } from './behaviors/jump';
import { eraSwapSystem, resetEraSwapState } from './behaviors/eraSwap';
import { plaqueProximitySystem, resetPlaqueProximityState } from './behaviors/plaqueProximity';
import { roomPortalSystem, resetRoomPortalState } from './behaviors/roomPortal';
import { platformVelocitySystem, resetPlatformVelocityState } from './behaviors/platformVelocity';
import './behaviors/physics';
import './behaviors/collect';
import { gravitySystem } from './behaviors/gravity';
import { alarmSystem } from './alarmSystem';
import { collisionSystem, resetCollisionState } from './collisionSystem';
import { resetAlarmState } from './alarmRuntime';
import { eventSystem, resetEventState } from './eventSystem';
import { inputEventSystem, resetInputEventState } from './inputEventSystem';
import { formulaSystem } from './formulaSystem';
import { scheduler } from './scheduler.svelte';

let registered = false;

const BOOTSTRAP_CTX: TickContext = { dt: 0, t: 0, tick: 0 };

function registerSystems() {
	if (registered) return;
	scheduler.register(gravitySystem);
	// Jump before player so takeoff vy + Jump_Start land in the same frame as movement.
	scheduler.register(jumpSystem);
	scheduler.register(playerSystem);
	scheduler.register(inputEventSystem);
	scheduler.register(platformVelocitySystem);
	scheduler.register(alarmSystem);
	scheduler.register(collisionSystem);
	scheduler.register(eventSystem);
	scheduler.register(eraSwapSystem);
	scheduler.register(plaqueProximitySystem);
	scheduler.register(roomPortalSystem);
	scheduler.register(formulaSystem);
	registered = true;
}

/** Idempotent system registration — safe to call after HMR module swaps. */
export function registerSystemsOnly() {
	registerSystems();
}

/** Drop stale system closures and re-register after HMR (dev only). */
export function reregisterSystemsForHmr() {
	if (!import.meta.env.DEV) {
		registerSystemsOnly();
		return;
	}
	scheduler.clearSystems();
	registered = false;
	registerSystems();
}

/** Evaluate formula fields once at t=0 (edit mode preview, post-play restore). */
export function bootstrapFormulas() {
	formulaSystem(BOOTSTRAP_CTX);
}

/** Wire systems on world load — sim stays paused until play mode. */
export function startSystems() {
	registerSystems();
	bootstrapFormulas();
	// Pad presence is session-long so connect SFX works in edit mode too.
	input.attachGamepad();
}

export function stopSystems() {
	stopSimulation();
	if (!isHmrTeardown()) input.detachGamepad();
}

/** Start ticking behaviors + keyboard (play mode). */
export function startSimulation() {
	registerSystems();
	resetPlayerMovementState();
	input.attach();
	scheduler.paused = false;
	scheduler.reset();
	scheduler.start();
}

/** Pause sim and release play-mode keyboard (pad presence stays for edit). */
export function stopSimulation() {
	scheduler.stop();
	scheduler.paused = false;
	input.detach();
	resetJumpInputState();
	resetPlayerMovementState();
	resetPlatformVelocityState();
	resetPlayerVisualLag();
	resetEventState();
	resetInputEventState();
	resetAlarmState();
	resetCollisionState();
	resetEraSwapState();
	resetPlaqueProximityState();
	resetRoomPortalState();
}

/** Freeze gameplay while staying in play mode. */
export function pauseSimulation() {
	scheduler.pause();
}

/** Resume gameplay after an in-play pause. */
export function resumeSimulation() {
	scheduler.resume();
}

export { scheduler } from './scheduler.svelte';
