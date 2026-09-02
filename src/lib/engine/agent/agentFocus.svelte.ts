import { peerColor } from '$lib/engine/collab/peerColor';
import type { AgentFocusWire } from '$lib/engine/net/transport';
import { ui } from '$lib/ui/ui.svelte';

export type AgentFocusEntry = {
	agentId: string;
	displayName: string;
	entityIds: string[];
	expiresAt: number;
};

export const AGENT_FOCUS_TTL_MS = 3500;
export const AGENT_FOCUS_MAX_ENTRIES = 8;

const ANNOUNCE_DEBOUNCE_MS = 500;

let broadcastFocus: ((focus: AgentFocusWire) => void) | null = null;
const announceTimers = new Map<string, ReturnType<typeof setTimeout>>();

class AgentFocusState {
	entries = $state<AgentFocusEntry[]>([]);
	lastAnnouncement = $state('');

	bindBroadcast(fn: ((focus: AgentFocusWire) => void) | null) {
		broadcastFocus = fn;
	}

	track(opts: { agentId: string; displayName: string; entityIds: string[] }) {
		if (!ui.chrome.agentFocus) return;

		const entityIds = [...new Set(opts.entityIds.filter(Boolean))];
		if (entityIds.length === 0) return;

		const now = Date.now();
		const expiresAt = now + AGENT_FOCUS_TTL_MS;
		const entry: AgentFocusEntry = {
			agentId: opts.agentId,
			displayName: opts.displayName,
			entityIds,
			expiresAt
		};

		const next = this.entries.filter((e) => e.agentId !== opts.agentId);
		next.push(entry);
		while (next.length > AGENT_FOCUS_MAX_ENTRIES) next.shift();
		this.entries = next;

		this.#scheduleAnnouncement(opts.agentId, opts.displayName, entityIds[0]!);

		broadcastFocus?.({
			agentId: opts.agentId,
			displayName: opts.displayName,
			entityIds,
			expiresAt
		});
	}

	applyRemote(focus: AgentFocusWire) {
		if (!ui.chrome.agentFocus) return;
		const entityIds = [...new Set(focus.entityIds.filter(Boolean))];
		if (entityIds.length === 0) return;

		const entry: AgentFocusEntry = {
			agentId: focus.agentId,
			displayName: focus.displayName,
			entityIds,
			expiresAt: focus.expiresAt
		};

		const next = this.entries.filter((e) => e.agentId !== focus.agentId);
		next.push(entry);
		while (next.length > AGENT_FOCUS_MAX_ENTRIES) next.shift();
		this.entries = next;
	}

	prune(now = Date.now()) {
		const next = this.entries.filter((e) => e.expiresAt > now);
		if (next.length !== this.entries.length) this.entries = next;
	}

	clear() {
		this.entries = [];
		this.lastAnnouncement = '';
		for (const timer of announceTimers.values()) clearTimeout(timer);
		announceTimers.clear();
	}

	colorFor(agentId: string): string {
		return peerColor(agentId);
	}

	#scheduleAnnouncement(agentId: string, displayName: string, entityId: string) {
		const prev = announceTimers.get(agentId);
		if (prev) clearTimeout(prev);
		const timer = setTimeout(() => {
			announceTimers.delete(agentId);
			this.lastAnnouncement = `${displayName} updated ${entityId}`;
		}, ANNOUNCE_DEBOUNCE_MS);
		announceTimers.set(agentId, timer);
	}
}

export const agentFocus = new AgentFocusState();

export function bindAgentFocusBroadcast(fn: ((focus: AgentFocusWire) => void) | null) {
	agentFocus.bindBroadcast(fn);
}

export function trackAgentFocus(opts: {
	agentId: string;
	displayName: string;
	entityIds: string[];
}): void {
	agentFocus.track(opts);
}

export function applyRemoteAgentFocus(focus: AgentFocusWire): void {
	agentFocus.applyRemote(focus);
}

export function pruneAgentFocus(now?: number): void {
	agentFocus.prune(now);
}

export function activeAgentFocus(): AgentFocusEntry[] {
	return agentFocus.entries;
}

export function clearAgentFocus(): void {
	agentFocus.clear();
}

/** Agent outline pulse — off when user prefers reduced motion. */
export function agentFocusPulseSpeed(): number {
	if (typeof matchMedia === 'undefined') return 1.2;
	return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1.2;
}

/** Headless / Node: broadcast only (no local store). */
export function broadcastAgentFocusWire(opts: {
	agentId: string;
	displayName: string;
	entityIds: string[];
}): void {
	const entityIds = [...new Set(opts.entityIds.filter(Boolean))];
	if (entityIds.length === 0 || !broadcastFocus) return;
	broadcastFocus({
		agentId: opts.agentId,
		displayName: opts.displayName,
		entityIds,
		expiresAt: Date.now() + AGENT_FOCUS_TTL_MS
	});
}
