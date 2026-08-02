/**
 * RoomPortal — proximity press-to-enter (or walk) room transitions.
 * Host-authoritative; peers follow via goto_room net message + shared transition FX.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { getRoomCatalog, normalizeRoomId } from '$lib/engine/ontology/roomCatalog';
import type { TickContext } from '$lib/engine/ontology/schema';
import { session } from '$lib/engine/net/session.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import { roomPortalPrompt } from '$lib/engine/room/roomPortalPrompt.svelte';
import {
	roomTransition,
	type RoomTransitionPreset
} from '$lib/engine/room/roomTransition.svelte';
import { warmAdjacentRoomAssets } from '$lib/engine/room/warmRoomAssets';
import { input } from '$lib/engine/player/input';
import { gamepadWestLabel } from '$lib/engine/player/gamepad.svelte';
import { ui } from '$lib/ui/ui.svelte';

registerComponent({
	name: 'RoomPortal',
	fields: {
		target: { t: 'string', default: '', sync: 'durable' },
		prompt: { t: 'string', default: 'Enter', sync: 'durable' },
		radius: { t: 'number', default: 2.5, sync: 'durable' },
		mode: { t: 'string', default: 'press', sync: 'durable' },
		transition: { t: 'string', default: 'fade', sync: 'durable' },
		transitionMs: { t: 'number', default: 400, sync: 'durable' },
		transitionColor: { t: 'string', default: '#0a0a0a', sync: 'durable' },
		returnPortal: { t: 'boolean', default: false, sync: 'durable' }
	}
});

type PortalFields = {
	target?: string;
	prompt?: string;
	radius?: number;
	mode?: string;
	transition?: string;
	transitionMs?: number;
	transitionColor?: string;
	returnPortal?: boolean;
};

let nearestPortalId: string | null = null;
let walkArmedId: string | null = null;
let travelLock = false;

export function resetRoomPortalState(): void {
	nearestPortalId = null;
	walkArmedId = null;
	travelLock = false;
	warnedCatalog = false;
	roomPortalPrompt.clear();
}

function xzDistance(a: [number, number, number], b: [number, number, number]): number {
	const dx = a[0] - b[0];
	const dz = a[2] - b[2];
	return Math.sqrt(dx * dx + dz * dz);
}

function parseTransition(raw: unknown): RoomTransitionPreset {
	return raw === 'none' ? 'none' : 'fade';
}

function warnDeadEndRooms(): void {
	const catalog = getRoomCatalog();
	if (!catalog) return;

	const outbound = new Map<string, Set<string>>();
	for (const roomId of catalog.rooms.keys()) outbound.set(roomId, new Set());

	for (const [roomId, entities] of catalog.byRoom) {
		for (const entity of entities) {
			const portal = entity.components.RoomPortal as PortalFields | undefined;
			if (portal?.target) {
				outbound.get(roomId)?.add(normalizeRoomId(portal.target));
			}
			const collisionGoto = entity.events?.collision;
			if (Array.isArray(collisionGoto)) {
				for (const rule of collisionGoto) {
					const actions = (rule as { do?: unknown[] })?.do;
					if (!Array.isArray(actions)) continue;
					for (const action of actions) {
						if (action && typeof action === 'object' && 'goto_room' in action) {
							outbound
								.get(roomId)
								?.add(normalizeRoomId(String((action as { goto_room: unknown }).goto_room)));
						}
					}
				}
			}
		}
	}

	for (const meta of catalog.rooms.values()) {
		if (meta.next) outbound.get(meta.id)?.add(normalizeRoomId(meta.next));
	}

	const inbound = new Set<string>();
	for (const targets of outbound.values()) {
		for (const t of targets) inbound.add(t);
	}

	for (const roomId of inbound) {
		if (roomId === catalog.startRoomId) continue;
		const outs = outbound.get(roomId);
		if (!outs || outs.size === 0) {
			console.warn(
				`[rooms] Room "${roomId}" is reachable but has no outbound portal / goto_room — add a return path`
			);
		}
	}
}

let warnedCatalog = false;

function requestTravel(portalEntityId: string, portal: PortalFields): void {
	if (travelLock) return;
	if (!session.isHost) return;
	if (ui.shellMode !== 'play' || ui.playPaused) return;

	const target = normalizeRoomId(String(portal.target ?? ''));
	if (!target || !getRoomCatalog()?.rooms.has(target)) return;
	if (target === world.activeRoomId) return;

	const preset = parseTransition(portal.transition);
	const ms = Number(portal.transitionMs ?? 400);
	const color = String(portal.transitionColor ?? '#0a0a0a');

	travelLock = true;
	roomPortalPrompt.clear();

	void roomTransition
		.run(preset, ms, () => {
			world.switchRoom(target, {
				members: session.members,
				viaPortalId: portalEntityId,
				transition: preset,
				transitionMs: ms,
				transitionColor: color
			});
			warmAdjacentRoomAssets(target);
		}, { color })
		.finally(() => {
			travelLock = false;
			walkArmedId = null;
		});
}

export function roomPortalSystem(_ctx: TickContext): void {
	if (ui.shellMode !== 'play') {
		if (nearestPortalId) {
			nearestPortalId = null;
			roomPortalPrompt.clear();
		}
		return;
	}

	if (!warnedCatalog) {
		warnedCatalog = true;
		warnDeadEndRooms();
	}

	const playerId = world.localPlayerId;
	if (!playerId || travelLock || ui.playPaused) {
		roomPortalPrompt.clear();
		nearestPortalId = null;
		return;
	}

	const player = world.getEntity(playerId);
	const playerPos = player?.components.Transform?.position as
		| [number, number, number]
		| undefined;
	if (!playerPos) {
		roomPortalPrompt.clear();
		return;
	}

	let nearestId: string | null = null;
	let nearestDist = Infinity;
	let nearestPortal: PortalFields | null = null;

	for (const entity of world.query('RoomPortal')) {
		const render = entity.components.Render as { visible?: boolean } | undefined;
		if (render?.visible === false) continue;

		const portal = entity.components.RoomPortal as PortalFields;
		const target = String(portal.target ?? '').trim();
		if (!target) continue;

		const pos = entity.components.Transform?.position as [number, number, number] | undefined;
		if (!pos) continue;

		const radius = Number(portal.radius ?? 2.5);
		const dist = xzDistance(playerPos, pos);
		if (dist <= radius && dist < nearestDist) {
			nearestDist = dist;
			nearestId = entity.id;
			nearestPortal = portal;
		}
	}

	if (!nearestId || !nearestPortal) {
		nearestPortalId = null;
		walkArmedId = null;
		roomPortalPrompt.clear();
		// Drain interact edge so an E pressed far from a portal doesn't fire later.
		void input.interactPressed();
		return;
	}

	const mode = String(nearestPortal.mode ?? 'press') === 'walk' ? 'walk' : 'press';

	if (mode === 'walk') {
		roomPortalPrompt.clear();
		if (walkArmedId !== nearestId) {
			walkArmedId = nearestId;
			requestTravel(nearestId, nearestPortal);
		}
		nearestPortalId = nearestId;
		return;
	}

	walkArmedId = null;
	nearestPortalId = nearestId;

	const label = String(nearestPortal.prompt ?? 'Enter').trim() || 'Enter';
	const padHint = gamepadWestLabel();
	// Prompt screen position is filled by RoomPortalPromptProjector each frame.
	const existing = roomPortalPrompt.prompt;
	roomPortalPrompt.set({
		entityId: nearestId,
		label,
		hint: `Press ${padHint}`,
		x: existing?.entityId === nearestId ? existing.x : 0,
		y: existing?.entityId === nearestId ? existing.y : 0,
		visible: existing?.entityId === nearestId ? existing.visible : false
	});

	if (input.interactPressed()) {
		requestTravel(nearestId, nearestPortal);
	}
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
	const w = window as unknown as {
		__playlabRoomPortalSystem?: typeof roomPortalSystem;
		__playlabRoomPortalPrompt?: typeof roomPortalPrompt;
	};
	w.__playlabRoomPortalSystem = roomPortalSystem;
	w.__playlabRoomPortalPrompt = roomPortalPrompt;
}
