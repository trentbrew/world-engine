import { durableBagOnly } from '$lib/engine/ontology/durableBag';
import { getType, isBuiltinType } from '$lib/engine/ontology/registry';
import { isGroundEntity } from '$lib/engine/render/access';
import { SCENE_SETTINGS_ENTITY_ID } from '$lib/engine/scene/sceneConstants';
import { isPlayerEntity } from '$lib/engine/player/access';
import type { Entity } from '$lib/engine/ontology/schema';

export const TYPE_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;

export function captureTypeFromEntity(entity: Entity): {
	components: string[];
	defaults: Record<string, Record<string, unknown>>;
} {
	const components = Object.keys(entity.components).sort();
	const defaults: Record<string, Record<string, unknown>> = {};

	for (const comp of components) {
		const bag = entity.components[comp];
		const out = durableBagOnly(comp, bag);
		const formulas = entity.formulas?.[comp];
		if (formulas) {
			for (const [field, compiled] of Object.entries(formulas)) {
				out[field] = compiled.src;
			}
		}
		if (Object.keys(out).length > 0) defaults[comp] = out;
	}

	return { components, defaults };
}

export function canSaveAsType(entity: Entity): { ok: true } | { ok: false; reason: string } {
	if (isPlayerEntity(entity)) {
		return { ok: false, reason: 'Player entities cannot become types' };
	}
	if (isGroundEntity(entity)) {
		return { ok: false, reason: 'Ground entities cannot become types' };
	}
	if (entity.id === SCENE_SETTINGS_ENTITY_ID) {
		return { ok: false, reason: 'Scene settings cannot become types' };
	}

	const names = Object.keys(entity.components);
	const hasRender = 'Render' in entity.components;
	const spawnOnly =
		!hasRender &&
		names.every((n) => n === 'Transform' || n === 'Marker') &&
		'Marker' in entity.components;
	if (spawnOnly) {
		return { ok: false, reason: 'Needs a renderable composition' };
	}

	return { ok: true };
}

export function validateTypeName(name: string): { ok: true } | { ok: false; error: string } {
	if (!TYPE_NAME_PATTERN.test(name)) {
		return { ok: false, error: 'Use PascalCase (e.g. FallingCrate)' };
	}
	if (isBuiltinType(name)) {
		return { ok: false, error: `Type "${name}" is reserved` };
	}
	if (getType(name)) {
		return { ok: false, error: `Type "${name}" already exists` };
	}
	return { ok: true };
}

/** Format durable defaults for dialog preview. */
export function formatTypeDefaultsPreview(
	defaults: Record<string, Record<string, unknown>>
): string[] {
	const lines: string[] = [];
	for (const [comp, bag] of Object.entries(defaults)) {
		for (const [field, value] of Object.entries(bag)) {
			const text = typeof value === 'string' ? value : JSON.stringify(value);
			lines.push(`${comp}.${field}: ${text}`);
		}
	}
	return lines;
}
