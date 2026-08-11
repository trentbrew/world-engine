/**
 * Net session — presence + per-entity ownership + state replication over any
 * NetTransport.
 *
 * Ownership (M5): each entity has an owner client. Players are owned by the tab
 * that spawned them; everything else (the static world) falls back to the host
 * (lowest client id). The owner runs behaviors and broadcasts the entity's
 * `realtime` fields; peers apply patches only from the rightful owner and skip
 * owning behaviors. Derived fields are never sent — every peer recomputes them.
 *
 * Players are dynamic, so the session also replicates spawn/despawn: a peer
 * announces its player on join, re-announces when others join, and is despawned
 * everywhere when it leaves or times out.
 */
import {
	applyAuthoringPatch,
	applyDurablePatch,
	recordDurableOp
} from '$lib/engine/durable/session.svelte';
import { collaborativeAuthoringField } from '$lib/engine/collab/editingPolicy';
import {
	notifyPeerAuthoringEdit,
	notifyPeerDespawn,
	notifyPeerDurableEdit,
	notifyPeerSpawn,
	resetPeerEditToasts
} from '$lib/engine/collab/peerEditToasts';
import { isPeerTransformAuthoring } from '$lib/engine/player/access';
import { ui } from '$lib/ui/ui.svelte';
import { collab } from '$lib/engine/collab/collab.svelte';
import { peerColor } from '$lib/engine/collab/peerColor';
import { roomChat } from '$lib/engine/collab/roomChat.svelte';
import type { DurablePatch } from '$lib/engine/ontology/durableStore';
import { isFieldPatch } from '$lib/engine/ontology/durablePatch';
import type { Entity } from '$lib/engine/ontology/schema';
import { realtimeFields } from '$lib/engine/ontology/registry';
import {
	SCENE_SETTINGS_COMPONENT,
	SCENE_SETTINGS_ENTITY_ID,
	SCENE_SETTINGS_FIELD
} from '$lib/engine/scene/sceneDocument';
import { world } from '$lib/engine/runtime/world.svelte';
import { roomTransition } from '$lib/engine/room/roomTransition.svelte';
import { warmAdjacentRoomAssets } from '$lib/engine/room/warmRoomAssets';
import { scheduler } from '$lib/engine/systems/scheduler.svelte';
import { buildPlayer } from '$lib/engine/player/spawnPlayer';
import { resetPlayerMovementState } from '$lib/engine/player/playerSystem';
import { applyPlayerLayout, LOCAL_PLAYER_LAYOUT_KEY } from '$lib/engine/dev/editorSession';
import {
	reconcilePlayerSpawnPositions,
	spawnPositionForClient
} from '$lib/engine/player/spawnPoints';
import type { NetEntity, NetMessage, NetTransport, PeerPresence, PeerSelection, StatePatch } from './transport';
import { PRESENCE_OFFSCREEN } from './transport';

export { PRESENCE_OFFSCREEN } from './transport';
export type { PeerPresence } from './transport';

const PUBLISH_MS = 50; // ~20 Hz
const HEARTBEAT_MS = 1000;
const PEER_TIMEOUT_MS = 3000;

class NetSession {
	connected = $state(false);
	/** Active transport — `relay` syncs across browsers; `local` is same-browser tabs only. */
	transportKind = $state<'local' | 'relay'>('local');
	/** Other peers → last-seen timestamp. */
	peers = $state<Record<string, number>>({});
	/** Explicit entity ownership (entityId → ownerClientId). */
	owners = $state<Record<string, string>>({});
	/** Latest edit selection from remote peers (excludes self). */
	peerSelections = $state<Record<string, PeerSelection>>({});

	#transport: NetTransport | null = null;
	#unsub: (() => void) | null = null;
	#publishTimer = 0;
	#heartbeatTimer = 0;
	#myPlayerId: string | null = null;
	#removeSelectionListener: (() => void) | null = null;
	#heartbeatCount = 0;
	#membersKey = '';

	get clientId(): string {
		return this.#transport?.clientId ?? '';
	}

