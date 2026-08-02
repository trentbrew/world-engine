export type DurableFieldPatch = {
	kind?: 'setField';
	entityId: string;
	component: string;
	field: string;
	value: unknown;
};

export type DurableSetComponentPatch = {
	kind: 'setComponent';
	entityId: string;
	component: string;
	bag: Record<string, unknown>;
};

export type DurableRemoveComponentPatch = {
	kind: 'removeComponent';
	entityId: string;
	component: string;
};

export type DurableSetEntityPatch = {
	kind: 'setEntity';
	entityId: string;
	conformsTo?: string;
	components: Record<string, Record<string, unknown>>;
};

export type DurableDefineTypePatch = {
	kind: 'defineType';
	name: string;
	components: string[];
	defaults?: Record<string, Record<string, unknown>>;
	events?: import('./schema').EntityEvents;
	applyToEntityId?: string;
	/** Marks the type as a Collection (instances are game-global records). */
	collection?: boolean;
	collectionMeta?: { icon?: string; plural?: string };
};

export type DurableDefineComponentPatch = {
	kind: 'defineComponent';
	name: string;
	fields: Record<string, import('./schema').FieldSchema>;
};

export type DurableSetEventsPatch = {
	kind: 'setEvents';
	entityId: string;
	events: Record<string, unknown>;
};

/** Remove an entity node from the graph entirely (record delete). */
export type DurableRemoveEntityPatch = {
	kind: 'removeEntity';
	entityId: string;
};

export type DurablePatch =
	| DurableFieldPatch
	| DurableSetComponentPatch
	| DurableRemoveComponentPatch
	| DurableSetEntityPatch
	| DurableDefineTypePatch
	| DurableDefineComponentPatch
	| DurableSetEventsPatch
	| DurableRemoveEntityPatch;

export type DurablePatchKind =
	| 'setField'
	| 'setComponent'
	| 'removeComponent'
	| 'setEntity'
	| 'defineType'
	| 'defineComponent'
	| 'setEvents'
	| 'removeEntity';

export function patchKind(patch: DurablePatch): DurablePatchKind {
	if ('kind' in patch && patch.kind) return patch.kind;
	return 'setField';
}

export function isFieldPatch(patch: DurablePatch): patch is DurableFieldPatch {
	return patchKind(patch) === 'setField';
}
