import {
	diffGraphToPatches,
	applyDurablePatchToGraph,
	applyPatchToGraph,
	fetchSeedDoc
} from '$lib/engine/durable/graphDiff';
import type { JsonLdDoc, JsonLdNode } from '$lib/engine/ontology/source';
import { fieldAttribute } from '$lib/engine/ontology/sources/eav';
import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import { isFieldPatch, patchKind } from '$lib/engine/ontology/durablePatch';
import {
	getWorldBundleId,
	readWorldGraph,
	seedWorldIfEmpty,
	writeWorldGraph
} from '$lib/engine/ontology/seedWorld';
import { isDurableField } from '$lib/engine/ontology/syncPolicy';

export type {
	DurablePatch,
	DurableFieldPatch,
	DurableSetComponentPatch,
	DurableRemoveComponentPatch,
	DurableSetEntityPatch,
	DurableSetEventsPatch,
	DurablePatchKind
} from '$lib/engine/ontology/durablePatch';
export { patchKind, isFieldPatch } from '$lib/engine/ontology/durablePatch';

export type DurableWriteGate = () => boolean;

export class HostOnlyDurableError extends Error {
	constructor() {
		super('Only the session host can edit durable world fields');
		this.name = 'HostOnlyDurableError';
	}
}

/** Trellis server unreachable — local + net sync may still succeed. */
export class DurableOfflineError extends Error {
	constructor(message = 'Trellis durable server unreachable', options?: ErrorOptions) {
		super(message, options);
		this.name = 'DurableOfflineError';
	}
}

function isFetchFailure(error: unknown): boolean {
	if (!(error instanceof TypeError)) return false;
	const msg = error.message.toLowerCase();
	return msg.includes('failed to fetch') || msg.includes('network');
}

export interface DurableStore {
	load(worldId: string, seedUrl?: string): Promise<JsonLdDoc>;
	updateField(worldId: string, patch: DurablePatch): Promise<void>;
	subscribe?(worldId: string, onPatches: (patches: DurablePatch[]) => void): () => void;
	/** Synchronous gate so callers can reject a durable edit *before* applying it
	 *  locally (avoids ghost RAM state for non-host viewers). Absent ⇒ writable. */
	canWrite?(): boolean;
}

export interface DurableStoreOptions {
	url?: string;
	tenantId?: string;
	canWrite?: DurableWriteGate;
	onConnectionChange?: (connected: boolean) => void;
}

/** Read-only durable store for static JSON-LD worlds. */
export class StaticDurableStore implements DurableStore {
	async load(_worldId: string, seedUrl?: string): Promise<JsonLdDoc> {
		if (!seedUrl) throw new Error('StaticDurableStore.load requires seedUrl');
		return fetchSeedDoc(seedUrl);
	}

	async updateField(): Promise<void> {
		// no-op — static worlds are not persisted
	}
}

/** In-memory durable store for tests and offline dev without Trellis server. */
export class MemoryDurableStore implements DurableStore {
	#graphs = new Map<string, JsonLdNode[]>();
	#canWrite: DurableWriteGate;

	constructor(canWrite: DurableWriteGate = () => true) {
		this.#canWrite = canWrite;
	}

