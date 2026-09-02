/**
 * WebMCP tool manifest — the agent-facing surface of the world engine.
 *
 * Definitions only: name, description, JSON Schema, and annotations. Execution is
 * wired separately (see `target` on each entry for the engine call it maps to).
 *
 * The surface is deliberately *flat and complete*: every action a human can take
 * in edit mode has exactly one tool, so an agent never has to discover a hidden
 * `op` vocabulary to reach part of the editor. See `docs/webmcp-tools.md`.
 *
 * Authored against Chrome's WebMCP guidance — see `docs/webmcp.md`. Budgets:
 * name <= 30 chars, description <= 500, param description <= 150, output <= 1.5K.
 * `pnpm webmcp:budget` verifies the first three; output shaping is the
 * executor's job (see `docs/webmcp-tools.md`).
 */
import type { FieldSchema } from '$lib/engine/ontology/schema';

export type JsonSchema = Record<string, unknown>;

/** A tool definition, minus `execute`. */
export type ToolManifestEntry = {
	name: string;
	title: string;
	description: string;
	inputSchema: JsonSchema;
	annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
	/** The engine call this tool wraps, for the executor to bind. */
	target: string;
};

const VEC3: JsonSchema = {
	type: 'array',
	items: { type: 'number' },
	minItems: 3,
	maxItems: 3
};

const PAGE_PARAMS: Record<string, JsonSchema> = {
	offset: { type: 'integer', minimum: 0, description: 'Index to start from. Defaults to 0.' },
	limit: {
		type: 'integer',
		minimum: 1,
		maximum: 100,
		description: 'How many to return. Defaults to 25.'
	}
};

const ENTITY_ID: JsonSchema = { type: 'string', description: 'The entity id, from list_entities.' };

/** The `spec` object accepted wherever a field schema is authored. */
const FIELD_SPEC: JsonSchema = {
	type: 'object',
	properties: {
		t: {
			type: 'string',
			enum: [
				'number',
				'string',
				'longtext',
				'boolean',
				'select',
				'vec2',
				'vec3',
				'quat',
				'color',
				'ref',
				'json'
			],
			description: 'Field type.'
		},
		default: { description: 'Default value, shaped to the type.' },
		options: {
			type: 'array',
			items: { type: 'string' },
			description: 'Allowed values, for t: "select" only.'
		},
		optional: { type: 'boolean', description: 'Whether instances may omit the field.' }
	},
	required: ['t']
};

const READ = { readOnlyHint: true, untrustedContentHint: true } as const;
const READ_TRUSTED = { readOnlyHint: true, untrustedContentHint: false } as const;
const WRITE = { readOnlyHint: false, untrustedContentHint: false } as const;

// ---- read: world -----------------------------------------------------------

const listEntities: ToolManifestEntry = {
	name: 'list_entities',
	title: 'List entities',
	description:
		'List the entities currently in the world. Returns each one’s id, type, and position. Narrow a large world by filtering on a component name (such as Render or Player) or on a type name. Results are paginated.',
	inputSchema: {
		type: 'object',
		properties: {
			component: {
				type: 'string',
				description: 'Only entities carrying this component, e.g. "Render".'
			},
			type: { type: 'string', description: 'Only entities of this type, e.g. "Prop".' },
			...PAGE_PARAMS
		}
	},
	annotations: READ,
	target: 'world.entities / world.query(component)'
};

const describeEntity: ToolManifestEntry = {
	name: 'describe_entity',
	title: 'Describe entity',
	description:
		'Return the full component bag for one entity: every component it carries, and the current value of each field. Call this before changing an entity, to see what is already there.',
	inputSchema: {
		type: 'object',
		properties: { entityId: ENTITY_ID },
		required: ['entityId']
	},
	annotations: READ,
	target: 'world.getEntity(id)'
};

const worldStatus: ToolManifestEntry = {
	name: 'world_status',
	title: 'World status',
	description:
		'Report the editor’s current state: the shell mode (edit, play, or publish), whether play is paused, the active room, the local player’s position, the selected entity, how many entities and types exist, and whether undo or redo is available. Call this first to orient yourself before making changes.',
	inputSchema: { type: 'object', properties: {} },
	annotations: READ_TRUSTED,
	target: 'world + ui + editHistory'
};

