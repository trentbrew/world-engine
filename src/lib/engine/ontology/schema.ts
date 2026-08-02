/**
 * Ontology schema types — the vocabulary agents author games against.
 *
 * An entity is a bag of *components*; a component is a bag of typed *fields*.
 * Each field declares a sync policy that the network layer (M3+) will honour:
 *   - durable:  authored in the graph, lives in Trellis, rarely changes
 *   - realtime: synced over the wire at frame rate (PartyKit)
 *   - derived:  never synced; computed locally from a formula (M2)
 */

export type FieldType =
	| 'number'
	| 'string'
	| 'longtext'
	| 'select'
	| 'boolean'
	| 'vec2'
	| 'vec3'
	| 'quat'
	| 'color'
	| 'ref'
	| 'json';

export type SyncPolicy = 'durable' | 'realtime' | 'derived';

/** What a `ref` field points at — advisory; drives the picker + soft validation only. */
export type RefTarget =
	| { kind: 'record'; collection: string }
	| { kind: 'asset' }
	| { kind: 'entity' };

export interface FieldSchema {
	t: FieldType;
	/** Defaults to 'durable' when omitted. */
	sync?: SyncPolicy;
	/** Literal default, or a formula string beginning with '=' (evaluated in M2). */
	default?: unknown;
	optional?: boolean;
	/** For `t: 'ref'` — the referent kind. Refs stay plain strings on the wire. */
	of?: RefTarget;
	/** For `t: 'select'` — the allowed string options. */
	options?: string[];
}

export interface ComponentSchema {
	name: string;
	fields: Record<string, FieldSchema>;
}

/** Display metadata for a collection-typed EntityType (Collections panel). */
export interface CollectionMeta {
	icon?: string;
	plural?: string;
}

export interface EntityType {
	name: string;
	/** Component names every instance of this type carries. */
	components: string[];
	/** Per-component default field values, merged under instance data. */
	defaults?: Record<string, ComponentData>;
	/** GameMaker-style event handlers every instance inherits (see EntityEvents). */
	events?: EntityEvents;
	/** When true, this type is a Collection — instances are game-global data records. */
	collection?: boolean;
	/** Collection display metadata (icon, plural label). */
	collectionMeta?: CollectionMeta;
}

/** Coerced runtime values, keyed by field name. */
export type ComponentData = Record<string, unknown>;

// ---- events (GameMaker-style authoring surface, Phase 0) -------------------

/** Life-cycle triggers the event system dispatches (create/step/destroy). */
export type EventTrigger = 'create' | 'step' | 'destroy';

/** Timer triggers fired by alarmSystem when countdown reaches zero. */
export type AlarmTrigger =
	| 'alarm0'
	| 'alarm1'
	| 'alarm2'
	| 'alarm3'
	| 'alarm4'
	| 'alarm5'
	| 'alarm6'
	| 'alarm7'
	| 'alarm8'
	| 'alarm9'
	| 'alarm10'
	| 'alarm11';

/** Assign a component field ("Comp.field") or vector axis ("Comp.field.y").
 *  `to` is a literal, or a formula string beginning with '='. */
export interface SetAction {
	set: string;
	to: unknown;
}
/** Instance a new entity from a registered EntityType. */
export interface SpawnAction {
	spawn: string;
	/** Spawn position — a `[x,y,z]` literal or a formula (e.g. `=vec(...)`). */
	at?: unknown;
	/** Explicit id; auto-generated when omitted. */
	id?: string;
	/** Per-component field overrides applied over the type defaults. */
	with?: Record<string, ComponentData>;
}
/** Despawn an entity — "self" or an entity id. */
export interface DestroyAction {
	destroy: string;
}
/** Branch on a condition (a formula string or boolean literal). */
export interface IfAction {
	if: unknown;
	then: EventAction[];
	else?: EventAction[];
}
/** Arm or disarm a GameMaker-style alarm slot on self. */
export interface AlarmAction {
	alarm: number;
	in: unknown;
}
/** Add to local score (collision/pickup handlers). */
export interface ScoreAction {
	score: unknown;
}
/** Play a one-shot sound effect. */
export interface SfxAction {
	sfx: unknown;
}
/** Collision handler rule — run `do` when overlapping `with` type. */
export interface CollisionRule {
	with?: string;
	do: EventAction[];
}

export type CollisionHandlers = CollisionRule[];

/** Keyboard handler rule — run `do` on key press, release, or while held. */
export interface InputRule {
	/** Key name (lowercase), e.g. "e", "space", "arrowup". */
	key: string;
	do: EventAction[];
}

export type InputHandlers = InputRule[];

/** GameMaker `with(Type){ … }` — run nested actions on each matching instance. */
export interface WithAction {
	/** EntityType name to iterate (e.g. "Coin"). */
	with: string;
	do: EventAction[];
}

/** Switch to another room in a multi-room game file (play mode, host authority). */
export interface GotoRoomAction {
	goto_room: unknown;
}

/** Invoke a named script from the world-file script catalog. */
export interface ScriptAction {
	script: unknown;
}

/** A single authored action — a finite, safe unit of game logic. */
export type EventAction =
	| SetAction
	| SpawnAction
	| DestroyAction
	| IfAction
	| AlarmAction
	| ScoreAction
	| SfxAction
	| WithAction
	| GotoRoomAction
	| ScriptAction;

/** Ordered action lists keyed by trigger — events as data, not code. */
export type EntityEvents = Partial<
	Record<EventTrigger, EventAction[]> &
		Record<AlarmTrigger, EventAction[]> & {
			collision?: CollisionHandlers;
			keydown?: InputHandlers;
			keyup?: InputHandlers;
			keyheld?: InputHandlers;
		}
>;

/** Variables available to a formula at evaluation time. */
export type FormulaScope = Record<string, unknown>;

/** A parsed, runnable formula (produced by the formula layer). */
export interface CompiledFormula {
	src: string;
	deps: string[];
	eval: (scope: FormulaScope) => unknown;
}

/** Per-frame inputs handed to every system. */
export interface TickContext {
	dt: number;
	t: number;
	tick: number;
}

/** A live entity: an id plus its component bag. */
export interface Entity {
	id: string;
	/** The EntityType name this conforms to, if any. */
	type?: string;
	components: Record<string, ComponentData>;
	/** Compiled derived fields, by component name then field name. */
	formulas?: Record<string, Record<string, CompiledFormula>>;
	/** Event handlers (from the type, or inline), dispatched by the event system. */
	events?: EntityEvents;
	/** Child entity ids — the scene graph mirrors the entity graph. */
	children?: string[];
	/** Original JSON-LD node, for inspection/round-tripping. */
	raw: Record<string, unknown>;
}

export type WorldStatus = 'loading' | 'ready' | 'error';
