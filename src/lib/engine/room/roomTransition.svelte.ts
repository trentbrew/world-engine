/**
 * Room switch transition FX — fade (and none). Mid-point callback runs the entity swap.
 * After mid, holds cover until destination Suspense clears (or max hold).
 */
import { sceneLoading } from '$lib/ui/sceneLoading.svelte';

export type RoomTransitionPreset = 'none' | 'fade';

const MAX_HOLD_MS = 2500;

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

class RoomTransitionController {
	active = $state(false);
	/** 0 = transparent, 1 = fully covered */
	opacity = $state(0);
	color = $state('#0a0a0a');
	/** True while waiting for destination ready after mid swap. */
	holding = $state(false);
	/** Live-region / visible cue while holding. */
	cueText = $state('');
	#token = 0;

	async run(
		preset: RoomTransitionPreset,
		ms: number,
		mid: () => void,
		opts?: { color?: string }
	): Promise<void> {
		const token = ++this.#token;
		const color = opts?.color?.trim() || '#0a0a0a';
		this.color = color;
		const reduced = prefersReducedMotion();

		if (preset === 'none' || ms <= 0) {
			mid();
			if (token !== this.#token) return;
			await this.#holdUntilReady(token);
			return;
		}

		const half = Math.max(80, Math.floor(ms / 2));
		this.active = true;

		if (reduced) {
			this.opacity = 1;
		} else {
			this.opacity = 0;
			await this.#animateOpacity(0, 1, half, token);
			if (token !== this.#token) return;
		}

		mid();
		if (token !== this.#token) return;
		await this.#holdUntilReady(token, reduced);
		if (token !== this.#token) return;

		if (reduced) {
			this.opacity = 0;
		} else {
			await this.#animateOpacity(1, 0, half, token);
			if (token !== this.#token) return;
		}

		this.active = false;
		this.opacity = 0;
		this.holding = false;
		this.cueText = '';
	}

	cancel() {
		this.#token += 1;
		this.active = false;
		this.opacity = 0;
		this.holding = false;
		this.cueText = '';
	}

	async #holdUntilReady(token: number, reduced = prefersReducedMotion()): Promise<void> {
		this.holding = true;
		this.cueText = reduced ? 'Loading' : 'Preparing…';
		this.active = true;
		if (this.opacity < 1) this.opacity = 1;

		const start = performance.now();
		while (token === this.#token) {
			if (!sceneLoading.suspended) break;
			if (performance.now() - start >= MAX_HOLD_MS) break;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}

		if (token === this.#token) {
			this.holding = false;
			this.cueText = '';
		}
	}

	#animateOpacity(from: number, to: number, durationMs: number, token: number): Promise<void> {
		return new Promise((resolve) => {
			const start = performance.now();
			const tick = (now: number) => {
				if (token !== this.#token) {
					resolve();
					return;
				}
				const t = Math.min(1, (now - start) / durationMs);
				const eased = t * t * (3 - 2 * t);
				this.opacity = from + (to - from) * eased;
				if (t < 1) requestAnimationFrame(tick);
				else resolve();
			};
			requestAnimationFrame(tick);
		});
	}
}

export const roomTransition = new RoomTransitionController();