const getPlayer: ToolManifestEntry = {
	name: 'get_player',
	title: 'Get local player',
	description:
		'Return the human player’s current world position and entity id — the avatar controlled by the person at the keyboard. Call this before spawning or placing anything “next to me”, “in front of the player”, or at the visitor’s feet. Returns position as [x, y, z] with Y up.',
	inputSchema: { type: 'object', properties: {} },
	annotations: READ_TRUSTED,
	target: 'world.localPlayerEntity'
};

const listRooms: ToolManifestEntry = {
	name: 'list_rooms',
	title: 'List rooms',
	description:
		'List the rooms in this world. A room is a separate scene with its own entities; the world starts in one and moves between them at runtime. Returns each room’s id, title, and entity count, and marks the start room and the active one. Single-room worlds report no catalog.',
	inputSchema: { type: 'object', properties: {} },
	annotations: READ,
	target: 'roomCatalog.getRoomCatalog()'
};

const getScene: ToolManifestEntry = {
	name: 'get_scene',
	title: 'Get scene settings',
	description:
		'Return the scene’s presentation and post-processing settings: display name, background, shadows, grid, sky preset, art style, tone mapping, exposure, and the fog, bloom, vignette, grain, outline and sketch effect groups with all their knobs. Change any of them with set_scene_setting.',
	inputSchema: { type: 'object', properties: {} },
	annotations: READ_TRUSTED,
	target: 'ui.scene'
};

// ---- read: ontology --------------------------------------------------------

const listTypes: ToolManifestEntry = {
	name: 'list_types',
	title: 'List entity types',
	description:
		'List the entity types available in this world. A type is a reusable named bundle of components with default values, and is what new entities are spawned from. Returns each type name and the components it carries.',
	inputSchema: {
		type: 'object',
		properties: {
			kind: {
				type: 'string',
				enum: ['all', 'objects', 'collections'],
				description: 'Which types to list. Defaults to all.'
			}
		}
	},
	annotations: READ,
	target: 'registry.listTypes() + registry.getType(name)'
};

const describeType: ToolManifestEntry = {
	name: 'describe_type',
	title: 'Describe entity type',
	description:
		'Return everything about one entity type: the components it carries, the default value of every field, the event handlers its instances inherit, and how many instances exist. Call this before set_type_default or spawn_from_type.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' }
		},
		required: ['type']
	},
	annotations: READ,
	target: 'registry.getType(name)'
};

const listComponents: ToolManifestEntry = {
	name: 'list_components',
	title: 'List components',
	description:
		'List every component schema registered in this world, marking which are built into the engine and which were authored for this world. Only world-authored components can have their fields edited. Use describe_component for one component’s fields.',
	inputSchema: {
		type: 'object',
		properties: {
			kind: {
				type: 'string',
				enum: ['all', 'builtin', 'authored'],
				description: 'Which components to list. Defaults to all.'
			}
		}
	},
	annotations: READ,
	target: 'registry.listComponents()'
};

const describeComponent: ToolManifestEntry = {
	name: 'describe_component',
	title: 'Describe component',
	description:
		'Return the field schema for one component: each field name, its type (number, string, boolean, vec2, vec3, quat, color, select, ref, or json), and its default value. Call this to learn valid field names and value shapes before calling set_entity_field.',
	inputSchema: {
		type: 'object',
		properties: {
			component: { type: 'string', description: 'Component name, e.g. "Transform".' }
		},
		required: ['component']
	},
	annotations: READ_TRUSTED,
	target: 'registry.getComponent(name)'
};

const listAssets: ToolManifestEntry = {
	name: 'list_assets',
	title: 'List assets',
	description:
		'List everything placeable in this world: the built-in primitive shapes (box, sphere, capsule) plus the uploaded 3D models, textures, audio, and files. Returns each one’s name and mesh ref or url — the value a mesh field expects — so call this before spawn_prop or spawn_character. Paginated.',
	inputSchema: {
		type: 'object',
		properties: {
			kind: {
				type: 'string',
				enum: ['models', 'shapes', 'textures', 'audio', 'files'],
				description: 'Which kind to list. Defaults to models, which includes shapes.'
			},
			search: { type: 'string', description: 'Only assets whose name contains this text.' },
			...PAGE_PARAMS
		}
	},
	annotations: READ,
	target: 'assets/catalog.fetchAssets() + assets/shapes.SHAPE_CATALOG'
};

