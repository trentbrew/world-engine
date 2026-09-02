/**
 * Reactive runtime world — the live entity store the renderer and UI read from.
 *
 * Entities are component bags (see ontology/schema). "Selectable" entities are
 * those with a visible, pickable view (Render / Ground / Marker); pure lights are
 * excluded. Systems and the net layer (M2+) mutate `entities` in place; Svelte's
 * runes propagate changes to the scene automatically.
 */
import type { ComponentData, Entity, EntityEvents, FieldSchema, WorldStatus } from '$lib/engine/ontology/schema';
import type { DurablePatch, DurableStore } from '$lib/engine/ontology/durableStore';
import {
	DurableOfflineError,
	HostOnlyDurableError
} from '$lib/engine/ontology/durableStore';
import type {
	DurableDefineTypePatch,
	DurableDefineComponentPatch,
	DurableRemoveComponentPatch,
	DurableRemoveEntityPatch,
	DurableSetComponentPatch,
	DurableSetEntityPatch,
	DurableSetEventsPatch
} from '$lib/engine/ontology/durablePatch';
import { isFieldPatch } from '$lib/engine/ontology/durablePatch';
import { durableBagOnly, durableComponentsOnly } from '$lib/engine/ontology/durableBag';
import {
	captureTypeFromEntity,
	canSaveAsType,
	validateTypeName
} from '$lib/engine/ontology/captureType';
import { recordDurableOp, notifyDurableOffline } from '$lib/engine/durable/session.svelte';
import { isDurableField } from '$lib/engine/ontology/syncPolicy';
import { coerceFieldValue, fieldTypeFor } from '$lib/engine/runtime/setField';
import {
	buildComponentsFromJson,
	entityToJsonString,
	parseEntityJsonPatch
} from '$lib/engine/runtime/entityJson';
import {
	canAuthorEntity,
	collaborativeAuthoringField
} from '$lib/engine/collab/editingPolicy';
import {
	canRemoveComponent,
	listAddableComponents
} from '$lib/engine/runtime/componentAccess';
import {
	canEditTypeDefaultField,
	canRemoveTypeComponent,
	isEditableObjectType,
	isEditableType,
	listAddableTypeComponents
} from '$lib/engine/runtime/typeAccess';
import { reapplyStoredLocalPlayerAvatar } from '$lib/engine/player/playerAvatarPrefs';
import { warmLocomotionPack } from '$lib/engine/player/playerLocomotionClips';
import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import {
	buildFieldSchema,
	validateComponentName,
	validateFieldName
} from '$lib/engine/runtime/schemaAccess';
import {
	getComponent,
	getType,
	isBuiltinComponent,
	isCollection,
	isEditableComponent,
	listComponents,
	listTypes,
	registerComponent,
	registerType,
	setComponentSchema
} from '$lib/engine/ontology/registry';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import { clearSplatMeshCache } from '$lib/engine/render/splatMeshCache';
import { splatReady } from '$lib/engine/render/splatReady.svelte';
import {
	isPeerTransformAuthoring,
	playerClientId,
	isPlayerEntity,
	isRemotePlayerEntity
} from '$lib/engine/player/access';
import { isGroundEntity } from '$lib/engine/render/access';
import {
	clampGroundTransformPosition,
	sanitizeGroundEntities,
	shouldClampGroundPosition
} from '$lib/engine/render/groundTransform';
import { resolveCharacterDefaults } from '$lib/engine/animation/characterMeshDefaults';
import type { MeshAnchor } from '$lib/engine/render/meshAnchor';
import { isPrimitiveMesh } from '$lib/engine/render/meshRef';
import { formulaSystem } from '$lib/engine/systems/formulaSystem';
import { scheduler } from '$lib/engine/systems/scheduler.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import {
	cloneEntityTemplate,
	entitiesForRoom,
	getRoomCatalog,
	normalizeRoomId,
	type RoomCatalog
} from '$lib/engine/ontology/roomCatalog';
import { reconcilePlayerSpawnPositions } from '$lib/engine/player/spawnPoints';
import { readShellModeFromUrl } from '$lib/engine/shellUrl';
import {
	buildRemoveComponentPatch,
	buildSetComponentPatch,
	buildSetEntityPatch,
	captureFieldValue
} from '$lib/engine/authoring/captureBefore';
import { editHistory } from '$lib/engine/authoring/editHistory.svelte';
import {
	captureEntitySnapshot,
	entityFromSnapshot
} from '$lib/engine/authoring/entitySnapshot';
import type { HistoryPatch } from '$lib/engine/authoring/historyPatch';
import {
	isDespawnEntityPatch,
	isSpawnEntityPatch
} from '$lib/engine/authoring/historyPatch';
import { queueWorldFilePatch, shouldAuthorToWorldFile } from '$lib/engine/authoring/worldFileAuthor';
import { applyDurableMutation } from '$lib/engine/runtime/applyMutation';
import {
	saveEntityTransform,
	saveLocalPlayerLayout,
	savePlayerLayout,
	type TransformLayoutSnapshot
} from '$lib/engine/dev/editorSession';
import {
	cloneEntity,
	getEntityClipboard,
	setEntityClipboard
} from '$lib/engine/runtime/entityClipboard.svelte';
import { nextPasteId } from '$lib/engine/runtime/entityIds';

function toastError(message: string, opts?: { id?: string }) {
	if (typeof window === 'undefined') {
		console.error(message);
		return;
	}
	void import('svelte-sonner').then(({ toast }) => toast.error(message, opts));
}

function bootstrapFormulas() {
	formulaSystem({ dt: 0, t: 0, tick: 0 });
}

function resetPlayRuntimeSystems() {
	if (typeof window === 'undefined') return;
	void import('$lib/engine/systems/eventSystem').then(({ resetEventState }) => resetEventState());
	void import('$lib/engine/systems/alarmRuntime').then(({ resetAlarmState }) => resetAlarmState());
	void import('$lib/engine/systems/collisionSystem').then(({ resetCollisionState }) =>
		resetCollisionState()
	);
	void import('$lib/engine/systems/inputEventSystem').then(({ resetInputEventState }) =>
		resetInputEventState()
	);
}

const PICKABLE_COMPONENTS = ['Render', 'Sprite', 'Ground', 'Marker'];

function transformSnapshotForField(
	field: string,
	value: unknown
): TransformLayoutSnapshot | null {
	if (field === 'position' && Array.isArray(value) && value.length >= 3) {
		return { position: [value[0] as number, value[1] as number, value[2] as number] };
	}
	if (field === 'rotation' && Array.isArray(value) && value.length >= 4) {
		return {
			rotation: [
				value[0] as number,
				value[1] as number,
				value[2] as number,
				value[3] as number
			]
		};
	}
	if (field === 'scale' && Array.isArray(value) && value.length >= 3) {
		return { scale: [value[0] as number, value[1] as number, value[2] as number] };
	}
	return null;
}

function propSlugFromMesh(mesh: string, label?: string): string {
	if (isPrimitiveMesh(mesh)) {
		return mesh.replace('primitive:', '') || 'shape';
	}
	const fromLabel = label?.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
	if (fromLabel) return fromLabel;
	const basename = mesh.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'model';
	return basename.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'model';
}

const TRANSFORM_DENIED_TOAST_ID = 'transform-denied';

