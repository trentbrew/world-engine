import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
import { peerColor } from '$lib/engine/collab/peerColor';
import { collab } from '$lib/engine/collab/collab.svelte';
import type { RoomChatWire } from '$lib/engine/net/transport';
import { peerToast } from '$lib/ui/toastPeer';

export type RoomChatLine = RoomChatWire & {
	peerId: string;
	color: string;
	mine: boolean;
};

const MAX_MESSAGES = 100;

/** Drop a peer's typing state if their "stopped" signal never arrives. */
const TYPING_TTL_MS = 5000;

class RoomChatState {
	messages = $state<RoomChatLine[]>([]);
	unread = $state(0);
	open = $state(false);
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
		this.#seen.clear();
		this.typing = {};
		this.#syncTypingTimer();
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

	ingest(peerId: string, wire: RoomChatWire, mine = false) {
		const key = `${peerId}:${wire.at}`;
		if (this.#seen.has(key)) return;
		this.#seen.add(key);
		// A delivered line ends that peer's composing state.
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
			color: peerColor(peerId),
			mine: mine || peerId === this.#clientId
		};
		this.messages = [...this.messages, line].slice(-MAX_MESSAGES);
		if (!this.open && !line.mine) {
			this.unread += 1;
			this.#notifyIncoming(line);
		}
	}

	#notifyIncoming(line: RoomChatLine) {
		const name = line.name.trim() || collab.displayNameFor(line.peerId);
		const preview =
			line.text.length > 96 ? `${line.text.slice(0, 96).trimEnd()}…` : line.text;
		peerToast(line.peerId, name, {
			id: `room-chat:${line.peerId}:${line.at}`,
			description: preview,
			duration: 4500,
			icon: MessageCircleIcon
		});
	}
}

export const roomChat = new RoomChatState();