const listRecords: ToolManifestEntry = {
	name: 'list_records',
	title: 'List records',
	description:
		'List the records in a collection. A collection is a game-global data table (an inventory, a dialogue list) whose rows are non-spatial entities. Returns each record’s id and field values. Use list_types with kind "collections" to find collection names.',
	inputSchema: {
		type: 'object',
		properties: {
			collection: { type: 'string', description: 'Collection type name, e.g. "Item".' },
			...PAGE_PARAMS
		},
		required: ['collection']
	},
	annotations: READ,
	target: 'world.recordsFor(collection)'
};

// ---- write: spawn ----------------------------------------------------------

const spawnProp: ToolManifestEntry = {
	name: 'spawn_prop',
	title: 'Spawn a prop',
	description:
		'Place a static 3D model in the world at a position, as a Prop entity with Transform and Render components. Pass a mesh ref from list_assets — a primitive such as "primitive:box" or a model url. Returns the new entity id. The prop appears immediately for everyone in the room.',
	inputSchema: {
		type: 'object',
		properties: {
			mesh: {
				type: 'string',
				description: 'Mesh ref from list_assets, e.g. "primitive:box" or a model url.'
			},
			position: { ...VEC3, description: 'World position as [x, y, z]. Y is up.' },
			anchor: {
				type: 'string',
				enum: ['origin', 'bottom', 'center'],
				description: 'Which point of the model sits at the position. Defaults to bottom.'
			},
			color: { type: 'string', description: 'Hex tint for the mesh, e.g. "#ff0000".' },
			scale: { ...VEC3, description: 'Scale as [x, y, z]. Defaults to [1, 1, 1].' },
			label: { type: 'string', description: 'Human-readable name, used to build the entity id.' }
		},
		required: ['mesh', 'position']
	},
	annotations: WRITE,
	target: 'world.createProp(opts)'
};

const spawnCharacter: ToolManifestEntry = {
	name: 'spawn_character',
	title: 'Spawn a character',
	description:
		'Place a rigged, animated character in the world at a position, with its skeletal animation already playing. Pass the url of a rigged model asset from list_assets. Returns the new entity id. Use spawn_prop instead for scenery and static objects.',
	inputSchema: {
		type: 'object',
		properties: {
			mesh: { type: 'string', description: 'Rigged model asset url, from list_assets.' },
			position: { ...VEC3, description: 'World position as [x, y, z]. Y is up.' },
			anchor: {
				type: 'string',
				enum: ['origin', 'bottom', 'center'],
				description: 'Which point of the model sits at the position. Defaults to bottom.'
			},
			label: { type: 'string', description: 'Human-readable name, used to build the entity id.' }
		},
		required: ['mesh', 'position']
	},
	annotations: WRITE,
	target: 'world.createCharacter(opts)'
};

const spawnFromType: ToolManifestEntry = {
	name: 'spawn_from_type',
	title: 'Spawn from a type',
	description:
		'Create an entity from a registered type, inheriting that type’s components, default field values, and event handlers. This is how you place many of the same thing — define the type once, then spawn instances. Returns the new entity id. Use list_types to see what is available.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' },
			position: { ...VEC3, description: 'World position as [x, y, z]. Omit to use the default.' },
			suffix: { type: 'string', description: 'Exact id suffix. Omit to allocate the next free one.' }
		},
		required: ['type']
	},
	annotations: WRITE,
	target: 'world.spawnFromType(name, opts)'
};

const duplicateEntity: ToolManifestEntry = {
	name: 'duplicate_entity',
	title: 'Duplicate entity',
	description:
		'Copy an entity, with all of its components, field values, and event handlers, and place the copy one unit along X from the original. Returns the new entity id. Faster and more faithful than re-spawning and re-setting every field.',
	inputSchema: {
		type: 'object',
		properties: { entityId: ENTITY_ID },
		required: ['entityId']
	},
	annotations: WRITE,
	target: 'world.copySelection() + world.pasteClipboard()'
};

const removeEntity: ToolManifestEntry = {
	name: 'remove_entity',
	title: 'Remove entity',
	description:
		'Delete an entity from the world permanently. Find the id with list_entities first. This is reversible with the undo tool, or from the editor.',
	inputSchema: {
		type: 'object',
		properties: { entityId: ENTITY_ID },
		required: ['entityId']
	},
	annotations: WRITE,
	target: 'world.deleteSelection()'
};

