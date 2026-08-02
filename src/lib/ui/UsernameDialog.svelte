<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { collab } from '$lib/engine/collab/collab.svelte';

	let draft = $state('');

	$effect(() => {
		if (collab.usernamePromptOpen) draft = collab.username;
	});

	function save() {
		collab.dismissUsernamePrompt(false, draft);
	}

	function skip() {
		collab.dismissUsernamePrompt(true);
	}
</script>

<Dialog.Root bind:open={collab.usernamePromptOpen}>
	<Dialog.Content resizable class="sm:max-w-[360px]" showCloseButton={false}>
		<Dialog.Header>
			<Dialog.Title>Choose a display name</Dialog.Title>
		</Dialog.Header>
		<p class="hint">Optional — shown on your avatar when collaborating.</p>
		<Input
			type="text"
			maxlength={32}
			placeholder="Your name (optional)"
			bind:value={draft}
			aria-label="Display name"
			onkeydown={(event) => {
				if (event.key === 'Enter') save();
			}}
		/>
		<div class="actions">
			<Button type="button" variant="ghost" onclick={skip}>Skip</Button>
			<Button type="button" onclick={save}>Save</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.hint {
		font-size: 12px;
		color: var(--muted-foreground);
		margin-bottom: 12px;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}
</style>
