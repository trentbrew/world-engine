import { SvelteMap } from 'svelte/reactivity';
import type { Mesh } from 'three';

/**
 * Scatter-surface registry: entity id → mounted mesh + geometry revision.
 *
 * Views own their meshes privately, so a consumer (e.g. GrassField with
 * `surfaceEntity`) cannot reach another entity's surface any other way. A
 * mesh-owning view publishes its root mesh on mount and unpublishes on
 * unmount; every publish bumps the revision so consumers respawn when the
 * surface geometry is rebuilt.
 *
 * Reads are reactive (`SvelteMap`, same primitive as
 * `player/gamepad.svelte.ts`): a `$derived(resolveScatterSurface(id))`
 * re-runs when the entry appears, disappears, or is republished. The module
 * is plain TypeScript (no runes), so headless smoke tests can import it
 * directly. Missing ids resolve to null and must warn-and-skip at the call
 * site, never crash the frame.
 */
export type ScatterSurface = { mesh: Mesh; revision: number };

class ScatterSurfaceRegistry {
	#surfaces = new SvelteMap<string, ScatterSurface>();

	/**
	 * Publish a mesh; returns a cleanup that unpublishes it. Bumps the revision
	 * only when the mesh identity actually changes — republishing the SAME mesh
	 * is a silent no-op. This matters: callers publish from inside `$effect`,
	 * and reading the map subscribes that effect, so an unconditional write
	 * would resubscribe-and-refire forever (`effect_update_depth_exceeded`).
	 */
	publish(entityId: string, mesh: Mesh): () => void {
		const prev = this.#surfaces.get(entityId);
		if (prev && prev.mesh === mesh) {
			return () => this.unpublish(entityId, mesh);
		}
		this.#surfaces.set(entityId, { mesh, revision: (prev?.revision ?? 0) + 1 });
		return () => this.unpublish(entityId, mesh);
	}

	/** Remove an entry, but only if it still points at the given mesh, so a
	 *  stale cleanup from a rebuilt surface never drops its replacement. */
	unpublish(entityId: string, mesh?: Mesh): void {
		const cur = this.#surfaces.get(entityId);
		if (!cur) return;
		if (mesh && cur.mesh !== mesh) return;
		this.#surfaces.delete(entityId);
	}

	resolve(entityId: string): Mesh | null {
		return this.#surfaces.get(entityId)?.mesh ?? null;
	}

	revision(entityId: string): number {
		return this.#surfaces.get(entityId)?.revision ?? 0;
	}
}

export const scatterSurfaceRegistry = new ScatterSurfaceRegistry();

/** Resolve a published scatter surface by entity id. Null when unknown. */
export function resolveScatterSurface(entityId: string): Mesh | null {
	return scatterSurfaceRegistry.resolve(entityId);
}

/** Geometry revision for an entity id (0 when unpublished). Read in $derived
 *  so consumers respawn when the surface is rebuilt. */
export function scatterSurfaceRevision(entityId: string): number {
	return scatterSurfaceRegistry.revision(entityId);
}

export function publishScatterSurface(entityId: string, mesh: Mesh): () => void {
	return scatterSurfaceRegistry.publish(entityId, mesh);
}

export function unpublishScatterSurface(entityId: string, mesh?: Mesh): void {
	scatterSurfaceRegistry.unpublish(entityId, mesh);
}
