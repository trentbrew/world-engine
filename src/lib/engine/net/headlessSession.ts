/**
 * Minimal relay participant for headless agents — binds world replication without
 * pulling browser UI, Svelte components, or a local player avatar.
 */
import { applyDurableMutation } from '$lib/engine/runtime/applyMutation';
import type { DurablePatch } from '$lib/engine/ontology/durableStore';
import type { Entity } from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';
import { RelayTransport } from '$lib/engine/net/relay';
import type { NetEntity, NetMessage, NetTransport } from '$lib/engine/net/transport';

const HEARTBEAT_MS = 1000;
const PEER_TIMEOUT_MS = 3000;

let active: HeadlessNetSession | null = null;

class HeadlessNetSession {
	readonly clientId: string;
	#transport: NetTransport;
	#unsub: (() => void) | null = null;
	#heartbeatTimer: ReturnType<typeof setInterval> | 0 = 0;
	peers: Record<string, number> = {};
	owners: Record<string, string> = {};

	constructor(transport: NetTransport) {
		this.clientId = transport.clientId;
		this.#transport = transport;
	}

	get members(): string[] {
		return [this.clientId, ...Object.keys(this.peers)].filter(Boolean).sort();
	}

	connect(room: string) {
		this.#transport.connect(room);
		this.#unsub = this.#transport.onMessage((data) => this.#receive(data as NetMessage));
		world.isOwner = (id: string) => (this.owners[id] ?? this.members[0] ?? this.clientId) === this.clientId;
		world.bindDurableNet({
			canWrite: () => true,
			broadcast: (patch) => this.#broadcastDurable(patch),
			broadcastAuthoring: () => {}
		});
		world.bindRuntimeNet({
			onSpawn: (entity) => this.#replicateSpawn(entity),
			onDespawn: (id) => this.#despawnEntity(id),
			onRuntimeDespawn: (id) => this.#despawnRuntime(id),
			onGotoRoom: () => {}
		});
		this.#send({ t: 'join', id: this.clientId });
		this.#transport.whenReady(() => this.#send({ t: 'join', id: this.clientId }));
		this.#heartbeatTimer = setInterval(() => this.#heartbeat(), HEARTBEAT_MS);
	}

	disconnect() {
		clearInterval(this.#heartbeatTimer);
		this.#send({ t: 'leave', id: this.clientId });
		this.#unsub?.();
		this.#transport.disconnect();
		this.#unsub = null;
		world.bindDurableNet(null);
		world.bindRuntimeNet(null);
		world.isOwner = () => true;
		this.peers = {};
		this.owners = {};
	}

	#send(msg: NetMessage) {
		this.#transport.send(msg);
	}

	#broadcastDurable(patch: DurablePatch) {
		this.#send({ t: 'durable', id: this.clientId, patch });
	}

	#replicateSpawn(entity: Entity) {
		this.owners[entity.id] = this.clientId;
		this.#sendSpawn(entity);
	}

	#sendSpawn(entity: Entity) {
		const netEntity: NetEntity = {
			id: entity.id,
			type: entity.type,
			components: structuredClone(entity.components)
		};
		this.#send({ t: 'spawn', id: this.clientId, entity: netEntity, owner: this.clientId });
	}

	#despawnEntity(id: string) {
		world.despawn(id);
		delete this.owners[id];
		this.#send({ t: 'despawn', id: this.clientId, entityId: id });
	}

	#despawnRuntime(id: string) {
		world.despawn(id);
		this.#send({ t: 'despawn', id: this.clientId, entityId: id, runtime: true });
	}

	#touch(id: string) {
		if (id && id !== this.clientId) this.peers[id] = Date.now();
	}

	#forget(id: string) {
		if (id in this.peers) delete this.peers[id];
		for (const [entityId, owner] of Object.entries(this.owners)) {
			if (owner === id) {
				world.despawn(entityId);
				delete this.owners[entityId];
			}
		}
	}

	#addRemote(entity: NetEntity, owner: string) {
		const id = entity.id;
		if (world.getEntity(id)) return;
		if (!entity.components?.Render || !entity.components?.Transform) return;
		const spawned: Entity = {
			id,
			type: entity.type ?? 'Prop',
			components: entity.components,
			raw: {}
		};
		this.owners[id] = owner;
		world.spawn(spawned);
	}

	#receive(msg: NetMessage) {
		if (!msg || typeof msg !== 'object') return;
		switch (msg.t) {
			case 'join':
				this.#touch(msg.id);
				this.#send({ t: 'hello', id: this.clientId });
				this.#announceOwnedSpawns();
				break;
			case 'hello':
				this.#touch(msg.id);
				this.#announceOwnedSpawns();
				break;
			case 'ping':
				this.#touch(msg.id);
				break;
			case 'leave':
				this.#forget(msg.id);
				break;
			case 'durable':
				this.#applyDurable(msg.id, msg.patch);
				break;
			case 'spawn':
				if (msg.id !== this.clientId) {
					this.#touch(msg.id);
					this.#addRemote(msg.entity, msg.owner);
				}
				break;
			case 'despawn':
				if (msg.id !== this.clientId) {
					this.#touch(msg.id);
					world.despawn(msg.entityId);
					delete this.owners[msg.entityId];
				}
				break;
		}
	}

	#applyDurable(senderId: string, patch: DurablePatch) {
		if (!this.members.includes(senderId)) return;
		world.applyingRemoteDurable = true;
		try {
			applyDurableMutation(patch);
		} finally {
			world.applyingRemoteDurable = false;
		}
	}

	#announceOwnedSpawns() {
		for (const entity of world.entities) {
			if (this.owners[entity.id] === this.clientId) this.#sendSpawn(entity);
		}
	}

	#heartbeat() {
		this.#send({ t: 'ping', id: this.clientId });
		const cutoff = Date.now() - PEER_TIMEOUT_MS;
		for (const [id, seen] of Object.entries(this.peers)) {
			if (seen < cutoff) this.#forget(id);
		}
	}
}

export function connectHeadlessSession(
	room: string,
	transport: NetTransport
): HeadlessNetSession {
	if (active) active.disconnect();
	const session = new HeadlessNetSession(transport);
	session.connect(room);
	active = session;
	return session;
}

export function disconnectHeadlessSession(): void {
	active?.disconnect();
	active = null;
}

export function headlessSessionActive(): HeadlessNetSession | null {
	return active;
}
