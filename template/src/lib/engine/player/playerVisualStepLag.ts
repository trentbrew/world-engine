/**
 * Soften vertical pops when the physics body snaps up a ledge while grounded.
 *
 * Spec: docs/artifacts/character_controller_clip_visual_spec.md
 *
 * Only reacts when **ground height** rises with the body — flat-ground snap /
 * capsule settle can exceed `visualsOffsetThreshold` without a real step-up,
 * and fighting that with visual lag causes walk/run jitter.
 */

import type { Entity } from '$lib/engine/ontology/schema';
import { position } from '$lib/engine/render/access';
import { groundStore } from './groundStore.svelte';

type PlayerVisualData = {
	visualsOffsetThreshold?: number;
	visualsLerpFactor?: number;
	maxVisualsOffset?: number;
	maxStepVisual?: number;
};

function numberOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Ignore ground-height noise below this (meters) when deciding "step-up". */
const GROUND_RISE_EPS = 0.04;

let prevY: number | null = null;
let prevGroundHeight: number | null = null;
let offsetY = 0;

export function resetPlayerVisualLag(): void {
	prevY = null;
	prevGroundHeight = null;
	offsetY = 0;
}

/** Test probe — current visual Y offset. */
export function peekVisualOffsetY(): number {
	return offsetY;
}

/** Advance step-lag state; returns offset to apply to the visual root. */
export function stepPlayerVisualStepLag(entity: Entity, dt: number): number {
	const player = entity.components.Player as PlayerVisualData | undefined;
	const jump = entity.components.Jump as { vy?: number } | undefined;
	const y = position(entity)[1];
	const height = groundStore.height;
	const jumpVy = jump?.vy ?? 0;
	const motorGrounded = groundStore.grounded && jumpVy <= 0.01;

	if (prevY === null || prevGroundHeight === null) {
		prevY = y;
		prevGroundHeight = height;
		return offsetY;
	}

	const threshold = numberOr(player?.visualsOffsetThreshold, 0.1);
	const maxStep = numberOr(player?.maxStepVisual, 0.5);
	const maxOffset = numberOr(player?.maxVisualsOffset, 0.5);
	const lerp = numberOr(player?.visualsLerpFactor, 20);

	const deltaY = y - prevY;
	const groundRise = height - prevGroundHeight;

	// Real ledge step-up: body rose past threshold AND the ground contact rose.
	if (
		motorGrounded &&
		deltaY > threshold &&
		deltaY <= maxStep &&
		groundRise > GROUND_RISE_EPS
	) {
		offsetY -= deltaY;
		offsetY = Math.max(offsetY, -maxOffset);
	}

	offsetY -= offsetY * lerp * dt;
	prevY = y;
	prevGroundHeight = height;
	return offsetY;
}
