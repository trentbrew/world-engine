<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import { createTypeEventsEditorModel } from '$lib/ui/typeEventsEditorModel.svelte';

	interface Props {
		typeName: string;
		readonly?: boolean;
	}

	let { typeName, readonly = false }: Props = $props();

	const model = createTypeEventsEditorModel(
		() => typeName,
		() => readonly
	);
</script>

<section class="type-clip" aria-label="Type clip authoring">
	{#if model.clipAssignments.length > 0}
		<div class="clip-summary" aria-label="Clip assignments">
			<h3 class="summary-title">Clip assignments</h3>
			<ul>
				{#each model.clipAssignments as row, i (i)}
					<li>{row}</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="summary-empty">No clip assignments yet — add a clip step below.</p>
	{/if}

	{#if !readonly}
		{#if model.hasAnimator}
			<form
				class="add-clip"
				aria-label="Add type clip step"
				onsubmit={(event) => {
					event.preventDefault();
					model.addClipOnCreate();
				}}
			>
				<div class="field-row">
					<span class="field-label">Clip</span>
					<div class="field-row-control">
						<FieldWell>
							<input type="text" bind:value={model.newClip} class="field-value field-value--left" />
						</FieldWell>
					</div>
				</div>
				<div class="field-row">
					<span class="field-label">After (s)</span>
					<div class="field-row-control">
						<FieldWell>
							<input
								type="number"
								min="0"
								step="0.1"
								bind:value={model.newDelay}
								class="field-value field-value--left"
							/>
						</FieldWell>
					</div>
				</div>
				<Button type="submit" size="sm">Add clip step</Button>
			</form>
		{:else}
			<div class="clip-hint">Add the Mesh3DAnimator capability to schedule animation clips.</div>
		{/if}
	{/if}
</section>

<style>
	.type-clip {
		display: grid;
		align-content: start;
		gap: var(--spacing-sm);
		padding: 0;
	}

	.clip-summary {
		padding: 8px 10px;
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--background) 72%, transparent);
	}

	.summary-title {
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: 600;
	}

	.clip-summary ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 4px;
	}

	.clip-summary li {
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.45;
	}

	.summary-empty,
	.clip-hint {
		margin: 0;
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.add-clip {
		display: grid;
		gap: 8px;
		align-items: end;
		padding-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.add-clip :global(input.field-value) {
		width: 100%;
		min-width: 0;
		border: 0;
		background: transparent;
		font-size: 11px;
		color: var(--foreground);
	}
</style>
