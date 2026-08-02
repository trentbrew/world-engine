/** Tracks Threlte `<Suspense>` suspend state and dev HMR burst windows. */
import { isSoftReload } from '$lib/engine/dev/editorSession';

const HMR_SETTLE_MS = 2500;

class SceneLoading {
	/** Starts true — overlay stays up until Suspense `onload` (cold load). */
	suspended = $state(true);
	/** Dev HMR burst — defer blocking overlay while edits stream in. */
	hmrBurst = $state(false);
	/** Human-readable loading step shown on the overlay. */
	phase = $state('Loading scene assets');
	/** Optional sub-detail (file name, room id, transport, etc.). */
	detail = $state('');

	#settleTimer: ReturnType<typeof setTimeout> | null = null;

	setPhase(phase: string, detail = ''): void {
		this.phase = phase;
		this.detail = detail;
	}

	noteHmrUpdate(): void {
		if (!import.meta.env.DEV) return;
		this.hmrBurst = true;
		this.setPhase('Applying edits');
		this.#scheduleSettle();
	}

	#scheduleSettle(): void {
		if (this.#settleTimer) clearTimeout(this.#settleTimer);
		this.#settleTimer = setTimeout(() => {
			this.hmrBurst = false;
			this.#settleTimer = null;
		}, HMR_SETTLE_MS);
	}

	noteSuspend(): void {
		if (this.shouldDeferOverlay) return;
		this.suspended = true;
		this.setPhase('Loading scene assets', 'Meshes, textures, and physics');
	}

	noteLoad(): void {
		this.suspended = false;
	}

	get shouldDeferOverlay(): boolean {
		return import.meta.env.DEV && (this.hmrBurst || isSoftReload());
	}

	/** Full-screen blocking overlay — cold load or long suspend, not rapid HMR. */
	get showBlockingOverlay(): boolean {
		return this.suspended && !this.shouldDeferOverlay;
	}

	/** Lightweight dev indicator while the scene rebinds during HMR. */
	get showEditingIndicator(): boolean {
		return import.meta.env.DEV && this.shouldDeferOverlay && (this.suspended || this.hmrBurst);
	}

	get overlayLabel(): string {
		return this.showEditingIndicator ? 'Editing…' : this.phase;
	}

	get overlayDetail(): string {
		return this.showEditingIndicator ? '' : this.detail;
	}
}

export const sceneLoading = new SceneLoading();
