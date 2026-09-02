/**
 * Apply agent-authored durable patches through the editor's write path.
 *
 * Both agent surfaces land here — the in-world bot (`AgentAction` of kind
 * `patch`) and anything else that produces `DurablePatch[]`. Patches are routed
 * to the dedicated `world.*` method wherever one exists, so the edit persists,
 * replicates to peers, *and* joins the undo stack. Kinds with no dedicated method
 * fall back to `world.applyHistoryPatch`, which still applies, broadcasts, and
 * persists — it just does not record an undo entry.
 *
 * Never call `applyDurableMutation` directly from here: that mutates local RAM
 * only, so peers never see the change.
 */
import { patchKind, type DurablePatch } from '$lib/engine/ontology/durablePatch';
import type { EntityEvents, FieldSchema } from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';

export type ApplyPatchesResult = {
	applied: number;
	/** One entry per patch that could not be applied, in input order. */
	errors: string[];
};

function setComponentFields(
	entityId: string,
	component: string,
	bag: Record<string, unknown>
): string | null {
	const entity = world.getEntity(entityId);
	if (!entity) return `setComponent: no entity "${entityId}"`;

	if (!entity.components[component] && !world.addComponent(entityId, component)) {
		return `setComponent: cannot add "${component}" to ${entityId}`;
	}
	for (const [field, value] of Object.entries(bag)) {
		world.setField(entityId, component, field, value);
	}
	return null;
}

/** Apply one patch. Returns an error string, or null on success. */
function applyOne(patch: DurablePatch): string | null {
	switch (patchKind(patch)) {
		case 'setField': {
			const { entityId, component, field, value } = patch as Extract<
				DurablePatch,
				{ entityId: string; component: string; field: string }
			>;
			const entity = world.getEntity(entityId);
			if (!entity) return `setField: no entity "${entityId}"`;
			if (!entity.components[component]) {
				return `setField: ${entityId} has no component "${component}"`;
			}
			world.setField(entityId, component, field, value);
			return null;
		}

		case 'setComponent': {
			const p = patch as Extract<DurablePatch, { kind: 'setComponent' }>;
			return setComponentFields(p.entityId, p.component, p.bag);
		}

		case 'removeComponent': {
			const p = patch as Extract<DurablePatch, { kind: 'removeComponent' }>;
			return world.removeComponent(p.entityId, p.component)
				? null
				: `removeComponent: cannot remove "${p.component}" from ${p.entityId}`;
		}

		case 'setEvents': {
			const p = patch as Extract<DurablePatch, { kind: 'setEvents' }>;
			if (!world.getEntity(p.entityId)) return `setEvents: no entity "${p.entityId}"`;
			world.setEvents(p.entityId, p.events as EntityEvents);
			return null;
		}

		case 'removeEntity': {
			const p = patch as Extract<DurablePatch, { kind: 'removeEntity' }>;
			if (!world.getEntity(p.entityId)) return `removeEntity: no entity "${p.entityId}"`;
			if (!world.canDeleteEntity(p.entityId)) return `removeEntity: ${p.entityId} is protected`;

			const previous = world.selection;
			world.select(p.entityId);
			const removed = world.deleteSelection();
			if (!removed) {
				world.select(previous);
				return `removeEntity: could not delete ${p.entityId}`;
			}
			return null;
		}

		case 'defineComponent': {
			const p = patch as Extract<DurablePatch, { kind: 'defineComponent' }>;
			const result = world.createComponent(p.name, p.fields as Record<string, FieldSchema>);
			return result.ok ? null : `defineComponent: ${result.error}`;
		}

		// `defineType` carries defaults, events, and collection metadata that
		// `world.createObjectType` does not accept, and `setEntity` has no
		// dedicated authoring method at all. Both go through the generic path so
		// nothing on the patch is silently dropped.
		case 'defineType':
		case 'setEntity': {
			world.applyHistoryPatch(patch);
			return null;
		}
	}
}

/** Apply a batch, continuing past failures so one bad patch cannot stall the rest. */
export function applyAgentPatches(patches: DurablePatch[]): ApplyPatchesResult {
	const errors: string[] = [];
	let applied = 0;

	for (const patch of patches) {
		try {
			const error = applyOne(patch);
			if (error) errors.push(error);
			else applied++;
		} catch (err) {
			errors.push(`${patchKind(patch)}: ${(err as Error).message}`);
		}
	}

	if (errors.length > 0) {
		console.warn(`[agent] ${errors.length}/${patches.length} patches failed`, errors);
	}
	return { applied, errors };
}

/**
 * Dev-only test seam. `import('/src/…')` from an e2e page resolves to a *different*
 * module instance than the running app holds (measured: the app's world reports 9
 * entities where a fresh import reports 0, and repeat imports can differ again).
 * Exposing the app's own bindings is the only reliable way for a browser test to
 * assert against the live world. Stripped from production builds.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
	Object.assign(window, { __applyAgentPatches: applyAgentPatches, __world: world });
}
