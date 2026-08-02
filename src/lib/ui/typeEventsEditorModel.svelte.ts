import { actionSummary } from '$lib/engine/events/actionSummary';
import { getComponent, getType, listObjectTypes } from '$lib/engine/ontology/registry';
import type {
	AlarmTrigger,
	EntityEvents,
	EventAction,
	EventTrigger,
	FieldSchema
} from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';
import { toast } from '$lib/ui/toast.svelte';
import { ui } from '$lib/ui/ui.svelte';

export const BEHAVIOR_TRIGGERS: { id: EventTrigger; label: string }[] = [
	{ id: 'create', label: 'Create' },
	{ id: 'step', label: 'Step' },
	{ id: 'destroy', label: 'Destroy' }
];

export type ActionKind = 'set' | 'spawn' | 'destroy' | 'score' | 'sfx';

export const ACTION_KINDS: { id: ActionKind; label: string }[] = [
	{ id: 'set', label: 'Set field' },
	{ id: 'spawn', label: 'Spawn' },
	{ id: 'destroy', label: 'Destroy' },
	{ id: 'score', label: 'Score' },
	{ id: 'sfx', label: 'Sound' }
];

export type FieldOption = {
	path: string;
	component: string;
	field: string;
	schema: FieldSchema;
};

export function createTypeEventsEditorModel(
	typeName: () => string,
	readonly: () => boolean
) {
	const type = $derived.by(() => {
		const name = typeName();
		const rev = ui.schemaRevision + world.typeRevision + world.componentRevision;
		return rev >= 0 ? getType(name) : undefined;
	});

	const events = $derived(type?.events ?? {});

	const eventEntries = $derived(
		BEHAVIOR_TRIGGERS.map((trigger) => ({
			...trigger,
			actions: events[trigger.id] ?? []
		})).filter((entry) => entry.actions.length > 0)
	);

	const alarmSlots = $derived(
		Array.from({ length: 12 }, (_, slot) => {
			const key = `alarm${slot}` as AlarmTrigger;
			const raw = events[key];
			const actions = Array.isArray(raw) ? (raw as EventAction[]) : [];
			return { slot, actions };
		}).filter((row) => row.actions.length > 0)
	);

	const hasAnimator = $derived(type?.components.includes('Mesh3DAnimator') ?? false);

	const animatorCatalog = $derived.by(() => {
		if (!hasAnimator || !type) return null;
		const defaults = type.defaults?.Mesh3DAnimator as { catalog?: string } | undefined;
		const schema = getComponent('Mesh3DAnimator');
		const fromSchema = schema?.fields.catalog?.default;
		const catalog =
			(typeof defaults?.catalog === 'string' && defaults.catalog) ||
			(typeof fromSchema === 'string' && fromSchema) ||
			'catalog:mesh2motion-human';
		return catalog;
	});

	const spawnTypeOptions = $derived.by(() => {
		const rev = ui.schemaRevision + world.typeRevision;
		return rev >= 0 ? listObjectTypes() : [];
	});

	const fieldOptions = $derived.by((): FieldOption[] => {
		const name = typeName();
		const rev = ui.schemaRevision + world.typeRevision + world.componentRevision;
		const t = rev >= 0 ? getType(name) : undefined;
		if (!t) return [];
		return t.components.flatMap((component) => {
			const schema = getComponent(component);
			if (!schema) return [];
			return Object.entries(schema.fields).map(([field, fieldSchema]) => ({
				path: `${component}.${field}`,
				component,
				field,
				schema: fieldSchema
			}));
		});
	});

	const clipAssignments = $derived.by(() => {
		const rows: string[] = [];
		for (const entry of eventEntries) {
			for (const action of entry.actions) {
				const summary = actionSummary(action as EventAction);
				if (summary.includes('Mesh3DAnimator.clip') || summary.includes('Mesh3DAnimator')) {
					rows.push(`${entry.label}: ${summary}`);
				}
			}
		}
		for (const row of alarmSlots) {
			for (const action of row.actions) {
				const summary = actionSummary(action);
				if (summary.includes('Mesh3DAnimator') || summary.includes('.clip')) {
					rows.push(`Alarm ${row.slot}: ${summary}`);
				}
			}
		}
		return rows;
	});

	let trigger = $state<EventTrigger>('create');
	let editing = $state<{ trigger: EventTrigger; index: number } | null>(null);
	let actionKind = $state<ActionKind>('set');
	let fieldPath = $state('');
	let rawValue = $state('');
	let spawnType = $state('Prop');
	let destroyTarget = $state('self');
	let scoreAmount = $state(10);
	let sfxId = $state('Bing');
	let newClip = $state('Idle_Loop');
	let newDelay = $state(2.5);

	const selectedField = $derived(fieldOptions.find((option) => option.path === fieldPath));

	function coerceValue(raw: string, schema: FieldSchema): unknown {
		if (schema.t === 'number') return Number(raw) || 0;
		if (schema.t === 'boolean') {
			const normalized = raw.trim().toLowerCase();
			return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
		}
		if (schema.t === 'json') {
			try {
				return JSON.parse(raw);
			} catch {
				return raw;
			}
		}
		return raw;
	}

	function setTypeEvents(next: EntityEvents): boolean {
		const name = typeName();
		const ok = world.setTypeEvents(name, next);
		if (ok) ui.bumpSchemaRevision();
		return ok;
	}

	function pushTriggerAction(action: EventAction) {
		if (readonly()) return false;
		const next: EntityEvents = structuredClone(events);
		const actions = [...(next[trigger] ?? [])];
		actions.push(action);
		next[trigger] = actions;
		if (!setTypeEvents(next)) {
			toast.error('Could not update type behavior');
			return false;
		}
		toast.success(`Added ${trigger} behavior`);
		return true;
	}

	/** Build an EventAction from the current form state, or null if invalid. */
	function buildActionFromForm(): EventAction | null {
		switch (actionKind) {
			case 'set': {
				const option = selectedField ?? fieldOptions[0];
				if (!option) {
					toast.error('Add a capability before authoring a set action');
					return null;
				}
				return { set: option.path, to: coerceValue(rawValue, option.schema) };
			}
			case 'spawn': {
				const typeToSpawn = spawnType.trim();
				if (!typeToSpawn) {
					toast.error('Choose a type to spawn');
					return null;
				}
				return { spawn: typeToSpawn };
			}
			case 'destroy':
				return { destroy: destroyTarget.trim() || 'self' };
			case 'score':
				return { score: Number(scoreAmount) || 0 };
			case 'sfx': {
				const sound = sfxId.trim();
				if (!sound) {
					toast.error('Enter a sound id or path');
					return null;
				}
				return { sfx: sound };
			}
		}
		return null;
	}

	function addBehaviorAction() {
		if (readonly()) return;
		const action = buildActionFromForm();
		if (!action) return;
		if (pushTriggerAction(action) && actionKind === 'set') {
			rawValue = '';
		}
	}

	/** Only the five simple action kinds round-trip through the inline form. */
	function isActionEditable(action: EventAction): boolean {
		return (
			'set' in action ||
			'spawn' in action ||
			'destroy' in action ||
			'score' in action ||
			'sfx' in action
		);
	}

	function loadActionIntoForm(action: EventAction) {
		if ('set' in action) {
			actionKind = 'set';
			fieldPath = action.set;
			rawValue =
				action.to != null && typeof action.to === 'object'
					? JSON.stringify(action.to)
					: String(action.to ?? '');
		} else if ('spawn' in action) {
			actionKind = 'spawn';
			spawnType = String(action.spawn);
		} else if ('destroy' in action) {
			actionKind = 'destroy';
			destroyTarget = String(action.destroy);
		} else if ('score' in action) {
			actionKind = 'score';
			scoreAmount = Number(action.score) || 0;
		} else if ('sfx' in action) {
			actionKind = 'sfx';
			sfxId = String(action.sfx);
		}
	}

	function resetActionForm() {
		actionKind = 'set';
		rawValue = '';
	}

	/** Open the inline editor for one existing action (loads it into the form). */
	function beginEditAction(triggerId: EventTrigger, index: number) {
		if (readonly()) return;
		const action = (events[triggerId] ?? [])[index];
		if (!action || !isActionEditable(action)) return;
		loadActionIntoForm(action);
		editing = { trigger: triggerId, index };
	}

	function cancelEditAction() {
		editing = null;
		resetActionForm();
	}

	function commitEditAction() {
		if (readonly() || !editing) return;
		const action = buildActionFromForm();
		if (!action) return;
		const { trigger: triggerId, index } = editing;
		const next: EntityEvents = structuredClone(events);
		const actions = [...(next[triggerId] ?? [])];
		if (index < 0 || index >= actions.length) {
			editing = null;
			return;
		}
		actions[index] = action;
		next[triggerId] = actions;
		if (!setTypeEvents(next)) {
			toast.error('Could not update type behavior');
			return;
		}
		toast.success('Updated behavior');
		editing = null;
		resetActionForm();
	}

	/** Swap an action with its neighbor (dir -1 = up, +1 = down). */
	function moveAction(triggerId: EventTrigger, index: number, dir: -1 | 1) {
		if (readonly()) return;
		const next: EntityEvents = structuredClone(events);
		const actions = [...(next[triggerId] ?? [])];
		const target = index + dir;
		if (target < 0 || target >= actions.length) return;
		[actions[index], actions[target]] = [actions[target], actions[index]];
		next[triggerId] = actions;
		if (!setTypeEvents(next)) {
			toast.error('Could not reorder type behavior');
			return;
		}
	}

	function addClipOnCreate() {
		if (readonly() || !hasAnimator) return;
		const next: EntityEvents = structuredClone(events);
		if (!next.alarm0) next.alarm0 = [];
		next.alarm0.push({ set: 'Mesh3DAnimator.clip', to: newClip });
		if (!next.create?.length) {
			next.create = [{ alarm: 0, in: newDelay }];
		}
		if (!setTypeEvents(next)) {
			toast.error('Could not update type clip schedule');
			return;
		}
		toast.success('Added clip step');
	}

	function removeAction(triggerId: EventTrigger, index: number) {
		if (readonly()) return;
		const next: EntityEvents = structuredClone(events);
		const actions = [...(next[triggerId] ?? [])];
		actions.splice(index, 1);
		if (actions.length > 0) next[triggerId] = actions;
		else delete next[triggerId];
		if (!setTypeEvents(next)) {
			toast.error('Could not remove type behavior');
			return;
		}
		toast.success('Removed behavior');
	}

	return {
		get type() {
			return type;
		},
		get events() {
			return events;
		},
		get eventEntries() {
			return eventEntries;
		},
		get alarmSlots() {
			return alarmSlots;
		},
		get hasAnimator() {
			return hasAnimator;
		},
		get animatorCatalog() {
			return animatorCatalog;
		},
		get spawnTypeOptions() {
			return spawnTypeOptions;
		},
		get fieldOptions() {
			return fieldOptions;
		},
		get clipAssignments() {
			return clipAssignments;
		},
		get trigger() {
			return trigger;
		},
		set trigger(v: EventTrigger) {
			trigger = v;
		},
		get actionKind() {
			return actionKind;
		},
		set actionKind(v: ActionKind) {
			actionKind = v;
		},
		get fieldPath() {
			return fieldPath;
		},
		set fieldPath(v: string) {
			fieldPath = v;
		},
		get rawValue() {
			return rawValue;
		},
		set rawValue(v: string) {
			rawValue = v;
		},
		get spawnType() {
			return spawnType;
		},
		set spawnType(v: string) {
			spawnType = v;
		},
		get destroyTarget() {
			return destroyTarget;
		},
		set destroyTarget(v: string) {
			destroyTarget = v;
		},
		get scoreAmount() {
			return scoreAmount;
		},
		set scoreAmount(v: number) {
			scoreAmount = v;
		},
		get sfxId() {
			return sfxId;
		},
		set sfxId(v: string) {
			sfxId = v;
		},
		get newClip() {
			return newClip;
		},
		set newClip(v: string) {
			newClip = v;
		},
		get newDelay() {
			return newDelay;
		},
		set newDelay(v: number) {
			newDelay = v;
		},
		get selectedField() {
			return selectedField;
		},
		get editing() {
			return editing;
		},
		isEditingAction(triggerId: EventTrigger, index: number) {
			return editing?.trigger === triggerId && editing.index === index;
		},
		isActionEditable,
		beginEditAction,
		cancelEditAction,
		commitEditAction,
		moveAction,
		addBehaviorAction,
		addClipOnCreate,
		removeAction,
		actionSummary
	};
}
