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

class RoomChatState {
	messages = $state<RoomChatLine[]>([]);
	unread = $state(0);
	open = $state(false);
	#seen = new Set<string>();
	#clientId = '';

	setClientId(clientId: string) {
		this.#clientId = clientId;
	}

	reset() {
		this.messages = [];
		this.unread = 0;
		this.open = false;
		this.#seen.clear();
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