class WorldRuntime {
	entities = $state<Entity[]>([]);
	/** Bumped when EntityType definitions change (Objects route editor). */
	typeRevision = $state(0);
	/** Bumped when ComponentSchema definitions change (Collections / schema editor). */
	componentRevision = $state(0);
	/** Bumped when an entity's component bag structure changes (JSON apply, add/remove component). */
	entityStructureRevision = $state(0);
	selection = $state<string | null>(null);
	hovered = $state<string | null>(null);
	status = $state<WorldStatus>('loading');
	error = $state<string | null>(null);
	statusMessage = $state('');

	/**
	 * Ownership predicate. Behavior systems only mutate entities the local client
	 * owns; everything else is driven by incoming network patches. The net session
	 * overrides this — single-player (no session) owns everything.
	 */
	isOwner: (entityId: string) => boolean = () => true;

	/** The local client's player entity id, set by the net session on connect. */
	localPlayerId = $state<string | null>(null);

	#durableStore: DurableStore | null = null;
	#worldId: string | null = null;
	/** Guard — skip durable write when applying remote Trellis patches. */
	applyingRemoteDurable = false;
	/** Guard — skip net echo when applying remote peer player Transform edits. */
	applyingRemoteAuthoring = false;
	#durableNet: {
		canWrite: () => boolean;
		broadcast: (patch: DurablePatch) => void;
		broadcastAuthoring: (patch: DurablePatch) => void;
	} | null = null;
	#selectionListeners = new Set<(entityId: string | null) => void>();
	/** Component bags captured at play enter — restored on exit so edit stays initial state. */
	#playSnapshot: Map<
		string,
		{ entity: Entity; components: Record<string, ComponentData> }
	> | null = null;
	#runtimeNet: {
		onSpawn?: (entity: Entity) => void;
		onDespawn?: (id: string) => void;
		onRuntimeDespawn?: (id: string) => void;
		onGotoRoom?: (
			roomId: string,
			meta?: { transition?: string; transitionMs?: number; transitionColor?: string }
		) => void;
	} | null = null;
	#runtimeSpawnIds = new Set<string>();
	/** Full edit-mode entity list when a multi-room catalog is active. */
	#editEntities: Entity[] | null = null;

	activeRoomId = $state<string | null>(null);
	/** Host-local stack of prior rooms for returnToPreviousRoom. */
	roomHistory = $state<string[]>([]);

	bindRuntimeNet(
		hooks: {
			onSpawn?: (entity: Entity) => void;
			onDespawn?: (id: string) => void;
			onRuntimeDespawn?: (id: string) => void;
			onGotoRoom?: (
				roomId: string,
				meta?: { transition?: string; transitionMs?: number; transitionColor?: string }
			) => void;
		} | null
	) {
		this.#runtimeNet = hooks;
	}

	hasRoomCatalog(): boolean {
		return getRoomCatalog() !== null;
	}

	bindRoomCatalog(catalog: RoomCatalog, allEntities: Entity[]) {
		this.#editEntities = allEntities.map(cloneEntityTemplate);
		this.activeRoomId = catalog.startRoomId;
	}

	clearRoomCatalog() {
		this.#editEntities = null;
		this.activeRoomId = null;
	}

	/** Play entry — show global + active room entities only. */
	filterToActiveRoom() {
		const catalog = getRoomCatalog();
		if (!catalog || !this.activeRoomId) return;

		const players = this.entities.filter((entity) => entity.id.startsWith('entity:player/'));
		this.entities = [...entitiesForRoom(this.activeRoomId, catalog), ...players];
		this.sanitizeSelection();
	}

	/** Edit exit — restore the full multi-room graph. */
	restoreEditRoomView() {
		if (!this.#editEntities) return;
		const players = this.entities.filter((entity) => entity.id.startsWith('entity:player/'));
		this.entities = [...this.#editEntities.map(cloneEntityTemplate), ...players];
		const catalog = getRoomCatalog();
		if (catalog) this.activeRoomId = catalog.startRoomId;
		this.sanitizeSelection();
	}

	switchRoom(
		roomId: string,
		opts?: {
			fromNetwork?: boolean;
			members?: string[];
			skipHistory?: boolean;
			viaPortalId?: string;
			transition?: string;
			transitionMs?: number;
			transitionColor?: string;
		}
	): boolean {
		if (!scheduler.running) return false;

		const catalog = getRoomCatalog();
		if (!catalog) return false;

		const normalized = normalizeRoomId(roomId);
		if (!catalog.rooms.has(normalized)) return false;

		const prev = this.activeRoomId;
		if (
			!opts?.fromNetwork &&
			!opts?.skipHistory &&
			prev &&
			prev !== normalized
		) {
			this.roomHistory = [...this.roomHistory, prev];
		}

		const players = this.entities.filter((entity) => entity.id.startsWith('entity:player/'));
		this.entities = [...entitiesForRoom(normalized, catalog), ...players];
		this.activeRoomId = normalized;

		resetPlayRuntimeSystems();
		bootstrapFormulas();
		if (opts?.members?.length) reconcilePlayerSpawnPositions(opts.members);
		this.snapshotPlayState();

		if (!opts?.fromNetwork) {
			this.#runtimeNet?.onGotoRoom?.(normalized, {
				transition: opts?.transition,
				transitionMs: opts?.transitionMs,
				transitionColor: opts?.transitionColor
			});
		}
		return true;
	}

	/** Pop room history and switch back (host / local). */
	returnToPreviousRoom(opts?: { members?: string[] }): boolean {
		if (this.roomHistory.length === 0) return false;
		const prev = this.roomHistory[this.roomHistory.length - 1]!;
		this.roomHistory = this.roomHistory.slice(0, -1);
		return this.switchRoom(prev, {
			members: opts?.members,
			skipHistory: true,
			transition: 'fade',
			transitionMs: 400
		});
	}

	bindDurable(store: DurableStore | null, worldId: string | null) {
		this.#durableStore = store;
		this.#worldId = worldId;
	}

	/** Host durable authoring over the net session (see session.svelte.ts). */
	bindDurableNet(
		hooks: {
			canWrite: () => boolean;
			broadcast: (patch: DurablePatch) => void;
			broadcastAuthoring: (patch: DurablePatch) => void;
		} | null
	) {
		this.#durableNet = hooks;
	}

	/** Runtime-spawned local player avatar (edit-mode layout / play). */
	get localPlayerEntity(): Entity | null {
		if (!this.localPlayerId) return null;
		return this.getEntity(this.localPlayerId) ?? null;
	}

	/** Remote peer player avatars — selectable for Transform authoring in edit mode. */
	get peerPlayerEntities(): Entity[] {
		return this.entities.filter((entity) => isRemotePlayerEntity(entity));
	}

	/** Entities the user can select in the inspector / viewport. */
	get selectableEntities(): Entity[] {
		return this.entities.filter(
			(entity) =>
				!isPlayerEntity(entity) &&
				PICKABLE_COMPONENTS.some((name) => name in entity.components)
		);
	}

	get selectedEntity(): Entity | null {
		if (!this.selection) return null;
		return this.entities.find((entity) => entity.id === this.selection) ?? null;
	}

	/** All entities carrying the given component — the basis for systems/queries. */
	query(componentName: string): Entity[] {
		return this.entities.filter((entity) => componentName in entity.components);
	}

	getEntity(id: string): Entity | undefined {
		return this.entities.find((entity) => entity.id === id);
	}

	/** Add an entity at runtime (players, spawned props). No-op if id exists. */
	spawn(entity: Entity) {
		if (!this.getEntity(entity.id)) {
			sanitizeGroundEntities([entity], worldProfile.profile.plane);
			this.entities = [...this.entities, entity];
		}
	}

	/** Spawn a Prop at runtime and replicate to peers when net hooks are bound. */
	createProp(opts: {
		mesh: string;
		anchor?: MeshAnchor;
		position: [number, number, number];
		label?: string;
	}): Entity | null {
		const ids = new Set(this.entities.map((entity) => entity.id));
		const slug = propSlugFromMesh(opts.mesh, opts.label);
		const id = nextPasteId(`entity:prop/${slug}`, ids);

		const render: ComponentData = {
			mesh: opts.mesh,
			color: '#d4d4d4'
		};
		if (opts.anchor) render.anchor = opts.anchor;

		const entity: Entity = {
			id,
			type: 'Prop',
			components: {
				Transform: { position: [...opts.position] },
				Render: render
			},
			raw: {}
		};

		this.spawn(entity);
		this.#runtimeNet?.onSpawn?.(entity);
		this.select(id);

		const snapshot = captureEntitySnapshot(entity);
		editHistory.recordMutation(
			[{ kind: 'despawnEntity', entityId: id }],
			[{ kind: 'spawnEntity', entity: snapshot }],
			{ label: 'spawn prop', selection: id }
		);
		return entity;
	}

	/** Place a rigged GLB as an animated Character (SkinnedMesh + Mesh3DAnimator). */
	createCharacter(opts: {
		mesh: string;
		anchor?: MeshAnchor;
		position: [number, number, number];
		label?: string;
	}): Entity | null {
		const ids = new Set(this.entities.map((entity) => entity.id));
		const slug = propSlugFromMesh(opts.mesh, opts.label);
		const id = nextPasteId(`entity:character/${slug}`, ids);

		const defs = resolveCharacterDefaults(opts.mesh);
		const entity: Entity = {
			id,
			type: defs.variant === 'female' ? 'CharacterFemale' : 'Character',
			components: {
				Transform: { position: [...opts.position] },
				SkinnedMesh: {
					mesh: opts.mesh,
					anchor: opts.anchor ?? 'bottom',
					rig: defs.rig,
					forwardYaw: defs.forwardYaw ?? 0
				},
				Mesh3DAnimator: {
					catalog: defs.catalog,
					clip: defs.clip,
					speed: 1,
					loop: true,
					rootMotion: false,
					playing: true
				}
			},
			raw: {}
		};

		this.spawn(entity);
		this.#runtimeNet?.onSpawn?.(entity);
		this.select(id);

		const snapshot = captureEntitySnapshot(entity);
		editHistory.recordMutation(
			[{ kind: 'despawnEntity', entityId: id }],
			[{ kind: 'spawnEntity', entity: snapshot }],
			{ label: 'spawn character', selection: id }
		);
		return entity;
	}

	/** Remove an entity at runtime. */
	despawn(id: string) {
		this.entities = this.entities.filter((entity) => entity.id !== id);
		this.#runtimeSpawnIds.delete(id);
		if (this.selection === id) this.selection = null;
	}

	/** Match-scoped runtime despawn (events/collectibles): local in solo,
	 * replicated while playing when a net session is bound. */
	despawnRuntime(id: string) {
		if (this.#runtimeNet?.onRuntimeDespawn) {
			this.#runtimeNet.onRuntimeDespawn(id);
			return;
		}
		this.despawn(id);
	}

	/** Runtime spawn from a system/event: add, replicate to peers, compile
	 * formulas — but do NOT select it (unlike editor spawns). */
	spawnRuntime(entity: Entity) {
		if (this.getEntity(entity.id)) return;
		this.spawn(entity);
		this.#runtimeSpawnIds.add(entity.id);
		this.#runtimeNet?.onSpawn?.(entity);
		bootstrapFormulas();
	}

	onSelectionChange(listener: (entityId: string | null) => void): () => void {
		this.#selectionListeners.add(listener);
		return () => this.#selectionListeners.delete(listener);
	}

	/** Whether the local client may transform this entity in edit mode (gizmo / position). */
	canTransformEntity(id: string): boolean {
		const entity = this.getEntity(id);
		if (!entity) return false;
		return canAuthorEntity(entity, (entityId) => this.isOwner(entityId));
	}

	#notifyTransformDenied() {
		toastError("You can't transform this entity — another peer owns it", {
			id: TRANSFORM_DENIED_TOAST_ID
		});
	}

	/** User-driven selection — blocks non-owned entities and optionally toasts. */
	trySelect(id: string | null, opts: { notify?: boolean } = {}): boolean {
		const notify = opts.notify !== false;
		if (id !== null && !this.canTransformEntity(id)) {
			if (notify) this.#notifyTransformDenied();
			return false;
		}
		this.select(id);
		return true;
	}

	select(id: string | null) {
		if (this.selection === id) return;
		this.selection = id;
		for (const listener of this.#selectionListeners) listener(id);
	}

	setHover(id: string | null) {
		if (id && !this.canTransformEntity(id)) {
			this.hovered = null;
			return;
		}
		this.hovered = id;
	}

	/** Whether the entity can be removed from the scene via the inspector. */
	canDeleteEntity(id: string): boolean {
		if (id === this.localPlayerId) return false;
		const entity = this.getEntity(id);
		if (!entity) return false;
		if (isGroundEntity(entity)) return false;
		if (isPlayerEntity(entity)) return false;
		return true;
	}

	copySelection(): boolean {
		const entity = this.selectedEntity;
		if (!entity) return false;
		setEntityClipboard(entity);
		return true;
	}

	pasteClipboard(): boolean {
		const source = getEntityClipboard();
		if (!source) return false;

		const ids = new Set(this.entities.map((entity) => entity.id));
		const pasted = cloneEntity(source);
		pasted.id = nextPasteId(source.id, ids);

		const transform = pasted.components.Transform as { position?: number[] } | undefined;
		if (transform?.position && Array.isArray(transform.position)) {
			transform.position = [
				(transform.position[0] ?? 0) + 1,
				transform.position[1] ?? 0,
				transform.position[2] ?? 0
			];
		}

		this.spawn(pasted);
		this.#runtimeNet?.onSpawn?.(pasted);
		this.select(pasted.id);

		const snapshot = captureEntitySnapshot(pasted);
		editHistory.recordMutation(
			[{ kind: 'despawnEntity', entityId: pasted.id }],
			[{ kind: 'spawnEntity', entity: snapshot }],
			{ label: 'paste', selection: pasted.id }
		);
		return true;
	}

	duplicateSelection(): boolean {
		if (!this.copySelection()) return false;
		return this.pasteClipboard();
	}

	cutSelection(): boolean {
		const id = this.selection;
		if (!id || !this.canDeleteEntity(id)) return false;
		if (!this.copySelection()) return false;
		return this.#deleteEntity(id);
	}

	deleteSelection(): boolean {
		const id = this.selection;
		if (!id || !this.canDeleteEntity(id)) return false;
		return this.#deleteEntity(id);
	}

	#deleteEntity(id: string): boolean {
		const entity = this.getEntity(id);
		if (!entity) return false;

		const snapshot = captureEntitySnapshot(entity);
		if (this.#runtimeNet?.onDespawn) this.#runtimeNet.onDespawn(id);
		else this.despawn(id);

		if (editHistory.shouldRecord()) {
			editHistory.recordMutation(
				[{ kind: 'spawnEntity', entity: snapshot }],
				[{ kind: 'despawnEntity', entityId: id }],
				{ label: 'delete', selection: id }
			);
		}
		return true;
	}

	/** Apply a history patch during undo/redo (no stack recording). */
	applyHistoryPatch(patch: HistoryPatch) {
		if (isSpawnEntityPatch(patch)) {
			this.spawn(entityFromSnapshot(patch.entity));
			bootstrapFormulas();
			return;
		}
		if (isDespawnEntityPatch(patch)) {
			this.despawn(patch.entityId);
			return;
		}
		applyDurableMutation(patch);
		const durable = patch as DurablePatch;
		if (isFieldPatch(durable)) {
			this.#syncAuthoringPatch(durable);
		} else {
			this.#broadcastDurablePatch(durable);
			this.#persistToStore(durable);
		}
	}

	#syncAuthoringPatch(patch: DurablePatch) {
		if (this.applyingRemoteDurable || this.applyingRemoteAuthoring) return;
		if (!isFieldPatch(patch)) return;
		const fieldPatch = patch;

		const entity = this.getEntity(fieldPatch.entityId);
		if (!entity) return;

		const isDurable = isDurableField(fieldPatch.component, fieldPatch.field, fieldPatch.value);
		const peerAuthoring =
			isPeerTransformAuthoring(entity, fieldPatch.component, fieldPatch.field) ||
			collaborativeAuthoringField(entity, fieldPatch.component, fieldPatch.field);

		if (isDurable) {
			this.#durableNet?.broadcast(fieldPatch);
		}
		if (peerAuthoring) {
			this.#durableNet?.broadcastAuthoring(fieldPatch);
		}
		if (isDurable && this.#durableStore && this.#worldId) {
			this.#persistToStore(fieldPatch);
		}
		this.#persistAuthoringEdit(entity, fieldPatch.component, fieldPatch.field, fieldPatch.value);
	}

	/** Inspector / authoring — mutates a component field and notifies subscribers. */
	setField(entityId: string, component: string, field: string, raw: unknown) {
		const entity = this.getEntity(entityId);
		if (!entity) return;
		const bag = entity.components[component];
		if (!bag) return;

		const type = fieldTypeFor(component, field);
		const value = coerceFieldValue(type, raw);
		const before = captureFieldValue(entity, component, field);
		const forwardPatch: DurablePatch = { entityId, component, field, value };
		const undoPatch: DurablePatch = { entityId, component, field, value: before };

		this.#setFieldCore(entityId, component, field, value);

		if (editHistory.shouldRecord()) {
			editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'set field' });
		}
	}

	/** Replace inline event handlers on an entity (durable graph edit). */
	setEvents(entityId: string, events: EntityEvents) {
		const entity = this.getEntity(entityId);
		if (!entity) return;

		const before = structuredClone(entity.events ?? {}) as EntityEvents;
		const next = structuredClone(events) as EntityEvents;
		const forwardPatch: DurableSetEventsPatch = { kind: 'setEvents', entityId, events: next };
		const undoPatch: DurableSetEventsPatch = { kind: 'setEvents', entityId, events: before };

		if (!events || Object.keys(events).length === 0) {
			delete entity.events;
			if (entity.raw) delete entity.raw.events;
		} else {
			entity.events = next;
			if (entity.raw) entity.raw.events = structuredClone(next);
		}
		this.entities = [...this.entities];

		if (!this.applyingRemoteDurable && !this.applyingRemoteAuthoring) {
			this.#durableNet?.broadcast(forwardPatch);
			this.#persistToStore(forwardPatch);
			if (shouldAuthorToWorldFile()) {
				queueWorldFilePatch(forwardPatch);
			}
		}

		if (editHistory.shouldRecord()) {
			editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'set events' });
		}
	}

	#setFieldCore(entityId: string, component: string, field: string, value: unknown) {
		const entity = this.getEntity(entityId);
		if (!entity) return;
		const bag = entity.components[component];
		if (!bag) return;

		const isDurable = isDurableField(component, field, value);
		const peerAuthoring =
			isPeerTransformAuthoring(entity, component, field) ||
			collaborativeAuthoringField(entity, component, field);
		const durableWrite =
			!this.applyingRemoteDurable &&
			!this.applyingRemoteAuthoring &&
			this.#durableStore &&
			this.#worldId &&
			isDurable;

		this.applyFieldLocal(entityId, component, field, value);

		const patch: DurablePatch = { entityId, component, field, value };

		if (!this.applyingRemoteDurable && !this.applyingRemoteAuthoring && isDurable) {
			this.#durableNet?.broadcast(patch);
		}

		if (!this.applyingRemoteAuthoring && peerAuthoring) {
			this.#durableNet?.broadcastAuthoring(patch);
		}

		if (durableWrite) {
			this.#persistToStore(patch);
		}

		this.#persistAuthoringEdit(entity, component, field, value);
	}

	#persistAuthoringEdit(
		entity: Entity,
		component: string,
		field: string,
		value: unknown
	): void {
		if (
			this.applyingRemoteDurable ||
			this.applyingRemoteAuthoring ||
			readShellModeFromUrl() === 'play' ||
			component !== 'Transform'
		) {
			return;
		}

		const transformPatch = transformSnapshotForField(field, value);
		if (!transformPatch) return;

		if (isPlayerEntity(entity)) {
			if (entity.id === this.localPlayerId) saveLocalPlayerLayout(transformPatch);
			const clientId = playerClientId(entity);
			if (clientId) savePlayerLayout(clientId, transformPatch);
			return;
		}

		saveEntityTransform(entity.id, transformPatch);
		if (shouldAuthorToWorldFile()) {
			queueWorldFilePatch({ entityId: entity.id, component, field, value });
		}
	}

	#broadcastDurablePatch(patch: DurablePatch) {
		if (!this.applyingRemoteDurable && !this.applyingRemoteAuthoring) {
			this.#durableNet?.broadcast(patch);
		}
	}

	#persistToStore(patch: DurablePatch) {
		if (this.applyingRemoteDurable || this.applyingRemoteAuthoring) return;
		if (!this.#durableStore || !this.#worldId) return;
		void this.#durableStore
			.updateField(this.#worldId, patch)
			.then(() => recordDurableOp(patch))
			.catch((error) => {
				if (error instanceof HostOnlyDurableError) return;
				if (error instanceof DurableOfflineError) {
					notifyDurableOffline();
					return;
				}
				console.error('[durable] update failed', error);
				toastError('Failed to save durable edit');
			});
	}

	/** Local RAM mutation only (no durable tier write). */
	applyFieldLocal(entityId: string, component: string, field: string, value: unknown) {
		const entity = this.getEntity(entityId);
		if (!entity) return;
		const bag = entity.components[component];
		if (!bag) return;

		const type = fieldTypeFor(component, field);
		if (type === 'vec3' && Array.isArray(value)) {
			let next: unknown[] = [...value];
			if (shouldClampGroundPosition(entity, component, field)) {
				next = clampGroundTransformPosition(worldProfile.profile.plane, [
					Number(next[0]) || 0,
					Number(next[1]) || 0,
					Number(next[2]) || 0
				]);
			}
			bag[field] = next as [number, number, number];
		} else if (type === 'vec2' && Array.isArray(value)) {
			bag[field] = [value[0], value[1]];
		} else {
			bag[field] = value;
		}

		if (
			(component === 'Render' || component === 'SkinnedMesh') &&
			(field === 'mesh' || field === 'anchor')
		) {
			renderBounds.clear(entityId);
			this.entities = [...this.entities];
		}
	}

	/** Components the inspector may attach to this entity. */
	addableComponents(entityId: string): string[] {
		const entity = this.getEntity(entityId);
		if (!entity) return [];
		return listAddableComponents(entity, listComponents());
	}

	/** Attach a registered component with schema defaults. */
	addComponent(entityId: string, componentName: string): boolean {
		const entity = this.getEntity(entityId);
		if (!entity || entity.components[componentName]) return false;
		const schema = getComponent(componentName);
		if (!schema) return false;
		if (!listAddableComponents(entity, [componentName]).includes(componentName)) return false;

		const forwardPatch: DurableSetComponentPatch = {
			kind: 'setComponent',
			entityId,
			component: componentName,
			bag: {}
		};
		const undoPatch = buildRemoveComponentPatch(entityId, componentName);

		if (!this.#addComponentCore(entityId, componentName)) return false;

		const added = this.getEntity(entityId);
		if (added) {
			forwardPatch.bag = durableBagOnly(
				componentName,
				added.components[componentName] ?? {}
			);
		}

		editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'add component' });
		return true;
	}

	#addComponentCore(entityId: string, componentName: string): boolean {
		const entity = this.getEntity(entityId);
		if (!entity || entity.components[componentName]) return false;
		const schema = getComponent(componentName);
		if (!schema) return false;

		const { bag, formulas } = createComponentBag(schema, {});
		entity.components[componentName] = bag;
		if (formulas) {
			entity.formulas ??= {};
			entity.formulas[componentName] = formulas;
		}

		bootstrapFormulas();
		this.entities = [...this.entities];
		this.#bumpEntityStructureRevision();

		const patch: DurableSetComponentPatch = {
			kind: 'setComponent',
			entityId,
			component: componentName,
			bag: durableBagOnly(componentName, bag)
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		return true;
	}

	/** Detach a component bag from an entity. */
	removeComponent(entityId: string, componentName: string): boolean {
		const entity = this.getEntity(entityId);
		if (!entity || !canRemoveComponent(entity, componentName)) return false;

		const undoPatch = buildSetComponentPatch(entity, componentName);
		const forwardPatch = buildRemoveComponentPatch(entityId, componentName);

		if (!this.#removeComponentCore(entityId, componentName)) return false;

		editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'remove component' });
		return true;
	}

	#removeComponentCore(entityId: string, componentName: string): boolean {
		const entity = this.getEntity(entityId);
		if (!entity || !canRemoveComponent(entity, componentName)) return false;

		delete entity.components[componentName];
		if (entity.formulas?.[componentName]) {
			delete entity.formulas[componentName];
			if (Object.keys(entity.formulas).length === 0) delete entity.formulas;
		}

		this.entities = [...this.entities];
		this.#bumpEntityStructureRevision();

		const patch: DurableRemoveComponentPatch = {
			kind: 'removeComponent',
			entityId,
			component: componentName
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		return true;
	}

	/** Replace entity component bags from a JSON-LD fragment (inspector JSON tab). */
	applyEntityJson(entityId: string, jsonText: string): { ok: true } | { ok: false; error: string } {
		const entity = this.getEntity(entityId);
		if (!entity) return { ok: false, error: 'Entity not found' };

		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			return { ok: false, error: 'Invalid JSON' };
		}

		const patchResult = parseEntityJsonPatch(entity, parsed);
		if (!patchResult.ok || !patchResult.patch) return patchResult;

		const built = buildComponentsFromJson(entityId, patchResult.patch.components);
		if (!built.ok || !built.components) return built;

		if (isPlayerEntity(entity) && !built.components.Player) {
			return { ok: false, error: 'Cannot remove Player component from a player entity' };
		}

		const undoPatch = buildSetEntityPatch(entity, { full: true });
		const forwardPatch: DurableSetEntityPatch = {
			kind: 'setEntity',
			entityId,
			...(patchResult.patch.conformsTo !== undefined
				? { conformsTo: patchResult.patch.conformsTo }
				: {}),
			components: durableComponentsOnly(built.components)
		};

		const result = this.#applyEntityJsonCore(
			entity,
			entityId,
			built.components,
			built.formulas,
			patchResult.patch.conformsTo
		);
		if (!result.ok) return result;

		editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'entity json' });
		return { ok: true };
	}

	#applyEntityJsonCore(
		entity: Entity,
		entityId: string,
		components: Record<string, ComponentData>,
		formulas: Entity['formulas'],
		conformsTo?: string
	): { ok: true } | { ok: false; error: string } {
		entity.components = components;
		entity.formulas = formulas;
		if (conformsTo !== undefined) {
			entity.type = conformsTo;
		}

		renderBounds.clear(entityId);
		bootstrapFormulas();
		this.entities = [...this.entities];
		this.#bumpEntityStructureRevision();

		const patch: DurableSetEntityPatch = {
			kind: 'setEntity',
			entityId,
			...(conformsTo !== undefined ? { conformsTo } : {}),
			components: durableComponentsOnly(components)
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		return { ok: true };
	}

	entityJsonString(entityId: string): string {
		const entity = this.getEntity(entityId);
		if (!entity) return '{}';
		return entityToJsonString(entity);
	}

	#persistTypeDefinition(typeName: string): void {
		const type = getType(typeName);
		if (!type) return;
		const patch: DurableDefineTypePatch = {
			kind: 'defineType',
			name: typeName,
			components: [...type.components],
			...(type.defaults && Object.keys(type.defaults).length > 0
				? { defaults: structuredClone(type.defaults) }
				: {}),
			...(type.events && Object.keys(type.events).length > 0
				? { events: structuredClone(type.events) }
				: {}),
			...(type.collection ? { collection: true } : {}),
			...(type.collectionMeta ? { collectionMeta: structuredClone(type.collectionMeta) } : {})
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		this.#bumpTypeRevision();
	}

	#persistComponentDefinition(componentName: string): void {
		const schema = getComponent(componentName);
		if (!schema) return;
		const patch: DurableDefineComponentPatch = {
			kind: 'defineComponent',
			name: componentName,
			fields: structuredClone(schema.fields)
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		this.#bumpComponentRevision();
	}

	#bumpTypeRevision() {
		this.typeRevision += 1;
	}

	#bumpComponentRevision() {
		this.componentRevision += 1;
	}

	#bumpEntityStructureRevision() {
		this.entityStructureRevision += 1;
	}

	notifyEntityStructureChanged() {
		this.#bumpEntityStructureRevision();
	}

	notifyTypeSchemaChanged() {
		this.#bumpTypeRevision();
		bootstrapFormulas();
		this.entities = [...this.entities];
	}

	notifyComponentSchemaChanged() {
		this.#bumpComponentRevision();
		bootstrapFormulas();
		this.entities = [...this.entities];
	}

	/** Create a world-authored object type (Objects route). */
	createObjectType(
		name: string,
		opts: { cloneFrom?: string } = {}
	): { ok: true } | { ok: false; error: string } {
		const trimmed = name.trim();
		const valid = validateTypeName(trimmed);
		if (!valid.ok) return valid;
		if (getType(trimmed)) return { ok: false, error: `Type "${trimmed}" already exists` };

		const template = opts.cloneFrom ? getType(opts.cloneFrom) : undefined;
		if (opts.cloneFrom && !template) {
			return { ok: false, error: `Unknown template "${opts.cloneFrom}"` };
		}

		const components = template ? [...template.components] : ['Transform', 'Render'];
		const defaults = template?.defaults ? structuredClone(template.defaults) : undefined;

		registerType({
			name: trimmed,
			components,
			...(defaults && Object.keys(defaults).length > 0 ? { defaults } : {})
		});
		this.entities = [...this.entities];
		this.#persistTypeDefinition(trimmed);
		return { ok: true };
	}

	addableTypeComponents(typeName: string): string[] {
		return listAddableTypeComponents(typeName);
	}

	addTypeComponent(typeName: string, componentName: string): boolean {
		if (!listAddableTypeComponents(typeName).includes(componentName)) return false;
		const type = getType(typeName);
		if (!type) return false;

		registerType({
			...type,
			components: [...type.components, componentName]
		});
		this.#persistTypeDefinition(typeName);
		this.entities = [...this.entities];
		return true;
	}

	removeTypeComponent(typeName: string, componentName: string): boolean {
		if (!canRemoveTypeComponent(typeName, componentName)) return false;
		const type = getType(typeName);
		if (!type) return false;

		const nextDefaults = type.defaults ? { ...type.defaults } : undefined;
		if (nextDefaults?.[componentName]) {
			delete nextDefaults[componentName];
		}

		registerType({
			...type,
			components: type.components.filter((name) => name !== componentName),
			defaults:
				nextDefaults && Object.keys(nextDefaults).length > 0 ? nextDefaults : undefined
		});
		this.#persistTypeDefinition(typeName);
		this.entities = [...this.entities];
		return true;
	}

	setTypeDefault(typeName: string, component: string, field: string, value: unknown): boolean {
		const type = getType(typeName);
		if (!type || !canEditTypeDefaultField(typeName, component, field)) return false;
		if (!type.components.includes(component)) return false;
		const schema = getComponent(component);
		if (!schema?.fields[field]) return false;

		const defaults = { ...(type.defaults ?? {}) };
		defaults[component] = { ...(defaults[component] ?? {}), [field]: value };
		registerType({ ...type, defaults });
		this.#persistTypeDefinition(typeName);
		if (typeName === 'Player') {
			this.#syncPlayerVisualDefault(component, field, value);
		}
		this.entities = [...this.entities];
		return true;
	}

	/**
	 * Apply a Player type visual default to live player entities (GM object sprite).
	 * Uses local bag replace so SkinnedMeshView remounts; does not durable-patch
	 * ephemeral `entity:player/*` ids — the type definition is the source of truth.
	 */
	#syncPlayerVisualDefault(component: string, field: string, value: unknown): void {
		for (const entity of this.entities) {
			if (!('Player' in entity.components)) continue;
			const bag = entity.components[component];
			if (!bag) continue;
			entity.components[component] = { ...bag, [field]: value };
			if (component === 'SkinnedMesh' && (field === 'mesh' || field === 'anchor')) {
				renderBounds.clear(entity.id);
			}
			if (component === 'Mesh3DAnimator' && (field === 'catalog' || field === 'locomotion')) {
				warmLocomotionPack(entity);
			}
		}
	}

	setTypeEvents(typeName: string, events: EntityEvents): boolean {
		const type = getType(typeName);
		if (!type || !isEditableObjectType(typeName)) return false;
		const nextEvents = Object.keys(events).length > 0 ? structuredClone(events) : undefined;
		registerType({ ...type, events: nextEvents });
		for (const entity of this.entities) {
			if (entity.type !== typeName) continue;
			if (entity.raw.events) continue;
			entity.events = nextEvents ? structuredClone(nextEvents) : undefined;
		}
		this.#persistTypeDefinition(typeName);
		this.entities = [...this.entities];
		return true;
	}

	typeDefaultValue(typeName: string, component: string, field: string): unknown {
		void this.typeRevision;
		const type = getType(typeName);
		const schema = getComponent(component);
		if (!type || !schema) return undefined;
		const bag = type.defaults?.[component];
		if (bag && field in bag) return bag[field];
		return schema.fields[field]?.default;
	}

	/** Promote entity composition to a world-scoped EntityType. */
	saveAsType(
		entityId: string,
		opts: { name: string; applyToEntity?: boolean }
	): { ok: true } | { ok: false; error: string } {
		const entity = this.getEntity(entityId);
		if (!entity) return { ok: false, error: 'Entity not found' };

		const eligible = canSaveAsType(entity);
		if (!eligible.ok) return { ok: false, error: eligible.reason };

		const name = opts.name.trim();
		const valid = validateTypeName(name);
		if (!valid.ok) return valid;

		const { components, defaults } = captureTypeFromEntity(entity);
		registerType({ name, components, defaults });

		const applyToEntity = opts.applyToEntity !== false;
		if (applyToEntity) entity.type = name;

		this.entities = [...this.entities];

		const patch: DurableDefineTypePatch = {
			kind: 'defineType',
			name,
			components,
			...(Object.keys(defaults).length > 0 ? { defaults } : {}),
			...(applyToEntity ? { applyToEntityId: entityId } : {})
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		this.#bumpTypeRevision();
		return { ok: true };
	}

	/**
	 * Spawn an entity from a registered type (built-in or world-authored).
	 * String suffix = exact id (AddEntityDialog compat). Opts without suffix
	 * allocate via nextPasteId. Optional position overrides Transform.
	 */
	spawnFromType(
		typeName: string,
		suffixOrOpts?: string | { position?: [number, number, number]; suffix?: string }
	): Entity | null {
		const type = getType(typeName);
		if (!type) return null;

		const opts =
			typeof suffixOrOpts === 'string'
				? { suffix: suffixOrOpts }
				: (suffixOrOpts ?? {});

		let id: string;
		if (opts.suffix !== undefined) {
			id = `entity:${typeName.toLowerCase()}/${opts.suffix}`;
			if (this.getEntity(id)) return null;
		} else {
			const ids = new Set(this.entities.map((entity) => entity.id));
			id = nextPasteId(`entity:${typeName.toLowerCase()}/1`, ids);
		}

		const components: Record<string, ComponentData> = {};
		const formulas: NonNullable<Entity['formulas']> = {};

		for (const compName of type.components) {
			const schema = getComponent(compName);
			if (!schema) continue;
			const raw = type.defaults?.[compName] ?? {};
			const { bag, formulas: compiled } = createComponentBag(schema, raw);
			components[compName] = bag;
			if (compiled) formulas[compName] = compiled;
		}

		if (opts.position && components.Transform) {
			components.Transform = {
				...components.Transform,
				position: [...opts.position]
			};
		} else if (opts.position) {
			components.Transform = { position: [...opts.position] };
		}

		const entity: Entity = {
			id,
			type: typeName,
			components,
			formulas: Object.keys(formulas).length > 0 ? formulas : undefined,
			events: type.events ? structuredClone(type.events) : undefined,
			raw: {}
		};

		this.spawn(entity);
		this.#runtimeNet?.onSpawn?.(entity);
		bootstrapFormulas();
		this.select(id);

		const snapshot = captureEntitySnapshot(entity);
		editHistory.recordMutation(
			[{ kind: 'despawnEntity', entityId: id }],
			[{ kind: 'spawnEntity', entity: snapshot }],
			{ label: 'spawn entity', selection: id }
		);
		return entity;
	}

	// ---- collections (game-global data records) ----------------------------

	/** Records (entities) conforming to a collection type. */
	recordsFor(collection: string): Entity[] {
		return this.entities.filter((entity) => entity.type === collection);
	}

	/** Define a Collection type — instances are game-global data records. */
	defineCollection(
		name: string,
		componentNames: string[],
		opts: { meta?: { icon?: string; plural?: string } } = {}
	): { ok: true } | { ok: false; error: string } {
		const trimmed = name.trim();
		const valid = validateTypeName(trimmed);
		if (!valid.ok) return valid;
		if (getType(trimmed)) return { ok: false, error: `Type "${trimmed}" already exists` };

		registerType({
			name: trimmed,
			components: componentNames,
			collection: true,
			collectionMeta: opts.meta
		});
		this.entities = [...this.entities];

		const patch: DurableDefineTypePatch = {
			kind: 'defineType',
			name: trimmed,
			components: componentNames,
			collection: true,
			...(opts.meta ? { collectionMeta: opts.meta } : {})
		};
		this.#broadcastDurablePatch(patch);
		this.#persistToStore(patch);
		this.#bumpTypeRevision();
		return { ok: true };
	}

	// ---- component schema (Collections / Objects field authoring) ------------

	editableComponentsForType(typeName: string): string[] {
		void this.componentRevision;
		const type = getType(typeName);
		if (!type) return [];
		return type.components.filter((name) => isEditableComponent(name));
	}

	/** Register a world-authored component schema (empty or with initial fields). */
	createComponent(
		name: string,
		fields: Record<string, FieldSchema> = {}
	): { ok: true } | { ok: false; error: string } {
		const valid = validateComponentName(name);
		if (!valid.ok) return valid;
		const trimmed = name.trim();
		if (getComponent(trimmed)) {
			return { ok: false, error: `Component "${trimmed}" already exists` };
		}

		registerComponent({ name: trimmed, fields: structuredClone(fields) });
		this.#persistComponentDefinition(trimmed);
		return { ok: true };
	}

	/** Add a field to a world-authored component schema. */
	addComponentField(
		componentName: string,
		fieldName: string,
		spec: FieldSchema
	): { ok: true } | { ok: false; error: string } {
		const valid = validateFieldName(fieldName);
		if (!valid.ok) return valid;
		const trimmedField = fieldName.trim();

		const schema = getComponent(componentName);
		if (!schema) return { ok: false, error: `Unknown component "${componentName}"` };
		if (isBuiltinComponent(componentName)) {
			return { ok: false, error: `Cannot edit built-in component "${componentName}"` };
		}
		if (schema.fields[trimmedField]) {
			return { ok: false, error: `Field "${trimmedField}" already exists` };
		}

		registerComponent({
			name: componentName,
			fields: { [trimmedField]: structuredClone(spec) }
		});
		this.#persistComponentDefinition(componentName);
		this.#bumpComponentRevision();
		this.entities = [...this.entities];
		return { ok: true };
	}

	/** Remove a field from a world-authored component schema. */
	removeComponentField(
		componentName: string,
		fieldName: string
	): { ok: true } | { ok: false; error: string } {
		const schema = getComponent(componentName);
		if (!schema) return { ok: false, error: `Unknown component "${componentName}"` };
		if (isBuiltinComponent(componentName)) {
			return { ok: false, error: `Cannot edit built-in component "${componentName}"` };
		}
		if (!schema.fields[fieldName]) return { ok: false, error: `Field "${fieldName}" not found` };
		if (Object.keys(schema.fields).length <= 1) {
			return { ok: false, error: 'A component must keep at least one field' };
		}

		const { [fieldName]: _drop, ...rest } = schema.fields;
		setComponentSchema(componentName, rest);
		this.#persistComponentDefinition(componentName);
		this.#bumpComponentRevision();
		this.entities = [...this.entities];
		return { ok: true };
	}

	/** Replace a field's schema (type / default / options) on a world-authored component. */
	editComponentField(
		componentName: string,
		fieldName: string,
		spec: FieldSchema
	): { ok: true } | { ok: false; error: string } {
		const schema = getComponent(componentName);
		if (!schema) return { ok: false, error: `Unknown component "${componentName}"` };
		if (isBuiltinComponent(componentName)) {
			return { ok: false, error: `Cannot edit built-in component "${componentName}"` };
		}
		if (!schema.fields[fieldName]) return { ok: false, error: `Field "${fieldName}" not found` };

		setComponentSchema(componentName, { ...schema.fields, [fieldName]: structuredClone(spec) });
		this.#persistComponentDefinition(componentName);
		this.#bumpComponentRevision();
		this.entities = [...this.entities];
		return { ok: true };
	}

	/** Rename a field on a world-authored component schema and migrate stored values. */
	renameComponentField(
		componentName: string,
		fieldName: string,
		newFieldName: string
	): { ok: true } | { ok: false; error: string } {
		const trimmed = newFieldName.trim();
		if (trimmed === fieldName) return { ok: true };

		const valid = validateFieldName(trimmed);
		if (!valid.ok) return valid;

		const schema = getComponent(componentName);
		if (!schema) return { ok: false, error: `Unknown component "${componentName}"` };
		if (isBuiltinComponent(componentName)) {
			return { ok: false, error: `Cannot edit built-in component "${componentName}"` };
		}
		if (!schema.fields[fieldName]) return { ok: false, error: `Field "${fieldName}" not found` };
		if (schema.fields[trimmed]) {
			return { ok: false, error: `Field "${trimmed}" already exists` };
		}

		const spec = structuredClone(schema.fields[fieldName]);
		const { [fieldName]: _drop, ...rest } = schema.fields;
		setComponentSchema(componentName, { ...rest, [trimmed]: spec });

		for (const typeName of listTypes()) {
			const type = getType(typeName);
			const bag = type?.defaults?.[componentName];
			if (!type || !bag || !(fieldName in bag)) continue;
			const nextBag = { ...bag, [trimmed]: bag[fieldName] };
			delete nextBag[fieldName];
			registerType({
				...type,
				defaults: { ...type.defaults, [componentName]: nextBag }
			});
			this.#persistTypeDefinition(typeName);
		}

		for (const entity of this.entities) {
			const bag = entity.components[componentName];
			if (!bag || !(fieldName in bag)) continue;
			bag[trimmed] = bag[fieldName];
			delete bag[fieldName];
		}

		this.#persistComponentDefinition(componentName);
		this.#bumpComponentRevision();
		this.entities = [...this.entities];
		return { ok: true };
	}

	/**
	 * Add a field to an editable type (object or collection) — creates a schema
	 * component (`<Type>Data`) when the type has no editable component yet.
	 */
	addTypeField(
		typeName: string,
		opts: {
			component?: string;
			newComponent?: string;
			field: string;
			spec: FieldSchema;
		}
	): { ok: true; component: string } | { ok: false; error: string } {
		if (!getType(typeName) || !isEditableType(typeName)) {
			return { ok: false, error: 'Not an editable type' };
		}

		let target = opts.component?.trim();
		if (!target && opts.newComponent?.trim()) {
			const compValid = validateComponentName(opts.newComponent);
			if (!compValid.ok) return compValid;
			const compName = opts.newComponent.trim();
			const created = this.createComponent(compName, {});
			if (!created.ok) return created;
			if (!this.addTypeComponent(typeName, compName)) {
				return { ok: false, error: `Could not attach ${compName} to ${typeName}` };
			}
			target = compName;
		}

		if (!target) {
			const editable = this.editableComponentsForType(typeName);
			if (editable.length === 1) target = editable[0];
			else if (editable.length === 0) {
				const suggested = `${typeName}Data`;
				const created = this.createComponent(suggested, {});
				if (!created.ok) return created;
				if (!this.addTypeComponent(typeName, suggested)) {
					return { ok: false, error: `Could not attach ${suggested} to ${typeName}` };
				}
				target = suggested;
			} else {
				return { ok: false, error: 'Choose which component to extend' };
			}
		}

		if (!getType(typeName)?.components.includes(target)) {
			return { ok: false, error: `Component "${target}" is not on this type` };
		}

		const added = this.addComponentField(target, opts.field, opts.spec);
		if (!added.ok) return added;
		return { ok: true, component: target };
	}

	/** Add a column field to a collection type (thin wrapper over addTypeField). */
	addCollectionField(
		collectionName: string,
		opts: {
			component?: string;
			newComponent?: string;
			field: string;
			spec: FieldSchema;
		}
	): { ok: true; component: string } | { ok: false; error: string } {
		if (!isCollection(collectionName)) return { ok: false, error: 'Not a collection type' };
		return this.addTypeField(collectionName, opts);
	}

	/** Create a game-global record conforming to a collection type. */
	createRecord(
		collection: string,
		overrides: Record<string, ComponentData> = {}
	): Entity | null {
		const type = getType(collection);
		if (!type || !isCollection(collection)) return null;

		const ids = new Set(this.entities.map((entity) => entity.id));
		const id = nextPasteId(`record:${collection.toLowerCase()}/item`, ids);

		const components: Record<string, ComponentData> = {};
		const formulas: NonNullable<Entity['formulas']> = {};
		for (const compName of type.components) {
			const schema = getComponent(compName);
			if (!schema) continue;
			const raw = { ...(type.defaults?.[compName] ?? {}), ...(overrides[compName] ?? {}) };
			const { bag, formulas: compiled } = createComponentBag(schema, raw);
			components[compName] = bag;
			if (compiled) formulas[compName] = compiled;
		}

		const entity: Entity = {
			id,
			type: collection,
			components,
			formulas: Object.keys(formulas).length > 0 ? formulas : undefined,
			raw: {}
		};

		// Records are non-spatial: add + persist, but never viewport-select.
		this.spawn(entity);
		bootstrapFormulas();

		const forwardPatch: DurableSetEntityPatch = {
			kind: 'setEntity',
			entityId: id,
			conformsTo: collection,
			components: durableComponentsOnly(components)
		};
		this.#broadcastDurablePatch(forwardPatch);
		this.#persistToStore(forwardPatch);

		// Durable undo/redo: setEntity (re)creates, removeEntity deletes.
		const undoPatch: DurableRemoveEntityPatch = { kind: 'removeEntity', entityId: id };
		editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'new record' });
		return entity;
	}

	/** Delete a game-global record and remove it from the durable graph. */
	deleteRecord(id: string): boolean {
		const entity = this.getEntity(id);
		if (!entity || !entity.type || !isCollection(entity.type)) return false;

		const undoPatch: DurableSetEntityPatch = {
			kind: 'setEntity',
			entityId: id,
			conformsTo: entity.type,
			components: durableComponentsOnly($state.snapshot(entity.components))
		};
		const forwardPatch: DurableRemoveEntityPatch = { kind: 'removeEntity', entityId: id };

		this.despawn(id);
		this.#broadcastDurablePatch(forwardPatch);
		this.#persistToStore(forwardPatch);

		editHistory.recordMutation([undoPatch], [forwardPatch], { label: 'delete record' });
		return true;
	}

	setReady(entities: Entity[], opts?: { skipAutoSelect?: boolean }) {
		editHistory.clear();
		// Drop prior-world SPZs so VRAM/memory don't accumulate across game switches.
		clearSplatMeshCache();
		splatReady.reset();
		sanitizeGroundEntities(entities, worldProfile.profile.plane);
		this.entities = entities;
		this.status = 'ready';
		this.error = null;
		const count = this.selectableEntities.length;
		this.statusMessage = `World loaded, ${count} ${count === 1 ? 'entity' : 'entities'}`;
		this.sanitizeSelection();
		if (!opts?.skipAutoSelect && count > 0 && !this.selection) {
			this.selection = this.selectableEntities[0].id;
		}
	}

	/** Freeze current entities + component data before play mutates them.
	 * Entity objects are held by reference (compiled formulas don't clone);
	 * only the component bags are snapshotted. */
	snapshotPlayState() {
		this.#runtimeSpawnIds.clear();
		this.#playSnapshot = new Map(
			this.entities.map((entity) => [
				entity.id,
				{ entity, components: $state.snapshot(entity.components) }
			])
		);
	}

	/** Revert runtime state to the play-entry snapshot (optionally keep it). */
	#restorePlaySnapshot(clearSnapshot: boolean) {
		const snap = this.#playSnapshot;
		if (!snap) return;

		const present = new Set(this.entities.map((entity) => entity.id));
		const resurrected: Entity[] = [];
		for (const [id, { entity, components }] of snap) {
			if (present.has(id) || id.startsWith('entity:player/')) continue;
			entity.components = structuredClone(components);
			resurrected.push(entity);
		}

		for (const entity of this.entities) {
			const saved = snap.get(entity.id);
			if (saved) entity.components = structuredClone(saved.components);
		}

		if (clearSnapshot) this.#playSnapshot = null;
		this.entities = [
			...this.entities.filter((entity) => snap.has(entity.id) || !this.#runtimeSpawnIds.has(entity.id)),
			...resurrected
		];
		this.#runtimeSpawnIds.clear();
	}

	/** Revert runtime state after play so edit mode reflects the pre-play
	 * snapshot — including resurrecting entities despawned during play
	 * (collected coins). Player avatars are exempt: peers may leave mid-play. */
	restorePlayState() {
		this.#restorePlaySnapshot(true);
	}

	/** Reset the live play session without leaving play mode. */
	resetToPlaySnapshot() {
		this.#restorePlaySnapshot(false);
		// Pause-menu avatar is per-entity + localStorage — restore after snapshot rewind.
		reapplyStoredLocalPlayerAvatar();
	}

	/**
	 * Fold current Player type SkinnedMesh / Mesh3DAnimator defaults into every
	 * live player entity (same contract as durable defineType on peers).
	 */
	#reapplyPlayerTypeVisualDefaults(): void {
		const type = getType('Player');
		const defaults = type?.defaults;
		if (!defaults) return;
		let changed = false;
		for (const entity of this.entities) {
			if (!('Player' in entity.components)) continue;
			for (const component of ['SkinnedMesh', 'Mesh3DAnimator'] as const) {
				const next = defaults[component];
				if (!next) continue;
				const bag = entity.components[component];
				if (!bag) continue;
				entity.components[component] = { ...bag, ...next };
				changed = true;
				if (component === 'SkinnedMesh' && ('mesh' in next || 'anchor' in next)) {
					renderBounds.clear(entity.id);
				}
				if (component === 'Mesh3DAnimator' && ('catalog' in next || 'locomotion' in next)) {
					warmLocomotionPack(entity);
				}
			}
		}
		if (changed) this.entities = [...this.entities];
	}

	/** Drop selection/hover when they point at a non-editable entity. */
	sanitizeSelection() {
		if (this.selection) {
			const selected = this.getEntity(this.selection);
			if (!selected || !this.canTransformEntity(this.selection)) {
				this.selection = null;
				for (const listener of this.#selectionListeners) listener(null);
			}
		}
		if (this.hovered) {
			const hovered = this.getEntity(this.hovered);
			if (!hovered || !this.canTransformEntity(this.hovered)) {
				this.hovered = null;
			}
		}
	}

	setError(message: string) {
		this.status = 'error';
		this.error = message;
		this.entities = [];
		this.selection = null;
		this.statusMessage = message;
	}
}

export const world = new WorldRuntime();

export { getEntityRigidBodyTranslation } from '$lib/engine/physics/entityRigidBodyProbe';
