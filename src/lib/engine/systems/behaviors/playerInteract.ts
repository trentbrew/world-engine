/**
 * PlayerInteract — walk up to a player and get a "Press E to talk" prompt above
 * their head. Local-only HUD + interact edge; no host authority. Mirrors the
 * RoomPortal prompt pattern: the nearest remote player within radius gets a
 * screen-space pill (position filled by PlayerInteractPromptProjector each
 * frame). Pressing E opens the room chat — the channel everyone already shares.
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

/** Chat opened from the FAB / a peer adopts the closest player inside this. */
const ADOPT_RADIUS = 12;

/** Sticky chat target — survives leaving INTERACT_RADIUS while chat is open. */
let chatPartnerId: string | null = null;

export function resetPlayerInteractState(): void {
	chatPartnerId = null;
	playerInteractPrompt.clear();
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

	let nearestId: string | null = null;
	let nearestDist = Infinity;

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

	// Sticky while chatting: hold the peer we walked up to, adopting the closest
	// one when the chat was opened some other way (FAB, or a peer's invite).
	if (chatting) {
		const partner = chatPartnerId ? world.getEntity(chatPartnerId) : undefined;
		if (!partner || !isTalkable(partner)) {
			chatPartnerId = nearestId && nearestDist <= ADOPT_RADIUS ? nearestId : null;
		}
	}

	const targetId = chatting ? chatPartnerId : nearestDist <= INTERACT_RADIUS ? nearestId : null;
	const target = targetId ? world.getEntity(targetId) : undefined;
	const targetPos = target ? entityPosition(target) : undefined;
	if (!target || !targetPos) {
		playerInteractPrompt.clear();
		return;
	}

	const distance = xzDistance(playerPos, targetPos);
	const padHint = gamepadWestLabel();
	// Reuse the projector's last screen point for this target so the prompt
	// doesn't snap to (0,0) for a frame when the target changes.
	const existing = playerInteractPrompt.prompt;
	const sameTarget = existing?.entityId === target.id;
	playerInteractPrompt.set({
		entityId: target.id,
		label: `Talk with ${displayNameOf(target)}`,
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
		roomChat.setOpen(true);
		session.sendChatOpen();
	}
}
