<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ClipboardPasteIcon from '@lucide/svelte/icons/clipboard-paste';
	import CopyPlusIcon from '@lucide/svelte/icons/copy-plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button/index.js';
	import { hasEntityClipboard } from '$lib/engine/runtime/entityClipboard.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { entityDestroy } from '$lib/ui/entityDestroy.svelte';
	import { modShortcut } from '$lib/ui/keyboardLabels';

	const canCopy = $derived(world.selectedEntity !== null);
	const canPaste = $derived(hasEntityClipboard());
	const canDuplicate = $derived(world.selectedEntity !== null);
	const canDelete = $derived(entityDestroy.canRequest());
</script>

<div class="entity-edit-actions" role="group" aria-label="Entity actions">
	<Button
		variant="ghost"
		size="icon-sm"
		class="action-btn"
		disabled={!canCopy}
		title="Copy ({modShortcut('C')})"
		aria-label="Copy"
		onclick={() => world.copySelection()}
	>
		<CopyIcon class="size-3.5" aria-hidden="true" />
	</Button>
	<Button
		variant="ghost"
		size="icon-sm"
		class="action-btn"
		disabled={!canPaste}
		title="Paste ({modShortcut('V')})"
		aria-label="Paste"
		onclick={() => world.pasteClipboard()}
	>
		<ClipboardPasteIcon class="size-3.5" aria-hidden="true" />
	</Button>
	<Button
		variant="ghost"
		size="icon-sm"
		class="action-btn"
		disabled={!canDuplicate}
		title="Duplicate ({modShortcut('D')})"
		aria-label="Duplicate"
		onclick={() => world.duplicateSelection()}
	>
		<CopyPlusIcon class="size-3.5" aria-hidden="true" />
	</Button>
	<Button
		variant="ghost"
		size="icon-sm"
		class="action-btn action-btn-destructive"
		disabled={!canDelete}
		title="Destroy (Delete)"
		aria-label="Destroy"
		onclick={() => entityDestroy.request()}
	>
		<Trash2Icon class="size-3.5" aria-hidden="true" />
	</Button>
</div>

<style>
	.entity-edit-actions {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		flex-shrink: 0;
	}

	:global(.entity-edit-actions .action-btn) {
		width: 26px;
		height: 26px;
		color: var(--muted-foreground);
	}

	:global(.entity-edit-actions .action-btn:hover:not(:disabled)) {
		color: var(--foreground);
	}

	:global(.entity-edit-actions .action-btn-destructive:not(:disabled)) {
		color: var(--destructive);
	}

	:global(.entity-edit-actions .action-btn-destructive:disabled) {
		color: color-mix(in srgb, var(--destructive) 40%, var(--muted-foreground));
		opacity: 1;
	}
</style>
