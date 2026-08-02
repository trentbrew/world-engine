<script lang="ts">
	import { theme, setTheme } from 'mode-watcher';
	import { THEME_REGISTRY, type ThemeId } from '$lib/ui/theme/registry';

	const activeId = $derived((theme.current || 'default') as ThemeId);

	function selectPreset(id: ThemeId) {
		setTheme(id);
	}
</script>

<div class="preset-grid" role="group" aria-label="Theme preset">
	{#each THEME_REGISTRY as preset (preset.id)}
		<button
			type="button"
			class="preset-card"
			aria-label="{preset.label} theme"
			aria-pressed={activeId === preset.id}
			onclick={() => selectPreset(preset.id)}
		>
			<span class="swatch" aria-hidden="true">
				{#each preset.swatch as color (color)}
					<span style:background={color}></span>
				{/each}
			</span>
			<span class="preset-label">{preset.label}</span>
		</button>
	{/each}
</div>

<style>
	.preset-grid {
		display: flex;
		gap: var(--spacing-sm);
	}

	.preset-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: var(--spacing-sm);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--input);
		cursor: pointer;
		font: inherit;
		font-size: 11px;
		color: var(--foreground);
	}

	.preset-card:hover {
		border-color: var(--ring);
	}

	.preset-card[aria-pressed='true'] {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	.swatch {
		width: 48px;
		height: 32px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		overflow: hidden;
	}

	.preset-label {
		text-align: center;
		line-height: 1.3;
	}
</style>
