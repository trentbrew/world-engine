/**
 * GameMaker-style collision events (Phase 2, TRL-127).
 *
 * Host-only XZ proximity dispatch. Fires `events.collision` rules on the
 * collider (self) with `other` bound to the overlapping partner.
 */
import { session } from '$lib/engine/net/session.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import type { CollisionHandlers, CollisionRule, Entity, TickContext } from '$lib/engine/ontology/schema';
import { collisionRadius, entitiesOverlap, PLAYER_COLLIDE_RADIUS } from './collisionProbe';
import { runActions } from './eventSystem';

export function resetCollisionState(): void {
	/* v1: no module caches */
}

function normalizeCollisionRules(raw: CollisionHandlers | unknown): CollisionRule[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(entry): entry is CollisionRule =>
			typeof entry === 'object' &&
			entry !== null &&
			'do' in entry &&
			Array.isArray((entry as CollisionRule).do)
	);
}

function dispatchCollisions(
	self: Entity,
	other: Entity,
	rules: CollisionRule[],
	ctx: TickContext
): void {
	for (const rule of rules) {
		if (rule.with && rule.with !== other.type) continue;
		runActions(self, rule.do, ctx, { other });
	}
}

export function collisionSystem(ctx: TickContext): void {
	if (!session.isHost) return;

	const players = world.entities.filter((entity) => entity.type === 'Player');
	const colliders = world.entities.filter(
		(entity) => entity.events?.collision && collisionRadius(entity) != null
	);

	for (const self of colliders) {
		const rules = normalizeCollisionRules(self.events!.collision);
		if (rules.length === 0) continue;

		const selfPos = self.components.Transform?.position as [number, number, number] | undefined;
		const selfR = collisionRadius(self);
		if (!selfPos || selfR == null) continue;

		for (const other of players) {
			if (other.id === self.id) continue;
			const otherPos = other.components.Transform?.position as [number, number, number] | undefined;
			if (!otherPos) continue;
			if (!entitiesOverlap(self, selfPos, selfR, other, otherPos, PLAYER_COLLIDE_RADIUS)) continue;
			dispatchCollisions(self, other, rules, ctx);
		}
	}

	for (const self of players) {
		const rules = normalizeCollisionRules(self.events?.collision);
		if (rules.length === 0) continue;

		const selfPos = self.components.Transform?.position as [number, number, number] | undefined;
		if (!selfPos) continue;
		const selfR = collisionRadius(self) ?? PLAYER_COLLIDE_RADIUS;

		for (const other of colliders) {
			if (other.id === self.id) continue;
			const otherPos = other.components.Transform?.position as [number, number, number] | undefined;
			const otherR = collisionRadius(other);
			if (!otherPos || otherR == null) continue;
			if (!entitiesOverlap(self, selfPos, selfR, other, otherPos, otherR)) continue;
			dispatchCollisions(self, other, rules, ctx);
		}
	}
}