// ---- write: entity ---------------------------------------------------------

const setEntityField: ToolManifestEntry = {
	name: 'set_entity_field',
	title: 'Set a field',
	description:
		'Change one field on one component of one entity — its position, color, mesh, speed, and so on. Use describe_entity to see current values and describe_component to see valid field names and value shapes. The change is saved and replicated to everyone in the room. A value may also be a formula string beginning with "=", such as "=vec(cos(t), 1, sin(t))", which recomputes every frame.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: ENTITY_ID,
			component: { type: 'string', description: 'Component holding the field, e.g. "Transform".' },
			field: { type: 'string', description: 'Field name on that component, e.g. "position".' },
			value: {
				description:
					'The new value, shaped to the field type: a number, string, boolean, hex color, or [x, y, z] array.'
			}
		},
		required: ['entityId', 'component', 'field', 'value']
	},
	annotations: WRITE,
	target: 'world.setField(entityId, component, field, value)'
};

const addEntityComponent: ToolManifestEntry = {
	name: 'add_entity_component',
	title: 'Add component to entity',
	description:
		'Give one entity a component it does not already carry, with that component’s default field values. This affects only this entity — use add_type_component to give the component to every instance of a type instead. Returns the fields the entity gained.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: ENTITY_ID,
			component: { type: 'string', description: 'Component to add, e.g. "Gravity".' }
		},
		required: ['entityId', 'component']
	},
	annotations: WRITE,
	target: 'world.addComponent(entityId, componentName)'
};

const removeEntityComponent: ToolManifestEntry = {
	name: 'remove_entity_component',
	title: 'Remove component',
	description:
		'Take a component off one entity, discarding the field values it held. Components the entity needs to exist, such as Transform, cannot be removed. This affects only this entity, not its type.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: ENTITY_ID,
			component: { type: 'string', description: 'Component to remove, e.g. "Gravity".' }
		},
		required: ['entityId', 'component']
	},
	annotations: WRITE,
	target: 'world.removeComponent(entityId, componentName)'
};

const setEntityJson: ToolManifestEntry = {
	name: 'set_entity_json',
	title: 'Replace entity data',
	description:
		'Replace an entity’s whole component bag at once. Use this to make many related edits atomically; use set_entity_field for a single change. Pass either a bare object keyed by component name, or the document get_entity_json returns, which also carries conformsTo. Components you leave out are dropped, so read the current shape first.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: ENTITY_ID,
			data: {
				type: 'object',
				description: 'Components keyed by name, or a {components, conformsTo} document.'
			}
		},
		required: ['entityId', 'data']
	},
	annotations: WRITE,
	target: 'world.applyEntityJson(entityId, jsonText)'
};

const getEntityJson: ToolManifestEntry = {
	name: 'get_entity_json',
	title: 'Get entity data',
	description:
		'Return one entity as the exact JSON object that set_entity_json accepts. Read it, change the parts you want, and write it back. Prefer describe_entity when you only want to look.',
	inputSchema: {
		type: 'object',
		properties: { entityId: ENTITY_ID },
		required: ['entityId']
	},
	annotations: READ,
	target: 'world.entityJsonString(entityId)'
};

const setEntityEvents: ToolManifestEntry = {
	name: 'set_entity_events',
	title: 'Set entity behaviour',
	description:
		'Give an entity behaviour, authored as data rather than code: ordered actions that run on a trigger. Triggers are create, step, destroy, alarm0 through alarm11, collision, keydown, keyup, and keyheld. Actions are {set,to} to assign a field, {spawn,at} to instance a type, {destroy}, {if,then,else}, {alarm,in}, {score}, {sfx}, {with,do} to run actions on every instance of a type, {goto_room}, and {script}. Replaces all handlers on the entity.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: ENTITY_ID,
			events: {
				type: 'object',
				description: 'Handlers keyed by trigger, each an ordered array of actions.'
			}
		},
		required: ['entityId', 'events']
	},
	annotations: WRITE,
	target: 'world.setEvents(entityId, events)'
};

