import type { MeshBounds } from '$lib/engine/render/meshAnchor';

/** glTF bbox cache keyed by entity id — used by SelectionOutline. */
class RenderBounds {
	#bounds = $state<Map<string, MeshBounds>>(new Map());

	/** Subscribe in $derived to pick up async glTF load updates. */
	get all(): ReadonlyMap<string, MeshBounds> {
		return this.#bounds;
	}

	get(entityId: string): MeshBounds | undefined {
		return this.#bounds.get(entityId);
	}

	set(entityId: string, bounds: MeshBounds) {
		const prev = this.#bounds.get(entityId);
		if (
			prev &&
			prev.size[0] === bounds.size[0] &&
			prev.size[1] === bounds.size[1] &&
			prev.size[2] === bounds.size[2] &&
			prev.center[0] === bounds.center[0] &&
			prev.center[1] === bounds.center[1] &&
			prev.center[2] === bounds.center[2]
		) {
			return;
		}
		this.#bounds = new Map(this.#bounds).set(entityId, bounds);
	}

	clear(entityId: string) {
		if (!this.#bounds.has(entityId)) return;
		const next = new Map(this.#bounds);
		next.delete(entityId);
		this.#bounds = next;
	}
}

export const renderBounds = new RenderBounds();
