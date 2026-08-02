/**
 * Signals that at least one Gaussian splat has finished initializing.
 * Heavy props with Render.deferUntilSplat wait on this before mounting GLTFs.
 */
class SplatReadyState {
	ready = $state(false);

	markReady(): void {
		this.ready = true;
	}

	reset(): void {
		this.ready = false;
	}
}

export const splatReady = new SplatReadyState();