const saveEntityAsType: ToolManifestEntry = {
	name: 'save_entity_as_type',
	title: 'Save entity as type',
	description:
		'Promote one entity’s composition into a reusable named type: its components and current field values become that type’s defaults, so spawn_from_type reproduces it. Build one instance the way you want it, then save it as a type rather than defining the type field by field.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: ENTITY_ID,
			name: { type: 'string', description: 'Name for the new type, e.g. "Lantern".' },
			applyToEntity: {
				type: 'boolean',
				description: 'Also retype this entity to the new type. Defaults to true.'
			}
		},
		required: ['entityId', 'name']
	},
	annotations: WRITE,
	target: 'world.saveAsType(entityId, opts)'
};

// ---- write: types ----------------------------------------------------------

const defineType: ToolManifestEntry = {
	name: 'define_type',
	title: 'Define entity type',
	description:
		'Create a new entity type — a reusable named bundle of components that entities can then be spawned from. A new type starts with Transform and Render, or copies the components and defaults of an existing type when cloneFrom is given. Add further components with add_type_component.',
	inputSchema: {
		type: 'object',
		properties: {
			name: { type: 'string', description: 'Name for the new type, e.g. "Lantern".' },
			cloneFrom: { type: 'string', description: 'Existing type to copy components from.' }
		},
		required: ['name']
	},
	annotations: WRITE,
	target: 'world.createObjectType(name, { cloneFrom })'
};

const addTypeComponent: ToolManifestEntry = {
	name: 'add_type_component',
	title: 'Add component to type',
	description:
		'Add a component to an entity type, so every instance of that type gains its fields. Use describe_type to see what a type already carries, and describe_component to see what a component provides.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' },
			component: { type: 'string', description: 'Component to add, e.g. "Gravity".' }
		},
		required: ['type', 'component']
	},
	annotations: WRITE,
	target: 'world.addTypeComponent(typeName, componentName)'
};

const removeTypeComponent: ToolManifestEntry = {
	name: 'remove_type_component',
	title: 'Remove component from type',
	description:
		'Take a component off an entity type, along with the defaults it held. Components a type needs to exist cannot be removed, and neither can anything on a built-in type.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' },
			component: { type: 'string', description: 'Component to remove.' }
		},
		required: ['type', 'component']
	},
	annotations: WRITE,
	target: 'world.removeTypeComponent(typeName, componentName)'
};

const setTypeDefault: ToolManifestEntry = {
	name: 'set_type_default',
	title: 'Set a type default',
	description:
		'Change the default value of one field on an entity type, so future instances spawn with it. Existing instances keep whatever value they already carry. Use describe_type to see current defaults, and set_entity_field to change one instance instead.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' },
			component: { type: 'string', description: 'Component holding the field, e.g. "Render".' },
			field: { type: 'string', description: 'Field name on that component, e.g. "color".' },
			value: { description: 'The new default, shaped to the field type.' }
		},
		required: ['type', 'component', 'field', 'value']
	},
	annotations: WRITE,
	target: 'world.setTypeDefault(typeName, component, field, value)'
};

const setTypeEvents: ToolManifestEntry = {
	name: 'set_type_events',
	title: 'Set type behaviour',
	description:
		'Give every instance of a type the same behaviour, using the trigger and action vocabulary described on set_entity_events. Instances with their own inline handlers keep them; the rest inherit these. Replaces all handlers on the type.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' },
			events: {
				type: 'object',
				description: 'Handlers keyed by trigger, each an ordered array of actions.'
			}
		},
		required: ['type', 'events']
	},
	annotations: WRITE,
	target: 'world.setTypeEvents(typeName, events)'
};

const addTypeField: ToolManifestEntry = {
	name: 'add_type_field',
	title: 'Add field to type',
	description:
		'Add a new custom field to an entity type — health, damage, a label. The field lands on one of the type’s world-authored components, or on a new one created for it when the type has none. Pass the field name and a spec giving its type and default.',
	inputSchema: {
		type: 'object',
		properties: {
			type: { type: 'string', description: 'Type name, from list_types.' },
			field: { type: 'string', description: 'New field name, e.g. "health".' },
			spec: { ...FIELD_SPEC, description: 'Field type and default, e.g. {"t":"number","default":100}.' },
			component: { type: 'string', description: 'Which component to extend. Omit to pick one.' },
			newComponent: { type: 'string', description: 'Create this component and extend it instead.' }
		},
		required: ['type', 'field', 'spec']
	},
	annotations: WRITE,
	target: 'world.addTypeField(typeName, opts)'
};

