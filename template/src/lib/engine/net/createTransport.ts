/**
 * Picks the network transport at runtime.
 *
 * BroadcastChannel is same-browser only (great for multi-tab dev, but it can never
 * sync across browsers/devices). The Trellis realtime relay is the cross-client
 * transport.
 *
 * Selection (first match wins):
 *   - `?net=local` — force BroadcastChannel
 *   - `?net=relay` / `?relay=<url>` — Trellis relay (`VITE_RELAY_URL` is the default URL)
 *   - dev (default) — relay via same-origin `/relay` proxy, fall back to BroadcastChannel
 *   - prod with `VITE_RELAY_URL` — relay
 *   - else BroadcastChannel (Vercel demo default)
 *
 * Cross-device dev: `just run` (or `pnpm dev:relay`) — no `?net=relay` required.
 */
import { BroadcastChannelTransport } from './local';
import { RelayTransport } from './relay';
import type { NetTransport } from './transport';

export type NetTransportKind = 'local' | 'relay';

export type ResolvedTransport = {
	transport: NetTransport;
	kind: NetTransportKind;
};

const RELAY_PROBE_MS = 2500;
const RELAY_FORCE_WAIT_MS = 10_000;

function relayUrlFromParams(params: URLSearchParams): string | undefined {
	const relayParam = params.get('relay');
	if (relayParam) return relayParam;
	return import.meta.env.VITE_RELAY_URL as string | undefined;
}

/** Same-origin relay in dev so LAN clients (phone, other machine) reach the local relay. */
function defaultRelayUrl(): string {
	const fromEnv = import.meta.env.VITE_RELAY_URL as string | undefined;
	if (fromEnv) return fromEnv;
	if (import.meta.env.DEV && typeof location !== 'undefined') {
		const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${proto}//${location.host}/relay`;
	}
	return 'ws://localhost:8231/rt';
}

function waitForRelayReady(transport: NetTransport, ms: number): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (ok: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(ok);
		};
		transport.whenReady(() => finish(true));
		const timer = window.setTimeout(() => finish(false), ms);
	});
}

export async function resolveTransport(room: string): Promise<ResolvedTransport> {
	if (typeof window === 'undefined') {
		return { transport: new BroadcastChannelTransport(), kind: 'local' };
	}

	const params = new URLSearchParams(location.search);
	const net = params.get('net');
	const forceLocal = net === 'local';
	const forceRelay = net === 'relay' || params.has('relay');

	if (forceLocal) {
		return { transport: new BroadcastChannelTransport(), kind: 'local' };
	}

	const relayUrl = relayUrlFromParams(params) ?? defaultRelayUrl();
	const tryRelay = forceRelay || import.meta.env.DEV || Boolean(import.meta.env.VITE_RELAY_URL);

	if (tryRelay) {
		const relay = new RelayTransport(relayUrl);
		relay.connect(room);
		const ready = await waitForRelayReady(relay, forceRelay ? RELAY_FORCE_WAIT_MS : RELAY_PROBE_MS);
		if (ready) return { transport: relay, kind: 'relay' };
		relay.disconnect();
		if (!forceRelay) {
			console.warn(
				'[net] relay unavailable — using BroadcastChannel (same-browser tabs only). Start the relay with `just run` or `pnpm dev:relay`.'
			);
			return { transport: new BroadcastChannelTransport(), kind: 'local' };
		}
		console.warn('[net] relay forced but not connected yet — will keep retrying');
		return { transport: relay, kind: 'relay' };
	}

	return { transport: new BroadcastChannelTransport(), kind: 'local' };
}

/** @deprecated Use `resolveTransport(room)` — kept for tests. */
export function createTransport(): NetTransport {
	if (typeof window === 'undefined') return new BroadcastChannelTransport();
	const params = new URLSearchParams(location.search);
	if (params.get('net') === 'local') return new BroadcastChannelTransport();
	const relayUrl = relayUrlFromParams(params) ?? defaultRelayUrl();
	if (params.get('net') === 'relay' || params.has('relay') || import.meta.env.DEV) {
		return new RelayTransport(relayUrl);
	}
	return new BroadcastChannelTransport();
}
