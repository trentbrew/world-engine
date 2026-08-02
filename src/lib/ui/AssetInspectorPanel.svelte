<script lang="ts">
	import AssetAnimationsPanel from '$lib/ui/AssetAnimationsPanel.svelte';
	import AssetDetailsPanel from '$lib/ui/AssetDetailsPanel.svelte';
	import AssetInspectorControls from '$lib/ui/AssetInspectorControls.svelte';
	import { ui, type AssetInspectorTab } from '$lib/ui/ui.svelte';

	const preview = $derived(ui.previewContext);
	const asset = $derived(preview?.kind === 'asset' ? preview.asset : null);
	const shape = $derived(preview?.kind === 'shape' ? preview.shape : null);
	const activeTab = $derived(ui.assetInspectorTab);

	const visibleTabs = $derived.by(() => {
		const tabs: { id: AssetInspectorTab; label: string; title: string; hidden?: boolean }[] = [
			{
				id: 'animations',
				label: 'Animations',
				title: 'Animation clips',
				hidden: shape != null || asset?.kind !== 'models'
			},
			{ id: 'inspector', label: 'Inspector', title: 'View controls' },
			{ id: 'details', label: 'Details', title: 'Metadata' }
		];
		return tabs.filter((tab) => !tab.hidden);
	});

	$effect(() => {
		if (!visibleTabs.some((tab) => tab.id === ui.assetInspectorTab)) {
			ui.assetInspectorTab = visibleTabs[0]?.id ?? 'inspector';
		}
	});

	function selectTab(tab: AssetInspectorTab) {
		if (!preview) return;
		ui.assetInspectorTab = tab;
	}

	function panelId(tab: AssetInspectorTab): string {
		return `asset-inspector-panel-${tab}`;
	}

	const selectionLabel = $derived(shape?.label ?? asset?.name ?? 'No selection');
</script>

<aside class="asset-inspector-panel" aria-label="Asset inspector">
	<div class="inspector-header">
		{#if preview}
			<span class="header-title">{selectionLabel}</span>
			<span class="header-kicker">{shape ? 'primitive' : asset?.kind}</span>
		{:else}
			<span class="header-muted">No selection</span>
		{/if}
	</div>

	{#if preview}
		<div class="panel-tabs" role="tablist" aria-label="Asset inspector views">
			{#each visibleTabs as tab (tab.id)}
				<button
					type="button"
					role="tab"
					id="asset-inspector-tab-{tab.id}"
					class="panel-tab"
					class:active={activeTab === tab.id}
					aria-selected={activeTab === tab.id}
					aria-controls={panelId(tab.id)}
					title={tab.title}
					tabindex={activeTab === tab.id ? 0 : -1}
					onclick={() => selectTab(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<div class="inspector-body">
			<div
				role="tabpanel"
				id={panelId('animations')}
				class="tab-panel"
				class:active={activeTab === 'animations'}
				hidden={activeTab !== 'animations'}
				aria-labelledby="asset-inspector-tab-animations"
			>
				<AssetAnimationsPanel />
			</div>

			<div
				role="tabpanel"
				id={panelId('inspector')}
				class="tab-panel"
				class:active={activeTab === 'inspector'}
				hidden={activeTab !== 'inspector'}
				aria-labelledby="asset-inspector-tab-inspector"
			>
				<AssetInspectorControls />
			</div>

			<div
				role="tabpanel"
				id={panelId('details')}
				class="tab-panel"
				class:active={activeTab === 'details'}
				hidden={activeTab !== 'details'}
				aria-labelledby="asset-inspector-tab-details"
			>
				<AssetDetailsPanel />
			</div>
		</div>
	{:else}
		<div class="inspector-empty">
			<p>Select a shape, model, texture, or file from the catalog to inspect it here.</p>
		</div>
	{/if}
</aside>

<style>
	.asset-inspector-panel {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
		height: 100%;
		pointer-events: auto;
	}

	.inspector-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		flex-shrink: 0;
	}

	.header-title {
		font-weight: 600;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.header-kicker {
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.header-muted {
		color: var(--muted-foreground);
		font-weight: 500;
		font-size: 13px;
	}

	.panel-tabs {
		display: flex;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		padding: 0 var(--spacing-sm);
		flex-shrink: 0;
	}

	.panel-tab {
		flex: 1;
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		white-space: nowrap;
	}

	.panel-tab.active {
		color: var(--foreground);
		border-bottom-color: var(--primary);
	}

	.panel-tab:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.inspector-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.inspector-empty {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: var(--spacing-md);
		font-size: 12px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.inspector-empty p {
		margin: 0;
	}

	.tab-panel {
		display: none;
		min-height: 0;
	}

	.tab-panel.active {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		height: 100%;
	}
</style>