// ---- write: component schemas ----------------------------------------------

const defineComponent: ToolManifestEntry = {
	name: 'define_component',
	title: 'Define component',
	description:
		'Create a new component schema for this world — a named group of fields that types and entities can then carry. Pass fields as an object keyed by field name, each a spec giving its type and default. Add more later with add_component_field.',
	inputSchema: {
		type: 'object',
		properties: {
			name: { type: 'string', description: 'Name for the new component, e.g. "Health".' },
			fields: {
				type: 'object',
				additionalProperties: FIELD_SPEC,
				description: 'Field specs keyed by field name, e.g. {"hp":{"t":"number","default":100}}.'
			}
		},
		required: ['name']
	},
	annotations: WRITE,
	target: 'world.createComponent(name, fields)'
};

const addComponentField: ToolManifestEntry = {
	name: 'add_component_field',
	title: 'Add field to component',
	description:
		'Add a field to a world-authored component schema. Every type and entity carrying that component gains the field with its default value. Built-in engine components cannot be changed — check with list_components.',
	inputSchema: {
		type: 'object',
		properties: {
			component: { type: 'string', description: 'World-authored component name.' },
			field: { type: 'string', description: 'New field name, e.g. "hp".' },
			spec: { ...FIELD_SPEC, description: 'Field type and default, e.g. {"t":"number","default":100}.' }
		},
		required: ['component', 'field', 'spec']
	},
	annotations: WRITE,
	target: 'world.addComponentField(componentName, fieldName, spec)'
};

const editComponentField: ToolManifestEntry = {
	name: 'edit_component_field',
	title: 'Edit a field schema',
	description:
		'Replace a field’s schema on a world-authored component — its type, default value, or select options. Existing values are not migrated, so changing the type can leave stale data behind. Use rename_component_field to change only the name.',
	inputSchema: {
		type: 'object',
		properties: {
			component: { type: 'string', description: 'World-authored component name.' },
			field: { type: 'string', description: 'Existing field name.' },
			spec: { ...FIELD_SPEC, description: 'The replacement schema for the field.' }
		},
		required: ['component', 'field', 'spec']
	},
	annotations: WRITE,
	target: 'world.editComponentField(componentName, fieldName, spec)'
};

const renameComponentField: ToolManifestEntry = {
	name: 'rename_component_field',
	title: 'Rename a field',
	description:
		'Rename a field on a world-authored component, migrating the stored values on every type default and every live entity that carries it. This is the safe way to rename — editing the schema directly would orphan the data.',
	inputSchema: {
		type: 'object',
		properties: {
			component: { type: 'string', description: 'World-authored component name.' },
			field: { type: 'string', description: 'Existing field name.' },
			newField: { type: 'string', description: 'New field name.' }
		},
		required: ['component', 'field', 'newField']
	},
	annotations: WRITE,
	target: 'world.renameComponentField(componentName, fieldName, newFieldName)'
};

const removeComponentField: ToolManifestEntry = {
	name: 'remove_component_field',
	title: 'Remove a field',
	description:
		'Remove a field from a world-authored component schema, discarding its values everywhere. A component must keep at least one field, and built-in engine components cannot be changed.',
	inputSchema: {
		type: 'object',
		properties: {
			component: { type: 'string', description: 'World-authored component name.' },
			field: { type: 'string', description: 'Field to remove.' }
		},
		required: ['component', 'field']
	},
	annotations: WRITE,
	target: 'world.removeComponentField(componentName, fieldName)'
};

// ---- write: collections ----------------------------------------------------

const defineCollection: ToolManifestEntry = {
	name: 'define_collection',
	title: 'Define collection',
	description:
		'Create a collection — a game-global data table whose rows are non-spatial entities, for inventories, dialogue, quests, and the like. Give it the components its rows carry, or none and add columns with add_collection_field. Rows are created with create_record.',
	inputSchema: {
		type: 'object',
		properties: {
			name: { type: 'string', description: 'Name for the collection, e.g. "Item".' },
			components: {
				type: 'array',
				items: { type: 'string' },
				description: 'Components every row carries. Defaults to none.'
			},
			plural: { type: 'string', description: 'Plural label for the editor, e.g. "Items".' },
			icon: { type: 'string', description: 'Icon name shown beside the collection.' }
		},
		required: ['name']
	},
	annotations: WRITE,
	target: 'world.defineCollection(name, components, opts)'
};

