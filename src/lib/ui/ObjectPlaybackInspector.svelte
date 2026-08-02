<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ComponentFieldInput from '$lib/ui/ComponentFieldInput.svelte';
	import { comp } from '$lib/engine/render/access';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const entityId = $derived(ui.objectTarget);
	const entity = $derived(entityId ? world.getEntity(entityId) : undefined);
	const anim = $derived(
		entity
			? comp<{
					catalog?: string;
					clip?: string;
					speed?: number;
					loop?: boolean;
					rootMotion?: boolean;
					playing?: boolean;
				}>(entity, 'Mesh3DAnimator')
			: undefined
	);

	function shortId(id: string): string {
		const parts = id.split('/');
		return parts[parts.length - 1] ?? id;
	}

	function openInScene() {
		if (!entityId) return;
		world.select(entityId);
		ui.exitObject();
	}
</script>

<aside class="object-playback" aria-label="Playback inspector">
	{#if entity && entityId && anim}
		<div class="header">
			<span class="title">{entity.type ?? 'Character'}</span>
			<Badge variant="outline">{shortId(entity.id)}</Badge>
		</div>

		<div class="fields">
			<div class="field-row">
				<span class="label">clip</span>
				<span class="value mono">{anim.clip ?? '—'}</span>
			</div>
			<div class="field-row">
				<span class="label">catalog</span>
				<span class="value mono">{anim.catalog ?? '—'}</span>
			</div>
			<ComponentFieldInput
				{entityId}
				component="Mesh3DAnimator"
				field="speed"
				value={anim.speed ?? 1}
			/>
			<ComponentFieldInput
				{entityId}
				component="Mesh3DAnimator"
				field="loop"
				value={anim.loop ?? true}
			/>
			<ComponentFieldInput
				{entityId}
				component="Mesh3DAnimator"
				field="rootMotion"
				value={anim.rootMotion ?? false}
			/>
			<div class="field-row preview-row">
				<span class="label">preview</span>
				<label class="preview-toggle">
					<input type="checkbox" bind:checked={ui.objectPreviewPlaying} />
					Playing
				</label>
			</div>
		</div>

		<button type="button" class="scene-link" onclick={openInScene}>All properties in Scene →</button>
	{:else}
		<p class="empty">Select an animated character to inspect playback.</p>
	{/if}
</aside>

<style>
	.object-playback {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		flex-shrink: 0;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
	}

	.fields {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-sm);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
		margin-bottom: 10px;
	}

	.label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted-foreground);
		text-transform: lowercase;
	}

	.value.mono {
		font-family: var(--font-mono);
		font-size: 11px;
		width: 100%;
	}

	.preview-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		cursor: pointer;
	}

	.scene-link {
		margin: var(--spacing-sm);
		padding: 8px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: var(--field-control-radius);
		background: transparent;
		font-size: 11px;
		color: var(--muted-foreground);
		cursor: pointer;
		flex-shrink: 0;
	}

	.scene-link:hover {
		color: var(--foreground);
	}

	.empty {
		padding: var(--spacing-md);
		font-size: 12px;
		color: var(--muted-foreground);
	}
</style>
