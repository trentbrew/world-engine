import type { Mesh } from 'three';

/** Maps entity ids → pickable meshes for postprocessing outline selection. */
class OutlineRegistry {
	#meshes = new Map<string, Set<Mesh>>();

	register(entityId: string, mesh: Mesh): () => void {
		let set = this.#meshes.get(entityId);
		if (!set) {
			set = new Set();
			this.#meshes.set(entityId, set);
		}

		if (set.has(mesh)) {
			return () => this.unregister(entityId, mesh);
		}

		set.add(mesh);
		return () => this.unregister(entityId, mesh);
	}

	unregister(entityId: string, mesh: Mesh): void {
		const set = this.#meshes.get(entityId);
		if (!set?.delete(mesh)) return;
		if (set.size === 0) this.#meshes.delete(entityId);
	}

	get(entityId: string): Mesh[] {
		return [...(this.#meshes.get(entityId) ?? [])];
	}

	/** Every registered mesh across all entities (for full-scene art outlines). */
	all(): Mesh[] {
		const out: Mesh[] = [];
		for (const set of this.#meshes.values()) {
			for (const mesh of set) out.push(mesh);
		}
		return out;
	}

	/** Stable snapshot for detecting registry changes without reactive churn. */
	fingerprint(): string {
		const parts: string[] = [];
		for (const [id, set] of this.#meshes) {
			parts.push(`${id}:${set.size}`);
		}
		return parts.sort().join(',');
	}
}

export const outlineRegistry = new OutlineRegistry();
