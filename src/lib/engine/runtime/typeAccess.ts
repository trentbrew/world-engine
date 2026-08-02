import {
	getType,
	isBuiltinType,
	isCollection,
	listComponents
} from '$lib/engine/ontology/registry';

/** Components never attached to object types via the Objects editor. */
const TYPE_ADD_DENY = new Set(['EditorScene', 'Player']);

/** Type composition rules — mirror instance removal guards. */
const TYPE_REMOVE_REQUIRES: Record<string, string[]> = {
	Transform: ['Render', 'Ground', 'Marker', 'Physics']
};

/**
 * Builtin types that still allow world-overridable *default field* edits
 * (GameMaker object sprite pattern). Composition stays locked via
 * `isEditableObjectType` / `canRemoveTypeComponent`.
 */
const TYPE_DEFAULT_EDIT_ALLOWLIST: Record<string, ReadonlySet<string>> = {
	Player: new Set([
		'SkinnedMesh.mesh',
		'SkinnedMesh.anchor',
		'SkinnedMesh.rig',
		'SkinnedMesh.forwardYaw',
		'SkinnedMesh.capsuleRadiusScale',
		'SkinnedMesh.capsuleHeightScale',
		'Mesh3DAnimator.catalog',
		'Mesh3DAnimator.clip',
		'Mesh3DAnimator.locomotion'
	])
};

function fieldKey(component: string, field: string): string {
	return `${component}.${field}`;
}

/** World-authored types (objects or collections), excluding built-in registry entries. */
export function isEditableType(typeName: string): boolean {
	const type = getType(typeName);
	if (!type) return false;
	return !isBuiltinType(typeName);
}

export function isEditableObjectType(typeName: string): boolean {
	const type = getType(typeName);
	if (!type) return false;
	if (isBuiltinType(typeName)) return false;
	if (isCollection(typeName)) return false;
	return true;
}

/** True when this type exposes any allowlisted default-field edits. */
export function canEditTypeDefaults(typeName: string): boolean {
	if (isEditableObjectType(typeName)) return true;
	const type = getType(typeName);
	if (!type) return false;
	return typeName in TYPE_DEFAULT_EDIT_ALLOWLIST;
}

/** True when a specific type default field may be authored (Objects UI / setTypeDefault). */
export function canEditTypeDefaultField(
	typeName: string,
	component: string,
	field: string
): boolean {
	if (isEditableObjectType(typeName)) {
		const type = getType(typeName);
		return !!type?.components.includes(component);
	}
	const allowed = TYPE_DEFAULT_EDIT_ALLOWLIST[typeName];
	if (!allowed) return false;
	const type = getType(typeName);
	if (!type?.components.includes(component)) return false;
	return allowed.has(fieldKey(component, field));
}

export function listAddableTypeComponents(typeName: string): string[] {
	const type = getType(typeName);
	if (!type || !isEditableType(typeName)) return [];
	const present = new Set(type.components);
	return listComponents().filter((name) => {
		if (present.has(name)) return false;
		if (TYPE_ADD_DENY.has(name)) return false;
		return true;
	});
}

export function canRemoveTypeComponent(typeName: string, componentName: string): boolean {
	const type = getType(typeName);
	if (!type || !isEditableType(typeName)) return false;
	if (!type.components.includes(componentName)) return false;
	if (type.components.length <= 1) return false;

	const dependents = TYPE_REMOVE_REQUIRES[componentName];
	if (dependents?.some((dep) => type.components.includes(dep))) return false;

	return true;
}
