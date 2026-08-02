<script lang="ts">
	import { onMount } from 'svelte';
	import { setMode } from 'mode-watcher';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import ThemePresetPicker from '$lib/ui/theme/ThemePresetPicker.svelte';

	type ColorMode = 'light' | 'dark' | 'system';

	let colorMode = $state<ColorMode>('dark');

	onMount(() => {
		const stored = localStorage.getItem('mode');
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			colorMode = stored;
		}
	});

	function onColorModeChange(value: string) {
		if (value !== 'light' && value !== 'dark' && value !== 'system') return;
		colorMode = value;
		setMode(value);
	}
</script>

<section class="appearance-section" aria-labelledby="appearance-heading">
	<h3 id="appearance-heading" class="section-label">Appearance</h3>

	<p class="field-label">Color mode</p>
	<ToggleGroup.Root
		type="single"
		variant="outline"
		size="sm"
		spacing={0}
		class="mode-toggle"
		aria-label="Color mode"
		value={colorMode}
		onValueChange={(value) => {
			if (value) onColorModeChange(value);
		}}
	>
		<ToggleGroup.Item value="light">Light</ToggleGroup.Item>
		<ToggleGroup.Item value="dark">Dark</ToggleGroup.Item>
		<ToggleGroup.Item value="system">System</ToggleGroup.Item>
	</ToggleGroup.Root>

	<p class="field-label">Theme preset</p>
	<ThemePresetPicker />
</section>

<style>
	.appearance-section {
		padding-bottom: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		border-bottom: 1px solid var(--border);
	}

	.section-label {
		font-size: 11px;
		font-weight: 500;
		color: var(--muted-foreground);
		margin: 0 0 var(--spacing-sm);
	}

	.field-label {
		font-size: 10px;
		color: var(--muted-foreground);
		margin: 0 0 4px;
	}

	.field-label + :global(.mode-toggle) {
		margin-bottom: var(--spacing-sm);
	}

	:global(.mode-toggle) {
		width: 100%;
	}
</style>
