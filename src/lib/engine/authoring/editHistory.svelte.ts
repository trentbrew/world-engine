import type { HistoryPatch } from '$lib/engine/authoring/historyPatch';
import { isDespawnEntityPatch, isSpawnEntityPatch } from '$lib/engine/authoring/historyPatch';
import type {
	DurableDefineTypePatch,
	DurablePatch,
	DurableRemoveComponentPatch,
	DurableSetComponentPatch,
	DurableSetEntityPatch,
	DurableSetEventsPatch
} from '$lib/engine/ontology/durablePatch';
import { isFieldPatch, patchKind } from '$lib/engine/ontology/durablePatch';
import { readShellModeFromUrl } from '$lib/engine/shellUrl';
import { world } from '$lib/engine/runtime/world.svelte';

const MAX_STEPS = 100;
const DEBOUNCE_MS = 400;

export type HistoryMeta = {
	label?: string;
	selection?: string | null;
};

export type HistoryStep = {
	id: string;
	label: string;
	undo: HistoryPatch[];
	redo: HistoryPatch[];
	selection?: string | null;
};

class EditHistoryStore {
	applying = $state(false);
	#undoStack = $state<HistoryStep[]>([]);
	#redoStack = $state<HistoryStep[]>([]);

	#transaction: {
		label: string;
		undoMap: Map<string, HistoryPatch>;
		redoMap: Map<string, HistoryPatch>;
	} | null = null;

	#debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	#pendingDebounce = new Map<
		string,
		{ undo: HistoryPatch[]; redo: HistoryPatch[]; meta?: HistoryMeta }
	>();

	get canUndo(): boolean {
		return this.#undoStack.length > 0 || this.#pendingDebounce.size > 0;
	}

	get canRedo(): boolean {
		return this.#redoStack.length > 0;
	}

	shouldRecord(): boolean {
		if (this.applying) return false;
		if (world.applyingRemoteDurable || world.applyingRemoteAuthoring) return false;
		if (typeof window === 'undefined') return true;
		const mode = readShellModeFromUrl();
		return (mode ?? 'edit') === 'edit';
	}

	hasOpenTransaction(): boolean {
		return this.#transaction !== null;
	}

	clear(): void {
		this.#undoStack = [];
		this.#redoStack = [];
		this.#transaction = null;
		for (const timer of this.#debounceTimers.values()) clearTimeout(timer);
		this.#debounceTimers.clear();
		this.#pendingDebounce.clear();
	}

	beginTransaction(label: string): void {
		if (this.#transaction) return;
		this.#flushAllDebounced();
		this.#transaction = { label, undoMap: new Map(), redoMap: new Map() };
	}

	commitTransaction(meta?: HistoryMeta): void {
		const txn = this.#transaction;
		if (!txn) return;
		this.#transaction = null;
		const undo = [...txn.undoMap.values()];
		const redo = [...txn.redoMap.values()];
		if (undo.length === 0) return;
		this.#pushStep({
			id: crypto.randomUUID(),
			label: meta?.label ?? txn.label,
			undo,
			redo,
			selection: meta?.selection ?? world.selection
		});
	}

	cancelTransaction(): void {
		this.#transaction = null;
	}

	recordStep(undo: HistoryPatch[], redo: HistoryPatch[], meta?: HistoryMeta): void {
		if (!this.shouldRecord()) return;
		this.#pushStep({
			id: crypto.randomUUID(),
			label: meta?.label ?? 'edit',
			undo,
			redo,
			selection: meta?.selection ?? world.selection
		});
	}

	recordMutation(undo: HistoryPatch[], redo: HistoryPatch[], meta?: HistoryMeta): void {
		if (!this.shouldRecord()) return;

		if (this.#transaction) {
			for (const patch of undo) this.#transaction.undoMap.set(this.#patchKey(patch), patch);
			for (const patch of redo) this.#transaction.redoMap.set(this.#patchKey(patch), patch);
			return;
		}

		if (undo.length === 1 && redo.length === 1 && this.#isSetFieldPatch(redo[0])) {
			const forward = redo[0] as DurablePatch;
			if (isFieldPatch(forward)) {
				const key = this.#fieldKey(forward.entityId, forward.component, forward.field);
				this.#scheduleDebounce(key, undo, redo, meta);
				return;
			}
		}

		this.recordStep(undo, redo, meta);
	}

	undo(): boolean {
		this.#flushAllDebounced();
		const step = this.#undoStack.at(-1);
		if (!step) return false;

		this.#undoStack = this.#undoStack.slice(0, -1);
		this.#applyStepPatches(step.undo, step.selection);
		this.#redoStack = [...this.#redoStack, step];
		return true;
	}

	redo(): boolean {
		const step = this.#redoStack.at(-1);
		if (!step) return false;

		this.#redoStack = this.#redoStack.slice(0, -1);
		this.#applyStepPatches(step.redo, step.selection);
		this.#undoStack = [...this.#undoStack, step];
		return true;
	}

	#applyStepPatches(patches: HistoryPatch[], selection?: string | null): void {
		this.applying = true;
		try {
			for (const patch of patches) world.applyHistoryPatch(patch);
			if (selection && world.getEntity(selection)) {
				world.select(selection);
			}
		} finally {
			this.applying = false;
		}
	}

	#pushStep(step: HistoryStep): void {
		this.#redoStack = [];
		this.#undoStack = [...this.#undoStack, step].slice(-MAX_STEPS);
	}

	#fieldKey(entityId: string, component: string, field: string): string {
		return `${entityId}:${component}:${field}`;
	}

	#patchKey(patch: HistoryPatch): string {
		if (isSpawnEntityPatch(patch)) return `spawn:${patch.entity.id}`;
		if (isDespawnEntityPatch(patch)) return `despawn:${patch.entityId}`;
		const durable = patch as DurablePatch;
		switch (patchKind(durable)) {
			case 'setEntity':
				return `entity:${(durable as DurableSetEntityPatch).entityId}`;
			case 'setComponent':
				return `comp+:${(durable as DurableSetComponentPatch).entityId}:${(durable as DurableSetComponentPatch).component}`;
			case 'removeComponent':
				return `comp-:${(durable as DurableRemoveComponentPatch).entityId}:${(durable as DurableRemoveComponentPatch).component}`;
			case 'defineType':
				return `type:${(durable as DurableDefineTypePatch).name}`;
			case 'setEvents':
				return `events:${(durable as DurableSetEventsPatch).entityId}`;
			default:
				if (isFieldPatch(durable)) {
					return this.#fieldKey(durable.entityId, durable.component, durable.field);
				}
				return crypto.randomUUID();
		}
	}

	#isSetFieldPatch(patch: HistoryPatch): boolean {
		if (isSpawnEntityPatch(patch) || isDespawnEntityPatch(patch)) return false;
		return patchKind(patch as DurablePatch) === 'setField';
	}

	#scheduleDebounce(
		key: string,
		undo: HistoryPatch[],
		redo: HistoryPatch[],
		meta?: HistoryMeta
	): void {
		const existing = this.#pendingDebounce.get(key);
		this.#pendingDebounce.set(key, {
			undo: existing?.undo ?? undo,
			redo,
			meta: meta ?? existing?.meta
		});

		const prev = this.#debounceTimers.get(key);
		if (prev) clearTimeout(prev);
		this.#debounceTimers.set(
			key,
			setTimeout(() => this.#flushDebounce(key), DEBOUNCE_MS)
		);
	}

	#flushDebounce(key: string): void {
		const pending = this.#pendingDebounce.get(key);
		if (!pending) return;
		this.#pendingDebounce.delete(key);
		this.#debounceTimers.delete(key);
		this.recordStep(pending.undo, pending.redo, pending.meta);
	}

	#flushAllDebounced(): void {
		for (const key of [...this.#pendingDebounce.keys()]) {
			const timer = this.#debounceTimers.get(key);
			if (timer) clearTimeout(timer);
			this.#flushDebounce(key);
		}
	}
}

export const editHistory = new EditHistoryStore();
