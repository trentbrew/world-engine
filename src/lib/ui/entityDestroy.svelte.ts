import { world } from '$lib/engine/runtime/world.svelte';
import { ui } from '$lib/ui/ui.svelte';

class EntityDestroyState {
	open = $state(false);

	canRequest(): boolean {
		if (ui.shellMode !== 'edit' || ui.placementDraft) return false;
		const id = world.selection;
		return id !== null && world.canDeleteEntity(id);
	}

	request(): boolean {
		if (!this.canRequest()) return false;
		this.open = true;
		return true;
	}

	confirm(): boolean {
		const deleted = world.deleteSelection();
		this.open = false;
		return deleted;
	}

	cancel() {
		this.open = false;
	}
}

export const entityDestroy = new EntityDestroyState();
