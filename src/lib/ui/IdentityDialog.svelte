<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { collab, PEER_COLORS } from '$lib/engine/collab/collab.svelte';
	import { peerInitials } from '$lib/engine/collab/peerColor';
	import { session } from '$lib/engine/net/session.svelte';

	let draftName = $state('');
	let draftColor = $state<string | null>(null);

	const previewName = $derived(
		draftName.trim() || collab.localDisplayName()
	);
	const previewInitials = $derived(peerInitials(previewName));
	const previewColor = $derived(draftColor ?? collab.localAvatarColor());

	$effect(() => {
		if (!collab.identityDialogOpen) return;
		draftName = collab.username;
		draftColor = collab.avatarColor;
	});

	function save() {
		collab.setUsername(draftName);
		collab.setAvatarColor(draftColor);
		collab.closeIdentityDialog();
		session.rebroadcastPresence();
	}

	function cancel() {
		collab.closeIdentityDialog();
	}
</script>

<Dialog.Root
	open={collab.identityDialogOpen}
	onOpenChange={(open) => {
		if (!open) collab.closeIdentityDialog();
	}}
>
	<Dialog.Content resizable class="sm:max-w-[360px]">
		<Dialog.Header>
			<Dialog.Title>Your identity</Dialog.Title>
		</Dialog.Header>

		<div class="identity-preview" aria-hidden="true">
			<span class="avatar-preview" style:background={previewColor}>{previewInitials}</span>
			<div class="preview-copy">
				<span class="preview-name">{previewName}</span>
				<span class="preview-hint">Shown on your avatar</span>
			</div>
		</div>

		<div class="field-stack">
			<Label for="identity-name">Display name</Label>
			<Input
				id="identity-name"
				type="text"
				maxlength={32}
				placeholder="Your name (optional)"
				bind:value={draftName}
				aria-label="Display name"
				onkeydown={(event) => {
					if (event.key === 'Enter') save();
				}}
			/>
		</div>

		<div class="field-stack">
			<span class="field-label">Avatar color</span>
			<div class="color-grid" role="listbox" aria-label="Avatar color">
				{#each PEER_COLORS as color (color)}
					<button
						type="button"
						class="color-swatch"
						class:selected={draftColor === color}
						style:background={color}
						role="option"
						aria-selected={draftColor === color}
						aria-label={`Color ${color}`}
						title={color}
						onclick={() => {
							draftColor = color;
						}}
					></button>
				{/each}
			</div>
		</div>

		<div class="actions">
			<Button type="button" variant="ghost" onclick={cancel}>Cancel</Button>
			<Button type="button" onclick={save}>Save</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.identity-preview {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--card) 60%, transparent);
	}

	.avatar-preview {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 2px solid var(--card);
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
	}

	.preview-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.preview-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
	}

	.preview-hint {
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.field-stack {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
	}

	.field-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.color-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		padding: 0;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
	}

	.color-swatch.selected {
		border-color: var(--foreground);
		box-shadow:
			0 0 0 2px var(--card),
			0 0 0 4px var(--ring);
	}

	.color-swatch:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}
</style>
