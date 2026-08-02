/**
 * Trellis realtime-relay transport — cross-machine multiplayer over the dumb
 * fan-out relay shipped in `trellis/server` (`attachRealtimeRelay`, path `/rt`).
 *
 * Same NetTransport seam as the BroadcastChannel/PartyKit adapters: the relay
 * forwards any valid JSON to *other* peers in the room (room = URL path), so our
 * `NetMessage` payloads pass through untouched (only `v:1` Trellis presence frames
 * get replay — ours don't carry `v`, which is fine). Our own clientId rides inside
 * the payload for host election.
 *
 * URL: `${relayUrl}/world:${room}` — e.g. `ws://localhost:8231/rt/world:orbit`
 * or `wss://relay.example.com/rt/world:orbit`. http(s) URLs are normalized to
 * ws(s). Uses a plain WebSocket (no partysocket dep) with a small reconnect loop.
 */
import type { NetTransport } from './transport';

const DEFAULT_RELAY_URL = 'ws://localhost:8231/rt';
const RECONNECT_MS = 1500;

function toWsUrl(url: string): string {
	if (url.startsWith('http://')) return 'ws://' + url.slice(7);
	if (url.startsWith('https://')) return 'wss://' + url.slice(8);
	return url;
}

export class RelayTransport implements NetTransport {
	readonly clientId: string;
	#base: string;
	#room = 'lobby';
	#ws: WebSocket | null = null;
	#handlers = new Set<(data: unknown) => void>();
	#readyHandlers = new Set<() => void>();
	#outbox: unknown[] = [];
	#closed = false;
	#reconnectTimer = 0;

	constructor(relayUrl = DEFAULT_RELAY_URL, clientId = crypto.randomUUID()) {
		this.#base = toWsUrl(relayUrl).replace(/\/$/, '');
		this.clientId = clientId;
	}

	connect(room: string) {
		this.#room = room;
		this.#closed = false;
		this.#open();
	}

	#open() {
		if (this.#closed || typeof WebSocket === 'undefined') return;
		const ws = new WebSocket(`${this.#base}/world:${this.#room}`);
		this.#ws = ws;
		ws.addEventListener('open', () => {
			this.#flushOutbox();
			for (const handler of this.#readyHandlers) handler();
		});
		ws.addEventListener('message', (event: MessageEvent) => {
			let data: unknown;
			try {
				data = JSON.parse(event.data);
			} catch {
				return;
			}
			for (const handler of this.#handlers) handler(data);
		});
		ws.addEventListener('close', () => {
			if (this.#ws === ws) this.#ws = null;
			if (!this.#closed) this.#scheduleReconnect();
		});
	}

	#scheduleReconnect() {
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = window.setTimeout(() => this.#open(), RECONNECT_MS);
	}

	disconnect() {
		this.#closed = true;
		clearTimeout(this.#reconnectTimer);
		this.#ws?.close();
		this.#ws = null;
		this.#handlers.clear();
		this.#readyHandlers.clear();
		this.#outbox = [];
	}

	send(data: unknown) {
		if (this.#ws?.readyState === WebSocket.OPEN) {
			this.#ws.send(JSON.stringify(data));
			return;
		}
		this.#outbox.push(data);
	}

	onMessage(handler: (data: unknown) => void): () => void {
		this.#handlers.add(handler);
		return () => this.#handlers.delete(handler);
	}

	whenReady(handler: () => void) {
		this.#readyHandlers.add(handler);
		if (this.#ws?.readyState === WebSocket.OPEN) handler();
	}

	#flushOutbox() {
		if (this.#ws?.readyState !== WebSocket.OPEN) return;
		for (const data of this.#outbox) this.#ws.send(JSON.stringify(data));
		this.#outbox = [];
	}
}
