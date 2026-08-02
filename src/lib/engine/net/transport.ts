/**
 * Transport-agnostic networking seam. A transport is a dumb pub/sub pipe between
 * peers in a room — it knows nothing about presence or game state. Presence and
 * state replication are built on top in `session.svelte.ts`, so swapping the
 * BroadcastChannel adapter (M3) for PartyKit (M4) requires no session changes.
 */
import type { DurablePatch } from '$lib/engine/ontology/durableStore';

export interface NetTransport {
	/** Stable id for this peer for the life of the connection. */
	readonly clientId: string;
	connect(room: string): void;
	disconnect(): void;
	/** Broadcast a payload to every other peer in the room. */
	send(data: unknown): void;
	/** Subscribe to payloads from other peers. Returns an unsubscribe fn. */
	onMessage(handler: (data: unknown) => void): () => void;
	/** Run when the transport can deliver messages (immediate for BroadcastChannel). */
	whenReady(handler: () => void): void;
}

/** Realtime field values to apply, keyed entityId → component → field. */
export type StatePatch = Record<string, Record<string, Record<string, unknown>>>;

/** A serializable entity definition shared when a peer spawns one (e.g. a player). */
export interface NetEntity {
	id: string;
	type?: string;
	components: Record<string, Record<string, unknown>>;
}

/** Ephemeral edit-mode entity selection from a remote peer. */
export type PeerSelection = {
	entityId: string | null;
	name: string;
};

export const PRESENCE_OFFSCREEN = -1;

/** Ephemeral collaborator identity (display name + color). */
export type PeerPresence = {
	x: number;
	y: number;
	name: string;
	color: string;
};

/** Ephemeral room chat line — not persisted to Trellis. */
export type RoomChatWire = {
	text: string;
	at: number;
	name: string;
};

/** Session-level messages exchanged over the transport. `id` is always the sender. */
export type NetMessage =
	| { t: 'join'; id: string }
	| { t: 'hello'; id: string }
	| { t: 'ping'; id: string }
	| { t: 'leave'; id: string }
	| { t: 'state'; id: string; patch: StatePatch }
	| { t: 'spawn'; id: string; entity: NetEntity; owner: string }
	/** `runtime: true` marks a match-scoped despawn (collected coin) — peers
	 * apply it only while their own simulation is running, never in edit. */
	| { t: 'despawn'; id: string; entityId: string; runtime?: boolean }
	| { t: 'selection'; id: string; selection: PeerSelection }
	| { t: 'presence'; id: string; presence: PeerPresence }
	/** Host-authored durable field edit — immediate peer sync (Trellis is async). */
	| { t: 'durable'; id: string; patch: DurablePatch }
	/** Cross-peer Transform edit on a player avatar (edit mode). */
	| { t: 'authoring'; id: string; patch: DurablePatch }
	/** Ephemeral room chat message. */
	| { t: 'chat'; id: string; message: RoomChatWire }
	/** Host-authored room transition in multi-room games (play mode). */
	| {
		t: 'goto_room';
		id: string;
		roomId: string;
		transition?: string;
		transitionMs?: number;
		transitionColor?: string;
	};