const addCollectionField: ToolManifestEntry = {
	name: 'add_collection_field',
	title: 'Add collection column',
	description:
		'Add a column to a collection — a field every row carries. The column lands on one of the collection’s world-authored components, or on a new one created for it. Pass the field name and a spec giving its type and default.',
	inputSchema: {
		type: 'object',
		properties: {
			collection: { type: 'string', description: 'Collection type name, e.g. "Item".' },
			field: { type: 'string', description: 'New column name, e.g. "price".' },
			spec: { ...FIELD_SPEC, description: 'Field type and default, e.g. {"t":"number","default":0}.' },
			component: { type: 'string', description: 'Which component to extend. Omit to pick one.' },
			newComponent: { type: 'string', description: 'Create this component and extend it instead.' }
		},
		required: ['collection', 'field', 'spec']
	},
	annotations: WRITE,
	target: 'world.addCollectionField(collectionName, opts)'
};

const createRecord: ToolManifestEntry = {
	name: 'create_record',
	title: 'Create record',
	description:
		'Add a row to a collection, taking the collection’s default field values. Override any of them by passing values keyed by component name. Returns the new record id. Records are data, not scenery — they have no position and never appear in the viewport.',
	inputSchema: {
		type: 'object',
		properties: {
			collection: { type: 'string', description: 'Collection type name, e.g. "Item".' },
			values: {
				type: 'object',
				description: 'Field values keyed by component name, e.g. {"ItemData":{"price":10}}.'
			}
		},
		required: ['collection']
	},
	annotations: WRITE,
	target: 'world.createRecord(collection, overrides)'
};

const deleteRecord: ToolManifestEntry = {
	name: 'delete_record',
	title: 'Delete record',
	description:
		'Remove one row from a collection permanently. Find the id with list_records first. Use remove_entity for entities that live in the scene.',
	inputSchema: {
		type: 'object',
		properties: {
			recordId: { type: 'string', description: 'The record id, from list_records.' }
		},
		required: ['recordId']
	},
	annotations: WRITE,
	target: 'world.deleteRecord(id)'
};

// ---- write: scene, rooms, editor -------------------------------------------

const setSceneSetting: ToolManifestEntry = {
	name: 'set_scene_setting',
	title: 'Set scene setting',
	description:
		'Change one of the scene’s presentation or post-processing settings — this is how the world’s mood is authored. Scalars: name, background (hex), shadows, grid, sky (noon, afternoon, sunset, night, off), artStyle (realistic, toon, ink, clay, noir), toneMapping, exposure. Effect groups: fog, bloom, vignette, grain, outline, sketch — pass true/false to toggle, or an object of knobs such as {"enabled":true,"color":"#2a1a4a","far":90}. Read current values with get_scene.',
	inputSchema: {
		type: 'object',
		properties: {
			key: {
				type: 'string',
				enum: [
					'name',
					'background',
					'shadows',
					'grid',
					'sky',
					'artStyle',
					'toneMapping',
					'exposure',
					'fog',
					'bloom',
					'vignette',
					'grain',
					'outline',
					'sketch'
				],
				description: 'Which setting to change.'
			},
			value: {
				description: 'Scalar for scalar keys; true/false or a knobs object for effect groups.'
			}
		},
		required: ['key', 'value']
	},
	annotations: WRITE,
	target: 'ui.scene'
};

const switchRoom: ToolManifestEntry = {
	name: 'switch_room',
	title: 'Switch room',
	description:
		'Move the running world into another room, swapping in that room’s entities. Only works while the world is playing — call set_mode with "play" first. Use list_rooms to see the room ids.',
	inputSchema: {
		type: 'object',
		properties: {
			roomId: { type: 'string', description: 'Room id, from list_rooms.' }
		},
		required: ['roomId']
	},
	annotations: WRITE,
	target: 'world.switchRoom(roomId)'
};

const selectEntity: ToolManifestEntry = {
	name: 'select_entity',
	title: 'Select entity',
	description:
		'Select an entity in the editor, as clicking it would: the inspector opens on it and the selection outline appears for everyone in the room. Pass no id to clear the selection. This changes what a human sees, not the world itself.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: { type: 'string', description: 'The entity id. Omit to clear the selection.' }
		}
	},
	annotations: WRITE,
	target: 'world.trySelect(id)'
};

