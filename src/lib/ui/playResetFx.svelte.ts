/** Play-mode reset flash — gray fade + local SFX. */

import { playSfx } from '$lib/engine/audio/sfx';

const RESET_SFX = '/audio/respawn.wav';
const FADE_IN_MS = 200;
const FADE_OUT_MS = 200;
const HOLD_MS = 50;

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

class PlayResetFx {
	opacity = $state(0);
	active = $state(false);
	#busy = false;

	async run(onReset: () => void): Promise<void> {
		if (this.#busy || typeof window === 'undefined') return;
		this.#busy = true;
		this.active = true;
		this.opacity = 0;

		playSfx(RESET_SFX, 0.9);

		await nextFrame();
		await nextFrame();
		this.opacity = 1;
		await wait(FADE_IN_MS);

		onReset();
		await wait(HOLD_MS);

		this.opacity = 0;
		await wait(FADE_OUT_MS);

		this.active = false;
		this.#busy = false;
	}
}

export const playResetFx = new PlayResetFx();
