import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
import { peerColor } from '$lib/engine/collab/peerColor';
import { collab } from '$lib/engine/collab/collab.svelte';
import type { RoomChatWire } from '$lib/engine/net/transport';
import { peerToast } from '$lib/ui/toastPeer';

/** Edit-mode global room channel — all collaborators in the session. */
export const ROOM_CONVO_ID = 'room';

export type RoomChatLine = RoomChatWire & {
	peerId: string;
	color: string;
	mine: boolean;
	convoId: string;
};

export type PeerConvoState = {
	convoId: string;
	members: string[];
};

const MAX_MESSAGES = 100;

/** Drop a peer's typing state if their "stopped" signal never arrives. */
const TYPING_TTL_MS = 5000;

function sortedMembers(members: string[]): string[] {
	return [...new Set(members.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function newConvoId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `convo:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

class RoomChatState {
	messages = $state<RoomChatLine[]>([]);
	unread = $state(0);
	open = $state(false);
	/** Active play-mode convo id; `room` in edit global chat. */
	convoId = $state<string | null>(null);
	/** clientIds in the active conversation (includes self). */
	members = $state<string[]>([]);
	/** Discovery map — who is in which convo (from wire). */
	peerConvo = $state<Record<string, PeerConvoState>>({});
	/** Local player has non-empty draft or active composer typing edge. */
	localComposing = $state(false);
	/** peerId → expiry timestamp for peers currently composing a message. */
	typing = $state<Record<string, number>>({});
	#seen = new Set<string>();
	#clientId = '';
	#typingTimer = 0;

	setClientId(clientId: string) {
		this.#clientId = clientId;
	}

	reset() {
		this.messages = [];
		this.unread = 0;
		this.open = false;
		this.convoId = null;
		this.members = [];
		this.peerConvo = {};
		this.localComposing = false;
		this.#seen.clear();
		this.typing = {};
		this.#syncTypingTimer();
	}

	/** Lines for the active conversation only. */
	activeMessages(): RoomChatLine[] {
		const id = this.convoId;
		if (!id) return [];
		return this.messages.filter((line) => line.convoId === id);
	}

	/** Edit-mode global channel — all session members. */
	ensureRoomConvo(sessionMembers: string[]) {
		const members = sortedMembers([this.#clientId, ...sessionMembers]);
		this.convoId = ROOM_CONVO_ID;
		this.members = members;
		this.notePeerConvo(ROOM_CONVO_ID, members);
	}

	/** Start a 1:1 play-mode conversation with a nearby peer. */
	startConvo(partnerClientId: string): PeerConvoState {
		const convoId = newConvoId();
		const members = sortedMembers([this.#clientId, partnerClientId]);
		this.convoId = convoId;
		this.members = members;
		this.notePeerConvo(convoId, members);
		this.setOpen(true);
		return { convoId, members };
	}

	/** Join an existing group conversation (no history replay). */
	joinConvo(convoId: string, members: string[]) {
		const merged = sortedMembers(members);
		this.convoId = convoId;
		this.members = merged;
		this.notePeerConvo(convoId, merged);
		this.setOpen(true);
	}

	/** Merge a new member list broadcast from a peer. */
	mergeConvoMembers(convoId: string, members: string[]) {
		const merged = sortedMembers(members);
		this.notePeerConvo(convoId, merged);
		if (this.convoId === convoId) {
			this.members = merged;
		}
	}

	/** Record convo membership for every listed peer (discovery). */
	notePeerConvo(convoId: string, members: string[]) {
		const merged = sortedMembers(members);
		const next = { ...this.peerConvo };
		for (const peerId of merged) {
			next[peerId] = { convoId, members: merged };
		}
		this.peerConvo = next;
	}

	clearPeerConvo(peerId: string) {
		if (!(peerId in this.peerConvo)) return;
		const next = { ...this.peerConvo };
		delete next[peerId];
		this.peerConvo = next;
	}

	/** Close panel and clear active convo (play mode). Returns convoId for wire leave. */
	leaveConvo(): string | null {
		const convoId = this.convoId;
		this.localComposing = false;
		this.convoId = null;
		this.members = [];
		this.setOpen(false);
		return convoId && convoId !== ROOM_CONVO_ID ? convoId : null;
	}

	/** Close play-mode proximity chat and return convoId for wire leave (if any). */
	endPlayConversation(): string | null {
		if (!this.open && !this.convoId) return null;
		return this.leaveConvo();
	}

	/** Close the panel without clearing message history (reset / partner left). */
	closeConversation() {
		this.localComposing = false;
		this.setOpen(false);
	}

	setLocalComposing(composing: boolean) {
		this.localComposing = composing;
	}

	/** True when a peer is actively composing (local draft or remote typing edge). */
	isComposing(clientId: string): boolean {
		if (!clientId) return false;
		if (clientId === this.#clientId) return this.localComposing;
		const expiresAt = this.typing[clientId];
		return typeof expiresAt === 'number' && expiresAt > Date.now();
	}

	/** Display names of peers currently typing (self excluded). */
	typingNames(): string[] {
		return Object.keys(this.typing)
			.filter((peerId) => peerId !== this.#clientId)
			.sort()
			.map((peerId) => collab.displayNameFor(peerId));
	}

	setTyping(peerId: string, typing: boolean) {
		if (!peerId || peerId === this.#clientId) return;
		if (typing) {
			this.typing = { ...this.typing, [peerId]: Date.now() + TYPING_TTL_MS };
		} else if (peerId in this.typing) {
			const next = { ...this.typing };
			delete next[peerId];
			this.typing = next;
		}
		this.#syncTypingTimer();
	}

	clearTyping(peerId: string) {
		this.setTyping(peerId, false);
	}

	/** Run a prune ticker only while someone is typing. */
	#syncTypingTimer() {
		if (typeof window === 'undefined') return;
		const active = Object.keys(this.typing).length > 0;
		if (active && !this.#typingTimer) {
			this.#typingTimer = window.setInterval(() => this.#pruneTyping(), 1000);
		} else if (!active && this.#typingTimer) {
			clearInterval(this.#typingTimer);
			this.#typingTimer = 0;
		}
	}

	#pruneTyping() {
		const now = Date.now();
		let changed = false;
		for (const [peerId, expiresAt] of Object.entries(this.typing)) {
			if (expiresAt <= now) {
				delete this.typing[peerId];
				changed = true;
			}
		}
		if (changed) this.typing = { ...this.typing };
		this.#syncTypingTimer();
	}

	setOpen(open: boolean) {
		this.open = open;
		if (open) this.markRead();
	}

	markRead() {
		this.unread = 0;
	}

	ingest(
		peerId: string,
		wire: RoomChatWire,
		opts: { convoId: string; members: string[]; mine?: boolean }
	) {
		const { convoId, members, mine = false } = opts;
		const isMine = mine || peerId === this.#clientId;
		if (!isMine && !members.includes(this.#clientId)) return;

		const key = `${convoId}:${peerId}:${wire.at}`;
		if (this.#seen.has(key)) return;
		this.#seen.add(key);
		this.setTyping(peerId, false);
		if (this.#seen.size > MAX_MESSAGES * 2) {
			for (const id of this.#seen) {
				this.#seen.delete(id);
				if (this.#seen.size <= MAX_MESSAGES) break;
			}
		}

		const line: RoomChatLine = {
			...wire,
			peerId,
			convoId,
			color: peerColor(peerId),
			mine: isMine
		};
		this.messages = [...this.messages, line].slice(-MAX_MESSAGES);
		if (!this.open && !line.mine && members.includes(this.#clientId)) {
			this.unread += 1;
			this.#notifyIncoming(line);
		}
	}

	#notifyIncoming(line: RoomChatLine) {
		const name = line.name.trim() || collab.displayNameFor(line.peerId);
		const preview =
			line.text.length > 96 ? `${line.text.slice(0, 96).trimEnd()}…` : line.text;
		peerToast(line.peerId, name, {
			id: `room-chat:${line.convoId}:${line.peerId}:${line.at}`,
			description: preview,
			duration: 4500,
			icon: MessageCircleIcon
		});
	}
}

export const roomChat = new RoomChatState();