	async load(worldId: string, seedUrl?: string): Promise<JsonLdDoc> {
		if (!this.#graphs.has(worldId)) {
			const seed = seedUrl ? await fetchSeedDoc(seedUrl) : { '@graph': [] };
			this.#graphs.set(worldId, structuredClone(seed['@graph'] ?? []));
		}
		return { '@graph': structuredClone(this.#graphs.get(worldId) ?? []) };
	}

	canWrite(): boolean {
		return this.#canWrite();
	}

	async updateField(worldId: string, patch: DurablePatch): Promise<void> {
		if (!this.#canWrite()) throw new HostOnlyDurableError();
		const graph = this.#graphs.get(worldId);
		if (!graph) return;
		applyDurablePatchToGraph(graph, patch);
	}

	subscribe(worldId: string, onPatches: (patches: DurablePatch[]) => void): () => void {
		let last = structuredClone(this.#graphs.get(worldId) ?? []);
		const check = () => {
			const graph = this.#graphs.get(worldId) ?? [];
			const patches = diffGraphToPatches(last, graph);
			last = structuredClone(graph);
			if (patches.length) onPatches(patches);
		};
		const interval = setInterval(check, 50);
		return () => clearInterval(interval);
	}

	/** Test helper — seed without HTTP fetch. */
	seedFromDoc(worldId: string, doc: JsonLdDoc) {
		this.#graphs.set(worldId, structuredClone(doc['@graph'] ?? []));
	}
}

const POLL_INTERVAL_MS = 1000;
/** Back off Trellis writes after a failure to avoid fetch spam while offline. */
const OFFLINE_RETRY_MS = 10_000;

/** Remote TrellisDb-backed durable store (WorldBundle graph blob per tenant). */
export class TrellisDurableStore implements DurableStore {
	#db: import('trellis/client/sdk').TrellisDb;
	#canWrite: DurableWriteGate;
	#onConnectionChange?: (connected: boolean) => void;
	#bundleId: string | null = null;
	#lastGraph: JsonLdNode[] = [];
	#connected = false;
	#offlineSince = 0;

	constructor(
		db: import('trellis/client/sdk').TrellisDb,
		opts: Pick<DurableStoreOptions, 'canWrite' | 'onConnectionChange'> = {}
	) {
		this.#db = db;
		this.#canWrite = opts.canWrite ?? (() => true);
		this.#onConnectionChange = opts.onConnectionChange;
	}

	#setConnected(connected: boolean) {
		if (this.#connected === connected) return;
		this.#connected = connected;
		this.#onConnectionChange?.(connected);
	}

	#markOffline(error?: unknown) {
		this.#offlineSince = Date.now();
		this.#setConnected(false);
		if (error && !isFetchFailure(error)) {
			console.warn('[durable] Trellis request failed', error);
		}
	}

	async load(_worldId: string, seedUrl?: string): Promise<JsonLdDoc> {
		try {
			if (seedUrl) {
				const seed = await fetchSeedDoc(seedUrl);
				await seedWorldIfEmpty(this.#db, seed);
			}
			this.#bundleId = await getWorldBundleId(this.#db);
			const graph = await readWorldGraph(this.#db);
			this.#lastGraph = structuredClone(graph);
			this.#offlineSince = 0;
			this.#setConnected(true);
			return { '@graph': structuredClone(graph) };
		} catch (error) {
			this.#markOffline(error);
			throw new DurableOfflineError(undefined, { cause: error });
		}
	}

	canWrite(): boolean {
		return this.#canWrite();
	}

	async updateField(_worldId: string, patch: DurablePatch): Promise<void> {
		if (!this.#canWrite()) throw new HostOnlyDurableError();
		if (
			patchKind(patch) === 'setField' &&
			isFieldPatch(patch) &&
			!isDurableField(patch.component, patch.field, patch.value)
		) {
			return;
		}

		if (
			!this.#connected &&
			this.#offlineSince > 0 &&
			Date.now() - this.#offlineSince < OFFLINE_RETRY_MS
		) {
			throw new DurableOfflineError();
		}

		try {
			const graph = await readWorldGraph(this.#db);
			applyDurablePatchToGraph(graph, patch);
			const bundleId = this.#bundleId ?? (await getWorldBundleId(this.#db));
			if (!bundleId) throw new Error('WorldBundle missing after seed');
			this.#bundleId = bundleId;
			await writeWorldGraph(this.#db, bundleId, graph);
			this.#lastGraph = structuredClone(graph);
			this.#offlineSince = 0;
			this.#setConnected(true);
		} catch (error) {
			this.#markOffline(error);
			throw error instanceof DurableOfflineError
				? error
				: new DurableOfflineError(undefined, { cause: error });
		}
	}

	subscribe(_worldId: string, onPatches: (patches: DurablePatch[]) => void): () => void {
		// NOTE: We poll rather than use a live EQL subscription. The world is stored
		// as a single WorldBundle entity, and a `(?e type WorldBundle)` subscription
		// only fires when the matching *set* changes — never on attribute (graph)
		// updates — so it can't deliver edits. Durable edits are low-frequency, so a
		// short poll + diff is fine. A true push requires per-field EAV entities
		// (blocked on Trellis `create` accepting explicit `entity:*` ids).
		let active = true;
		let timer = 0;

		const schedule = (delay = POLL_INTERVAL_MS) => {
			timer = window.setTimeout(() => void poll(), delay);
		};

		const poll = async () => {
			if (!active) return;
			let next = POLL_INTERVAL_MS;
			try {
				const graph = await readWorldGraph(this.#db);
				this.#offlineSince = 0;
				this.#setConnected(true);
				const patches = diffGraphToPatches(this.#lastGraph, graph);
				this.#lastGraph = structuredClone(graph);
				if (patches.length) onPatches(patches);
			} catch (error) {
				this.#markOffline(error);
				next = OFFLINE_RETRY_MS;
			}
			schedule(next);
		};

		schedule(POLL_INTERVAL_MS);

		return () => {
			active = false;
			clearTimeout(timer);
		};
	}
}

export function createDurableStore(
	mode: 'static' | 'trellis' | 'memory',
	opts: DurableStoreOptions = {}
): DurableStore | Promise<DurableStore> {
	const canWrite = opts.canWrite ?? (() => true);
	if (mode === 'static') return new StaticDurableStore();
	if (mode === 'memory') return new MemoryDurableStore(canWrite);
	return createTrellisDurableStore(opts);
}

async function createTrellisDurableStore(opts: DurableStoreOptions): Promise<TrellisDurableStore> {
	const { TrellisDb } = await import('trellis/client/sdk');
	const db = new TrellisDb({
		url: opts.url ?? 'http://localhost:8230',
		tenantId: opts.tenantId
	});
	return new TrellisDurableStore(db, opts);
}

export { fieldAttribute };
