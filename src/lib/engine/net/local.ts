/**
 * BroadcastChannel transport — "multiplayer" across tabs of the same browser.
 * Zero infrastructure; ideal for developing the sync layer before a real backend.
 * Messages are tagged with the sender so peers ignore their own broadcasts.
 */
import type { NetTransport } from './transport';

export class BroadcastChannelTransport implements NetTransport {
	readonly clientId: string;
	#channel: BroadcastChannel | null = null;
	#handlers = new Set<(data: unknown) => void>();

	constructor(clientId = crypto.randomUUID()) {
		this.clientId = clientId;
	}

	connect(room: string) {
		if (typeof BroadcastChannel === 'undefined') return;
		this.#channel = new BroadcastChannel(`world:${room}`);
		this.#channel.onmessage = (event: MessageEvent) => {
			const { from, data } = event.data ?? {};
			if (from === this.clientId) return; // ignore our own echoes
			for (const handler of this.#handlers) handler(data);
		};
	}

	disconnect() {
		this.#channel?.close();
		this.#channel = null;
		this.#handlers.clear();
	}

	send(data: unknown) {
		this.#channel?.postMessage({ from: this.clientId, data });
	}

	onMessage(handler: (data: unknown) => void): () => void {
		this.#handlers.add(handler);
		return () => this.#handlers.delete(handler);
	}

	whenReady(handler: () => void) {
		handler();
	}
}
