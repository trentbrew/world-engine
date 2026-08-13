/**
 * PlayerInteract — walk up to a player and get a "Press E to talk" prompt above
 * their head. Local-only HUD + interact edge; no host authority. Mirrors the
 * RoomPortal prompt pattern: the nearest remote player within radius gets a
 * screen-space pill (position filled by PlayerInteractPromptProjector each
 * frame). Pressing E starts or joins a proximity-scoped conversation.
 *
 * While the chat is open the target becomes *sticky*: we keep tracking the peer
 * we walked up to even after stepping out of interact range, so the chat panel
 * can follow them and pin an edge arrow once they leave the viewport.
 */
import { collab } from '$lib/engine/collab/collab.svelte';
import { roomChat } from '$lib/engine/collab/roomChat.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { isRemotePlayerEntity, playerClientId } from '$lib/engine/player/access';
import { gamepadWestLabel } from '$lib/engine/player/gamepad.svelte';
import { input } from '$lib/engine/player/input';
import type { Entity, TickContext } from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';
import { playerInteractPrompt } from '$lib/engine/room/playerInteractPrompt.svelte';
import { ui } from '$lib/ui/ui.svelte';

const INTERACT_RADIUS = 2.5;

/** Chat opened from a peer adopts the closest player inside this. */
const ADOPT_RADIUS = 12;

/** Sticky chat target — survives leaving INTERACT_RADIUS while chat is open. */
let chatPartnerId: string | null = null;

type InRangePeer = {
	entityId: string;
	clientId: string;
	distance: number;
};

export function resetPlayerInteractState(): void {
	chatPartnerId = null;
	playerInteractPrompt.clear();
}

/** Pin the sticky chat target to a remote peer (e.g. when they open walk-up chat). */
export function adoptChatPartnerByClientId(clientId: string): boolean {
	if (!clientId) return false;
	for (const entity of world.query('Player')) {
		if (playerClientId(entity) === clientId && isTalkable(entity)) {
			chatPartnerId = entity.id;
			return true;
		}
	}
	return false;
}

function xzDistance(a: [number, number, number], b: [number, number, number]): number {
	const dx = a[0] - b[0];
	const dz = a[2] - b[2];
	return Math.sqrt(dx * dx + dz * dz);
}

function entityPosition(entity: Entity): [number, number, number] | undefined {
	return entity.components.Transform?.position as [number, number, number] | undefined;
}

function isTalkable(entity: Entity): boolean {
	if (!isRemotePlayerEntity(entity)) return false;
	const render = entity.components.Render as { visible?: boolean } | undefined;
	return render?.visible !== false;
}

function displayNameOf(entity: Entity): string {
	const peerId = playerClientId(entity);
	return peerId ? collab.displayNameFor(peerId) : 'this player';
}

/** Remote peers within walk-up interact radius. */
export function peersInInteractRange(playerPos: [number, number, number]): InRangePeer[] {
	const peers: InRangePeer[] = [];
	for (const entity of world.query('Player')) {
		if (!isTalkable(entity)) continue;
		const pos = entityPosition(entity);
		const clientId = playerClientId(entity);
		if (!pos || !clientId) continue;
		const distance = xzDistance(playerPos, pos);
		if (distance <= INTERACT_RADIUS) {
			peers.push({ entityId: entity.id, clientId, distance });
		}
	}
	return peers.sort((a, b) => a.distance - b.distance);
}

/** Detect a joinable group convo among in-range peers (from wire discovery map). */
export function detectNearbyConvo(
	inRange: InRangePeer[]
): { convoId: string; members: string[]; joinSize: number } | null {
	if (inRange.length === 0) return null;

	let best: { convoId: string; members: string[]; joinSize: number; inRangeCount: number } | null =
		null;

	for (const peer of inRange) {
		const info = roomChat.peerConvo[peer.clientId];
		if (!info || info.members.length < 2) continue;
		if (info.members.includes(session.clientId)) continue;

		const inRangeCount = inRange.filter((p) => info.members.includes(p.clientId)).length;
		if (inRangeCount === 0) continue;

		if (
			!best ||
			info.members.length > best.joinSize ||
			(inRangeCount > best.inRangeCount && info.members.length === best.joinSize)
		) {
			best = {
				convoId: info.convoId,
				members: info.members,
				joinSize: info.members.length,
				inRangeCount
			};
		}
	}

	return best ? { convoId: best.convoId, members: best.members, joinSize: best.joinSize } : null;
}

