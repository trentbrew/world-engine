/**
 * Named script catalog — @type Script meta nodes + reusable action lists (TRL-135).
 */
import type { EventAction } from './schema';
import type { JsonLdDoc, JsonLdNode } from './source';

export type ScriptDef = {
	id: string;
	title?: string;
	actions: EventAction[];
};

let installed: Map<string, ScriptDef> | null = null;

export function normalizeScriptId(id: string): string {
	const trimmed = id.trim();
	if (!trimmed) return trimmed;
	return trimmed.startsWith('script:') ? trimmed : `script:${trimmed}`;
}

export function parseScriptCatalog(doc: JsonLdDoc): Map<string, ScriptDef> | null {
	const graph = doc['@graph'];
	if (!Array.isArray(graph)) return null;

	const catalog = new Map<string, ScriptDef>();
	for (const node of graph) {
		if (node['@type'] !== 'Script' || !node['@id']) continue;
		if (!Array.isArray(node.actions)) {
			console.warn(`[scripts] Skipping Script ${node['@id']} — missing actions array`);
			continue;
		}

		const id = normalizeScriptId(String(node['@id']));
		if (catalog.has(id)) {
			console.warn(`[scripts] Duplicate script id "${id}" — last definition wins`);
		}

		catalog.set(id, {
			id,
			title: typeof node.title === 'string' ? node.title : undefined,
			actions: structuredClone(node.actions as EventAction[])
		});
	}

	return catalog.size > 0 ? catalog : null;
}

export function installScriptCatalog(catalog: Map<string, ScriptDef> | null): void {
	installed = catalog;
}

export function getScriptCatalog(): Map<string, ScriptDef> | null {
	return installed;
}

export function getScriptActions(id: string): EventAction[] | null {
	const normalized = normalizeScriptId(id);
	const def = installed?.get(normalized);
	return def?.actions ?? null;
}

export function clearScriptCatalog(): void {
	installed = null;
}

/** Skip Script meta nodes during entity hydration. */
export function isScriptMetaNode(node: JsonLdNode): boolean {
	return node['@type'] === 'Script';
}
