/** Screen-space room portal interact prompt (updated from inside the Canvas). */

export type RoomPortalPromptState = {
	entityId: string;
	label: string;
	hint: string;
	x: number;
	y: number;
	visible: boolean;
};

class RoomPortalPromptStore {
	prompt = $state<RoomPortalPromptState | null>(null);

	set(prompt: RoomPortalPromptState | null) {
		this.prompt = prompt;
	}

	clear() {
		this.prompt = null;
	}
}

export const roomPortalPrompt = new RoomPortalPromptStore();