const focusEntity: ToolManifestEntry = {
	name: 'focus_entity',
	title: 'Focus the camera',
	description:
		'Move the editor camera to frame an entity, keeping the current viewing angle. Use it to show a human what you just built, or pass no id to return the camera to its default pose. Editor viewport only.',
	inputSchema: {
		type: 'object',
		properties: {
			entityId: { type: 'string', description: 'The entity to frame. Omit to reset the camera.' }
		}
	},
	annotations: WRITE,
	target: 'scene/focusEntity.viewportFocus'
};

const setMode: ToolManifestEntry = {
	name: 'set_mode',
	title: 'Set editor mode',
	description:
		'Switch what the editor is doing: "edit" to author, "play" to run the world, "pause" and "resume" to hold and release a running world, "reset" to restart play from the snapshot taken when play began, and "publish" to open the publish panel. Read the current mode with world_status.',
	inputSchema: {
		type: 'object',
		properties: {
			mode: {
				type: 'string',
				enum: ['edit', 'play', 'pause', 'resume', 'reset', 'publish'],
				description: 'The mode or transition to apply.'
			}
		},
		required: ['mode']
	},
	annotations: WRITE,
	target: 'ui.enterPlay / exitPlay / pausePlay / resumePlay / resetPlay / enterPublish'
};

const undo: ToolManifestEntry = {
	name: 'undo',
	title: 'Undo',
	description:
		'Reverse the last edit, exactly as ⌘Z would. The history is shared with the human editor, so this can undo their work as well as yours — check world_status first, and prefer making a corrective edit when you are not sure what the last step was.',
	inputSchema: { type: 'object', properties: {} },
	annotations: WRITE,
	target: 'editHistory.undo()'
};

const redo: ToolManifestEntry = {
	name: 'redo',
	title: 'Redo',
	description:
		'Reapply the edit most recently undone. Any new edit clears what could be redone.',
	inputSchema: { type: 'object', properties: {} },
	annotations: WRITE,
	target: 'editHistory.redo()'
};

export const WEBMCP_TOOLS: ToolManifestEntry[] = [
	// read: world
	listEntities,
	describeEntity,
	worldStatus,
	getPlayer,
	listRooms,
	getScene,
	// read: ontology
	listTypes,
	describeType,
	listComponents,
	describeComponent,
	listAssets,
	listRecords,
	getEntityJson,
	// write: spawn
	spawnProp,
	spawnCharacter,
	spawnFromType,
	duplicateEntity,
	removeEntity,
	// write: entity
	setEntityField,
	addEntityComponent,
	removeEntityComponent,
	setEntityJson,
	setEntityEvents,
	saveEntityAsType,
	// write: types
	defineType,
	addTypeComponent,
	removeTypeComponent,
	setTypeDefault,
	setTypeEvents,
	addTypeField,
	// write: component schemas
	defineComponent,
	addComponentField,
	editComponentField,
	renameComponentField,
	removeComponentField,
	// write: collections
	defineCollection,
	addCollectionField,
	createRecord,
	deleteRecord,
	// write: scene, rooms, editor
	setSceneSetting,
	switchRoom,
	selectEntity,
	focusEntity,
	setMode,
	undo,
	redo
];

// ---- FieldSchema -> JSON Schema -------------------------------------------

const NUMBER_TUPLE = (n: number): JsonSchema => ({
	type: 'array',
	items: { type: 'number' },
	minItems: n,
	maxItems: n
});

/** Project an ontology field onto the JSON Schema an agent sees. */
export function fieldSchemaToJsonSchema(field: FieldSchema): JsonSchema {
	switch (field.t) {
		case 'number':
			return { type: 'number' };
		case 'string':
		case 'longtext':
			return { type: 'string' };
		case 'select':
			return field.options?.length ? { type: 'string', enum: [...field.options] } : { type: 'string' };
		case 'boolean':
			return { type: 'boolean' };
		case 'vec2':
			return NUMBER_TUPLE(2);
		case 'vec3':
			return NUMBER_TUPLE(3);
		case 'quat':
			return NUMBER_TUPLE(4);
		case 'color':
			return { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' };
		case 'ref':
			return { type: 'string' };
		case 'json':
			return {};
	}
}