	/** All present ids (self + peers), sorted; smallest is host. */
	get members(): string[] {
		return [this.clientId, ...Object.keys(this.peers)].filter(Boolean).sort();
	}

	get host(): string {
		return this.members[0] ?? this.clientId;
	}

	get isHost(): boolean {
		return this.connected ? this.host === this.clientId : true;
	}

	get peerCount(): number {
		return this.members.length;
	}

	/** Remote peers who currently have `entityId` selected. */
	selectorsFor(entityId: string): Array<{ peerId: string; name: string; color: string }> {
		const result: Array<{ peerId: string; name: string; color: string }> = [];
		for (const [peerId, selection] of Object.entries(this.peerSelections)) {
			if (selection.entityId !== entityId) continue;
			result.push({
				peerId,
				name: collab.displayNameFor(peerId, selection.name),
				color: peerColor(peerId)
			});
		}
		return result.sort((a, b) => a.peerId.localeCompare(b.peerId));
	}

	/** Owner of an entity: an explicit owner, else the host (world entities). */
	ownerOf(entityId: string): string {
		return this.owners[entityId] ?? this.host;
	}

	connect(room: string, transport: NetTransport, kind: 'local' | 'relay' = 'local') {
		if (this.connected || typeof window === 'undefined') return;
		this.#transport = transport;
		this.transportKind = kind;
		transport.connect(room);
		this.#unsub = transport.onMessage((data) => this.#receive(data as NetMessage));
		this.connected = true;
		collab.setClientId(this.clientId);
		roomChat.setClientId(this.clientId);
		world.isOwner = (id: string) => this.ownerOf(id) === this.clientId;
		world.bindDurableNet({
			canWrite: () => true,
			broadcast: (patch) => this.#broadcastDurable(patch),
			broadcastAuthoring: (patch) => this.#broadcastAuthoring(patch)
		});
		world.bindRuntimeNet({
			onSpawn: (entity) => this.replicateSpawn(entity),
			onDespawn: (id) => this.despawnEntity(id),
			onRuntimeDespawn: (id) => this.despawnRuntime(id),
			onGotoRoom: (roomId, meta) => this.broadcastGotoRoom(roomId, meta)
		});
		this.#removeSelectionListener = world.onSelectionChange((entityId) => {
			this.#sendSelection(entityId);
		});

		// Spawn locally on a client-id ring slot, then join before announcing so peers
		// never receive a stacked spawn position from the first network tick.
		const spawn = spawnPositionForClient(this.clientId, [this.clientId]);
		const player = buildPlayer(this.clientId, spawn);
		if (ui.shellMode !== 'play') applyPlayerLayout(player, LOCAL_PLAYER_LAYOUT_KEY);
		this.#myPlayerId = player.id;
		this.owners[player.id] = this.clientId;
		world.localPlayerId = player.id;
		// A stale copy of our player can survive soft reloads (HMR keeps world
		// entities) or arrive from room state — spawn() would silently keep it,
		// including corrupt Transform/Jump data. Always rebuild our own avatar.
		if (world.getEntity(player.id)) world.despawn(player.id);
		world.spawn(player);

		// Handshake immediately (relay outbox queues until open) and again on (re)connect.
		this.#handshakeJoin();
		transport.whenReady(() => this.#handshakeJoin());
		queueMicrotask(() => this.#bootstrapSpawns());
		this.#heartbeatTimer = window.setInterval(() => this.#heartbeat(), HEARTBEAT_MS);
		this.#publishTimer = window.setInterval(() => this.#publish(), PUBLISH_MS);
		window.addEventListener('pagehide', this.#leave);
	}

	disconnect() {
		if (!this.connected) return;
		this.#leave();
		clearInterval(this.#heartbeatTimer);
		clearInterval(this.#publishTimer);
		window.removeEventListener('pagehide', this.#leave);
		this.#removeSelectionListener?.();
		this.#removeSelectionListener = null;
		this.#unsub?.();
		this.#transport?.disconnect();
		this.#transport = null;
		this.connected = false;
		this.transportKind = 'local';
		if (this.#myPlayerId) world.despawn(this.#myPlayerId);
		this.#myPlayerId = null;
		world.localPlayerId = null;
		this.#membersKey = '';
		this.peers = {};
		this.owners = {};
		this.peerSelections = {};
		roomChat.reset();
		resetPeerEditToasts();
		world.bindDurableNet(null);
		world.bindRuntimeNet(null);
		world.isOwner = () => true;
	}

	/** Broadcast an ephemeral chat line to the room. */
	sendChat(text: string) {
		const trimmed = text.trim().slice(0, 280);
		if (!trimmed || !this.connected) return;
		const message = { text: trimmed, at: Date.now(), name: collab.localDisplayName() };
		roomChat.ingest(this.clientId, message, true);
		this.#send({ t: 'chat', id: this.clientId, message });
	}

	/** Ask the room to open its chat (walk-up interact with a peer). */
	sendChatOpen() {
		if (!this.connected || ui.shellMode !== 'play') return;
		this.#send({ t: 'chat_open', id: this.clientId });
	}

	/** Remove an entity locally and across peers (e.g. a collected pickup or deleted prop). */
	/** Match-scoped despawn (collected pickups): never touches ownership or
	 * peer-edit toasts, ignored by peers in edit mode, and reverted locally by
	 * the play snapshot on exit. Authored deletions use despawnEntity. */
	despawnRuntime(id: string) {
		world.despawn(id);
		if (this.connected) {
			this.#send({ t: 'despawn', id: this.clientId, entityId: id, runtime: true });
		}
	}

	/** Broadcast a room transition to peers (host, play mode). */
	broadcastGotoRoom(
		roomId: string,
		meta?: { transition?: string; transitionMs?: number; transitionColor?: string }
	) {
		if (!this.isHost) return;
		this.#send({
			t: 'goto_room',
			id: this.clientId,
			roomId,
			transition: meta?.transition,
			transitionMs: meta?.transitionMs,
			transitionColor: meta?.transitionColor
		});
	}

	despawnEntity(id: string) {
		world.despawn(id);
		delete this.owners[id];
		if (this.connected) this.#send({ t: 'despawn', id: this.clientId, entityId: id });
	}

	/** Replicate a runtime spawn (prop paste / placement) to other peers. */
	replicateSpawn(entity: Entity) {
		this.owners[entity.id] = this.clientId;
		if (this.connected) this.#sendSpawn(entity);
	}

	#receive(msg: NetMessage) {
		if (!msg || typeof msg !== 'object') return;
		switch (msg.t) {
			case 'join':
				this.#touch(msg.id);
				this.#send({ t: 'hello', id: this.clientId }); // help the newcomer discover us
				this.#syncMemberSpawns();
				this.#announcePlayer(); // ...and see our player
				this.#announceOwnedSpawns();
				this.#publish();
				this.#publishPresence();
				this.#sendSelection(world.selection);
				this.#broadcastSceneSettings();
				break;
			case 'hello':
				this.#touch(msg.id);
				this.#syncMemberSpawns();
				this.#announcePlayer();
				this.#announceOwnedSpawns();
				this.#sendSelection(world.selection);
				this.#broadcastSceneSettings();
				break;
			case 'ping':
				this.#touch(msg.id);
				break;
			case 'leave':
				this.#forget(msg.id);
				break;
			case 'spawn':
				if (msg.id !== this.clientId && msg.entity?.id) {
					this.#addRemote(msg.entity, msg.owner ?? msg.id);
				}
				break;
			case 'despawn':
				if (msg.runtime) {
					// Match-scoped: only players consume it; editors keep the
					// authored world, and players get it back via their snapshot.
					if (scheduler.running) world.despawn(msg.entityId);
					break;
				}
				this.#removeRemote(msg.entityId, msg.id);
				break;
			case 'state':
				this.#apply(msg.patch, msg.id);
				break;
			case 'selection':
				this.#applySelection(msg.id, msg.selection);
				break;
			case 'presence':
				this.#applyPresence(msg.id, msg.presence);
				break;
			case 'durable':
				this.#applyDurable(msg.id, msg.patch);
				break;
			case 'authoring':
				this.#applyAuthoring(msg.id, msg.patch);
				break;
			case 'chat':
				if (msg.id !== this.clientId && msg.message?.text) {
					this.#touch(msg.id);
					roomChat.ingest(msg.id, msg.message);
				}
				break;
			case 'chat_open':
				if (msg.id !== this.clientId) {
					this.#touch(msg.id);
					// Open the shared chat so the peer we walked up to sees it too.
					if (ui.shellMode === 'play') roomChat.setOpen(true);
				}
				break;
			case 'goto_room':
				if (msg.id === this.clientId) break;
				{
					const preset = msg.transition === 'none' ? 'none' : 'fade';
					const ms = typeof msg.transitionMs === 'number' ? msg.transitionMs : 400;
					const color = msg.transitionColor ?? '#0a0a0a';
					void roomTransition.run(preset, ms, () => {
						world.switchRoom(msg.roomId, { fromNetwork: true, members: this.members });
						warmAdjacentRoomAssets(msg.roomId);
					}, { color });
				}
				break;
		}
	}

	#applySelection(id: string, selection: PeerSelection) {
		if (!id || id === this.clientId) return;
		this.#touch(id);
		if (!selection.entityId) {
			if (id in this.peerSelections) delete this.peerSelections[id];
			return;
		}
		this.peerSelections[id] = {
			entityId: selection.entityId,
			name: selection.name
		};
	}

	#touch(id: string) {
		if (id && id !== this.clientId) this.peers[id] = Date.now();
	}

	/** Drop a peer and despawn every entity it owned. */
	#forget(id: string) {
		if (id in this.peers) delete this.peers[id];
		if (id in this.peerSelections) delete this.peerSelections[id];
		for (const [entityId, owner] of Object.entries(this.owners)) {
			if (owner === id) {
				world.despawn(entityId);
				delete this.owners[entityId];
			}
		}
		this.#syncMemberSpawns();
	}

	#addRemote(entity: NetEntity, owner: string) {
		const id = entity.id;
		if (id === this.#myPlayerId || id === world.localPlayerId) return;
		if (world.getEntity(id)) return;

		let components = entity.components;
		let type = entity.type ?? 'Prop';

		if (id.startsWith('entity:player/')) {
			const clientId = id.slice('entity:player/'.length);
			if (!clientId) return;
			const spawn = spawnPositionForClient(clientId, this.members);
			const hasVisual =
				!!components?.Render || (!!components?.SkinnedMesh && !!components?.Mesh3DAnimator);
			if (!components?.Player || !components?.Transform || !hasVisual) {
				const rebuilt = buildPlayer(clientId, spawn);
				if (ui.shellMode !== 'play') applyPlayerLayout(rebuilt);
				components = rebuilt.components;
				type = rebuilt.type ?? 'Player';
			} else {
				components = {
					...components,
					Transform: { ...components.Transform, position: spawn }
				};
			}
		} else if (!components?.Render || !components?.Transform) {
			return;
		}

		const spawned: Entity = { id, type, components, raw: {} };
		this.owners[id] = owner;
		world.spawn(spawned);
		this.#notifyPeerEdit(owner, (peerId, wireName) => notifyPeerSpawn(peerId, spawned, wireName));
		world.sanitizeSelection();
	}

	#removeRemote(entityId: string, peerId?: string) {
		if (peerId) {
			this.#notifyPeerEdit(peerId, (id, wireName) =>
				notifyPeerDespawn(id, entityId, wireName)
			);
		}
		world.despawn(entityId);
		delete this.owners[entityId];
	}

	#heartbeat = () => {
		this.#send({ t: 'ping', id: this.clientId });
		// Re-broadcast spawn periodically — idempotent locally, heals dropped handshakes.
		this.#heartbeatCount += 1;
		if (this.#heartbeatCount % 3 === 0) {
			this.#announcePlayer();
			this.#announceOwnedSpawns();
		}
		const cutoff = Date.now() - PEER_TIMEOUT_MS;
		for (const [id, seen] of Object.entries(this.peers)) if (seen < cutoff) this.#forget(id);
	};

	#leave = () => {
		this.#send({ t: 'leave', id: this.clientId });
	};

	#handshakeJoin() {
		if (!this.connected) return;
		this.#send({ t: 'join', id: this.clientId });
	}

	/** Re-slot after roster discovery, then announce with roster spawn pose. */
	#bootstrapSpawns() {
		this.#syncMemberSpawns();
	}

	#announcePlayer() {
		if (!this.#myPlayerId) return;
		const player = world.getEntity(this.#myPlayerId);
		if (!player) return;

		const spawn = spawnPositionForClient(this.clientId, this.members);
		let components = $state.snapshot(player.components) as NetEntity['components'];
		const hasVisual =
			!!components?.Render || (!!components?.SkinnedMesh && !!components?.Mesh3DAnimator);
		if (!components?.Player || !components?.Transform || !hasVisual) {
			const rebuilt = buildPlayer(this.clientId, spawn);
			if (ui.shellMode !== 'play') applyPlayerLayout(rebuilt);
			components = rebuilt.components;
		} else {
			components = {
				...components,
				Transform: { ...components.Transform, position: spawn }
			};
		}

		this.#sendSpawn({ ...player, components: components as Entity['components'] });
	}

	/** Re-broadcast runtime props owned by this client (join heal + heartbeat). */
	#announceOwnedSpawns() {
		if (!this.connected) return;
		for (const [entityId, owner] of Object.entries(this.owners)) {
			if (owner !== this.clientId) continue;
			if (entityId === this.#myPlayerId) continue;
			const entity = world.getEntity(entityId);
			if (!entity) continue;
			this.#sendSpawn(entity);
		}
	}

	#sendSpawn(entity: Entity) {
		this.#send({
			t: 'spawn',
			id: this.clientId,
			owner: this.clientId,
			entity: {
				id: entity.id,
				type: entity.type,
				components: $state.snapshot(entity.components) as NetEntity['components']
			}
		});
	}

	/** Broadcast realtime fields for every entity the local client owns. */
	#publish() {
		const patch = buildPatch((id) => this.ownerOf(id) === this.clientId);
		if (Object.keys(patch).length > 0) this.#send({ t: 'state', id: this.clientId, patch });
		this.#publishPresence();
	}

	rebroadcastPresence() {
		this.#publishPresence();
	}

	#buildPresence(): PeerPresence {
		return {
			x: PRESENCE_OFFSCREEN,
			y: PRESENCE_OFFSCREEN,
			name: collab.localDisplayName(),
			color: collab.localAvatarColor()
		};
	}

	#publishPresence() {
		if (!this.connected) return;
		this.#send({ t: 'presence', id: this.clientId, presence: this.#buildPresence() });
	}

	#applyPresence(id: string, _presence: PeerPresence) {
		if (!id || id === this.clientId) return;
		this.#touch(id);
	}

	#broadcastDurable(patch: DurablePatch) {
		if (!this.connected) return;
		this.#send({ t: 'durable', id: this.clientId, patch });
	}

	#broadcastSceneSettings() {
		const entity = world.getEntity(SCENE_SETTINGS_ENTITY_ID);
		const doc = entity?.components[SCENE_SETTINGS_COMPONENT]?.[SCENE_SETTINGS_FIELD];
		if (!doc) return;
		this.#broadcastDurable({
			entityId: SCENE_SETTINGS_ENTITY_ID,
			component: SCENE_SETTINGS_COMPONENT,
			field: SCENE_SETTINGS_FIELD,
			value: doc
		});
	}

	#broadcastAuthoring(patch: DurablePatch) {
		if (!this.connected || ui.shellMode !== 'edit') return;
		this.#send({ t: 'authoring', id: this.clientId, patch });
	}

	/** Apply a durable edit from any connected peer (Trellis poll may duplicate). */
	#applyDurable(senderId: string, patch: DurablePatch) {
		if (!this.members.includes(senderId)) return;
		applyDurablePatch(patch);
		recordDurableOp(patch);
		this.#notifyPeerEdit(senderId, (id, wireName) => notifyPeerDurableEdit(id, patch, wireName));
	}

	#peerWireName(peerId: string): string {
		return this.peerSelections[peerId]?.name ?? '';
	}

	#notifyPeerEdit(
		peerId: string,
		fn: (peerId: string, wireName: string) => void
	) {
		if (peerId === this.clientId || ui.shellMode !== 'edit' || this.peerCount <= 1) return;
		fn(peerId, this.#peerWireName(peerId));
	}

	/** Apply a peer Transform edit from the wire (players + shared edit mode). */
	#applyAuthoring(senderId: string, patch: DurablePatch) {
		if (!this.members.includes(senderId) || !isFieldPatch(patch)) return;
		const entity = world.getEntity(patch.entityId);
		if (!entity) return;
		const allowed =
			isPeerTransformAuthoring(entity, patch.component, patch.field) ||
			collaborativeAuthoringField(entity, patch.component, patch.field);
		if (!allowed) return;
		applyAuthoringPatch(patch);
		this.#notifyPeerEdit(senderId, (id, wireName) =>
			notifyPeerAuthoringEdit(id, patch, wireName)
		);
	}

	#sendSelection(entityId: string | null) {
		if (!this.connected) return;
		const selection: PeerSelection = {
			entityId,
			name: collab.localDisplayName()
		};
		this.#send({ t: 'selection', id: this.clientId, selection });
	}

	/** Apply a patch, trusting each entity only from its rightful owner. */
	#apply(patch: StatePatch, senderId: string) {
		if (senderId === this.clientId) return;
		for (const [entityId, components] of Object.entries(patch)) {
			if (entityId === world.localPlayerId) continue;
			if (this.ownerOf(entityId) !== senderId) continue;
			const entity = world.getEntity(entityId);
			if (!entity) continue;
			for (const [comp, fields] of Object.entries(components)) {
				if (!entity.components[comp]) continue;
				for (const [field, value] of Object.entries(fields)) {
					world.applyFieldLocal(entityId, comp, field, value);
				}
			}
		}
	}

	#spawnPoint(): [number, number, number] {
		return spawnPositionForClient(this.clientId, this.members);
	}

	/** Re-slot players when the room roster changes (each client initially spawns alone). */
	#syncMemberSpawns() {
		const key = this.members.join('\0');
		if (key === this.#membersKey) return;
		this.#membersKey = key;
		reconcilePlayerSpawnPositions(this.members);
		if (this.#myPlayerId && world.localPlayerId === this.#myPlayerId) {
			resetPlayerMovementState();
		}
		if (this.#myPlayerId) this.#announcePlayer();
	}

	#send(msg: NetMessage) {
		// Snapshot to plain objects — reactive $state proxies can't be structured-cloned
		// (BroadcastChannel) and would leak proxies onto the wire.
		this.#transport?.send($state.snapshot(msg));
	}
}

/** Snapshot owned entities' realtime (synced) fields — derived fields excluded. */
function buildPatch(owns: (entityId: string) => boolean): StatePatch {
	const patch: StatePatch = {};
	for (const entity of world.entities) {
		if (!owns(entity.id)) continue;
		const components: Record<string, Record<string, unknown>> = {};
		for (const [comp, data] of Object.entries(entity.components)) {
			const fields: Record<string, unknown> = {};
			for (const field of realtimeFields(comp)) {
				// A field with a local formula is derived everywhere — never send it.
				if (entity.formulas?.[comp]?.[field]) continue;
				if (data[field] !== undefined) fields[field] = data[field];
			}
			if (Object.keys(fields).length > 0) components[comp] = fields;
		}
		if (Object.keys(components).length > 0) patch[entity.id] = components;
	}
	return patch;
}

export const session = new NetSession();
