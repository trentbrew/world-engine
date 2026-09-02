/**
 * Dev-time persistence for edit-mode transforms into static/games/*.jsonld.
 * Realtime ontology fields (Transform.position) are authored here without
 * changing sync policy or multiplayer semantics.
 */
import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import { readShellModeFromUrl } from '$lib/engine/shellUrl';

const isDevBuild = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

let gameName: string | undefined;
const pending = new Map<string, DurablePatch>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function bindWorldFileAuthor(game: string | null | undefined): void {
	gameName = game ?? 'default';
}

function patchKey(patch: DurablePatch): string {
	if (!('kind' in patch) || patch.kind === 'setField' || patch.kind === undefined) {
		const fieldPatch = patch as { entityId: string; component: string; field: string };
		return `${fieldPatch.entityId}:${fieldPatch.component}:${fieldPatch.field}`;
	}
	return JSON.stringify(patch);
}

export function shouldAuthorToWorldFile(): boolean {
	return isDevBuild && readShellModeFromUrl() !== 'play';
}

export function queueWorldFilePatch(patch: DurablePatch): void {
	if (!shouldAuthorToWorldFile() || !gameName || typeof window === 'undefined') return;
	pending.set(patchKey(patch), patch);
	if (flushTimer) clearTimeout(flushTimer);
	flushTimer = setTimeout(() => {
		void flushWorldFilePatches();
	}, 250);
}

export async function flushWorldFilePatches(): Promise<void> {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	if (!gameName || pending.size === 0) return;

	const patches = [...pending.values()];
	pending.clear();

	for (const patch of patches) {
		try {
			const response = await fetch(`/api/world/${encodeURIComponent(gameName)}/patch`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ patch })
			});
			if (!response.ok) {
				const text = await response.text().catch(() => '');
				console.warn('[world-author] patch failed', response.status, text);
			}
		} catch (error) {
			console.warn('[world-author] patch failed', error);
		}
	}
}