function nearestConvoMemberEntity(
	playerPos: [number, number, number],
	memberClientIds: string[]
): string | null {
	let nearestId: string | null = null;
	let nearestDist = Infinity;
	for (const entity of world.query('Player')) {
		if (!isTalkable(entity)) continue;
		const clientId = playerClientId(entity);
		if (!clientId || !memberClientIds.includes(clientId)) continue;
		const pos = entityPosition(entity);
		if (!pos) continue;
		const dist = xzDistance(playerPos, pos);
		if (dist < nearestDist) {
			nearestDist = dist;
			nearestId = entity.id;
		}
	}
	return nearestId;
}

function mergeMemberIds(existing: string[], added: string[]): string[] {
	return [...new Set([...existing, ...added])].sort((a, b) => a.localeCompare(b));
}

export function playerInteractSystem(_ctx: TickContext): void {
	if (ui.shellMode !== 'play' || ui.playPaused) {
		resetPlayerInteractState();
		return;
	}

	const playerId = world.localPlayerId;
	const player = playerId ? world.getEntity(playerId) : undefined;
	const playerPos = player ? entityPosition(player) : undefined;
	if (!playerPos) {
		resetPlayerInteractState();
		return;
	}

	const inRange = peersInInteractRange(playerPos);
	const joinable = detectNearbyConvo(inRange);

	let nearestId: string | null = inRange[0]?.entityId ?? null;
	let nearestDist = inRange[0]?.distance ?? Infinity;

	for (const entity of world.query('Player')) {
		if (!isTalkable(entity)) continue;
		const pos = entityPosition(entity);
		if (!pos) continue;
		const dist = xzDistance(playerPos, pos);
		if (dist < nearestDist) {
			nearestDist = dist;
			nearestId = entity.id;
		}
	}

	const chatting = roomChat.open;
	if (!chatting) chatPartnerId = null;

	if (chatting) {
		const memberIds = roomChat.members.length ? roomChat.members : [];
		if (memberIds.length > 1) {
			const anchor = nearestConvoMemberEntity(playerPos, memberIds);
			if (anchor) chatPartnerId = anchor;
		}

		if (!chatPartnerId && nearestId && nearestDist <= ADOPT_RADIUS) {
			chatPartnerId = nearestId;
		}
		const partner = chatPartnerId ? world.getEntity(chatPartnerId) : undefined;
		if (chatPartnerId && (!partner || !isTalkable(partner))) {
			const adopted = nearestId && nearestDist <= ADOPT_RADIUS ? nearestId : null;
			if (adopted) {
				chatPartnerId = adopted;
			} else {
				const convoId = roomChat.leaveConvo();
				if (convoId) session.sendConvoLeave(convoId);
				chatPartnerId = null;
				playerInteractPrompt.clear();
				return;
			}
		}
	}

	let targetId: string | null = null;
	if (chatting) {
		targetId = chatPartnerId;
	} else if (joinable) {
		targetId =
			inRange.find((p) => joinable.members.includes(p.clientId))?.entityId ??
			nearestId;
	} else if (inRange.length > 0) {
		targetId = inRange[0].entityId;
	}

	const target = targetId ? world.getEntity(targetId) : undefined;
	const targetPos = target ? entityPosition(target) : undefined;
	if (!target || !targetPos) {
		playerInteractPrompt.clear();
		return;
	}

	const distance = xzDistance(playerPos, targetPos);
	const padHint = gamepadWestLabel();
	const existing = playerInteractPrompt.prompt;
	const sameTarget = existing?.entityId === target.id;

	let label: string;
	if (joinable && !chatting) {
		label = `Join conversation (${joinable.joinSize})`;
	} else if (chatting && roomChat.members.length > 2) {
		label = `Group chat (${roomChat.members.length})`;
	} else {
		label = `Talk with ${displayNameOf(target)}`;
	}

	playerInteractPrompt.set({
		entityId: target.id,
		label,
		hint: `Press ${padHint}`,
		x: sameTarget ? existing.x : 0,
		y: sameTarget ? existing.y : 0,
		visible: sameTarget ? existing.visible : false,
		onScreen: sameTarget ? existing.onScreen : false,
		inRange: distance <= INTERACT_RADIUS,
		distance
	});

	if (!chatting && distance <= INTERACT_RADIUS && input.interactPressed()) {
		chatPartnerId = target.id;
		const partnerClientId = playerClientId(target);
		if (!partnerClientId) return;

		if (joinable) {
			const members = mergeMemberIds(joinable.members, [session.clientId]);
			roomChat.joinConvo(joinable.convoId, members);
			session.sendConvoJoin(joinable.convoId, members);
			return;
		}

		const { convoId, members } = roomChat.startConvo(partnerClientId);
		session.sendChatOpen(convoId, members);
	}
}
