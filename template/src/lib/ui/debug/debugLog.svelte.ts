import { browser } from '$app/environment';
import type { DebugLogEntry, DebugLogLevel } from '$lib/ui/debug/types';

const MAX_LINES = 200;
const MAX_LINE_CHARS = 500;

function stringifyArg(value: unknown): string {
	if (value === undefined) return 'undefined';
	if (value === null) return 'null';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value);
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function formatLine(args: unknown[]): string {
	const text = args.map(stringifyArg).join(' ').slice(0, MAX_LINE_CHARS);
	return text;
}

class DebugLogState {
	entries = $state<DebugLogEntry[]>([]);
	newSinceCollapse = $state(0);
	pinScroll = $state(true);
	collapsed = $state(true);
	#nextId = 0;
	#original: Partial<Pick<Console, 'log' | 'warn' | 'error'>> | null = null;
	#installed = false;

	install() {
		if (!browser || this.#installed) return;

		this.#original = {
			log: console.log.bind(console),
			warn: console.warn.bind(console),
			error: console.error.bind(console)
		};

		console.log = (...args: unknown[]) => {
			this.append('log', args);
			this.#original?.log?.(...args);
		};
		console.warn = (...args: unknown[]) => {
			this.append('warn', args);
			this.#original?.warn?.(...args);
		};
		console.error = (...args: unknown[]) => {
			this.append('error', args);
			this.#original?.error?.(...args);
		};

		this.#installed = true;
	}

	uninstall() {
		if (!browser || !this.#installed || !this.#original) return;

		if (this.#original.log) console.log = this.#original.log;
		if (this.#original.warn) console.warn = this.#original.warn;
		if (this.#original.error) console.error = this.#original.error;

		this.#original = null;
		this.#installed = false;
	}

	clear() {
		this.entries = [];
		this.newSinceCollapse = 0;
	}

	markSeen() {
		this.newSinceCollapse = 0;
	}

	setCollapsed(value: boolean) {
		this.collapsed = value;
		if (!value) this.markSeen();
	}

	append(level: DebugLogLevel, args: unknown[]) {
		const entry: DebugLogEntry = {
			id: this.#nextId++,
			level,
			text: formatLine(args),
			ts: Date.now()
		};

		// Console hooks can fire inside $derived / template reads (e.g. Three.js warnings).
		queueMicrotask(() => {
			const next = [...this.entries, entry];
			if (next.length > MAX_LINES) next.splice(0, next.length - MAX_LINES);
			this.entries = next;

			if (this.collapsed) this.newSinceCollapse += 1;
		});
	}
}

export const debugLog = new DebugLogState();
