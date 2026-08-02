<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { collab } from '$lib/engine/collab/collab.svelte';
	import { session } from '$lib/engine/net/session.svelte';

	interface Props {
		embedded?: boolean;
	}

	let { embedded = false }: Props = $props();

	function commitUsername() {
		collab.setUsername(collab.username);
		session.rebroadcastPresence();
	}

	function commitAlias() {
		collab.setRoomAlias(collab.roomAlias);
	}
</script>

<section class="collab-section" class:embedded aria-labelledby={embedded ? undefined : 'collab-settings-heading'}>
	{#if !embedded}
		<h3 id="collab-settings-heading" class="section-title">Collaboration</h3>
	{/if}

	<div class="field-stack">
		<Label for="collab-username">Display name</Label>
		<div class="field-inline">
			<Input
				id="collab-username"
				type="text"
				maxlength={32}
				placeholder="Your name (optional)"
				bind:value={collab.username}
				onchange={commitUsername}
				onkeydown={(event) => {
					if (event.key === 'Enter') commitUsername();
				}}
			/>
		</div>
	</div>

	<div class="field-stack">
		<Label for="collab-room-alias">Room alias</Label>
		<div class="field-inline">
			<Input
				id="collab-room-alias"
				type="text"
				maxlength={64}
				placeholder="Room display name"
				bind:value={collab.roomAlias}
				onchange={commitAlias}
				onkeydown={(event) => {
					if (event.key === 'Enter') commitAlias();
				}}
			/>
		</div>
	</div>

	{#if session.connected && session.peerCount === 1}
		<p class="hint">Open another tab on the same room to see collaborators.</p>
	{/if}
</section>

<style>
	.collab-section {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--border);
	}

	.collab-section.embedded {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}

	.section-title {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 10px;
	}

	.field-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 32px;
		margin-bottom: 10px;
		font-size: 12px;
	}

	.field-stack {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 10px;
	}

	.field-inline {
		display: flex;
		gap: 8px;
	}

	.hint {
		font-size: 11px;
		color: var(--muted-foreground);
		line-height: 1.45;
		margin: 4px 0 0;
	}
</style>
