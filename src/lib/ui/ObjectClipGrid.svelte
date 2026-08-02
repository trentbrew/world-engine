<script lang="ts">
	import type { CatalogClip } from '$lib/engine/animation/clipCatalog';

	interface Props {
		clips: CatalogClip[];
		activeClip: string;
		onSelect: (clipId: string) => void;
		readonly?: boolean;
	}

	let { clips, activeClip, onSelect, readonly = false }: Props = $props();
</script>

<div class="clip-grid" role="listbox" aria-label="Animation clips">
	{#each clips as clip (clip.id)}
		<button
			type="button"
			role="option"
			class="clip-card"
			class:active={clip.id === activeClip}
			aria-selected={clip.id === activeClip}
			disabled={readonly}
			onclick={() => onSelect(clip.id)}
		>
			<span class="clip-id">{clip.id}</span>
			{#if clip.category}
				<span class="clip-cat">{clip.category}</span>
			{/if}
			{#if clip.dur}
				<span class="clip-dur">{clip.dur.toFixed(1)}s</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.clip-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
		gap: 6px;
		padding: var(--spacing-sm);
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
	}

	.clip-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
		padding: 8px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
		cursor: pointer;
		text-align: left;
	}

	.clip-card:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
	}

	.clip-card.active {
		border-color: var(--accent-entity);
		background: color-mix(in srgb, var(--accent-entity) 14%, transparent);
	}

	.clip-card:disabled {
		opacity: 0.65;
		cursor: default;
	}

	.clip-id {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--foreground);
		word-break: break-all;
	}

	.clip-cat {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted-foreground);
	}

	.clip-dur {
		font-size: 9px;
		color: var(--muted-foreground);
	}
</style>
