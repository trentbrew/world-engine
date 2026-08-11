/** Screen-space player interact prompt (updated from inside the Canvas). */

export type PlayerInteractPromptState = {
	entityId: string;
	label: string;
	hint: string;
	x: number;
	y: number;
	/** Target entity exists and was projected this frame (may sit off-viewport). */
	visible: boolean;
	/**
	 * Projected point lies inside the viewport (with margin) and in front of the
	 * camera. Off-screen targets keep `visible` so chat can pin an edge arrow.
	 */
	onScreen: boolean;
	/** Within walk-up interact radius — gates the "Press E" pill. */
	inRange: boolean;
	/** XZ distance from the local player, in meters. */
	distance: number;
};

class PlayerInteractPromptStore {
	prompt = $state<PlayerInteractPromptState | null>(null);

	set(prompt: PlayerInteractPromptState | null) {
		this.prompt = prompt;
	}

	clear() {
		this.prompt = null;
	}
}

export const playerInteractPrompt = new PlayerInteractPromptStore();
