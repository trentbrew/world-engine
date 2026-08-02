<script lang="ts">
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import EntityList from '$lib/ui/EntityList.svelte';
	import RoomObjectsPanel from '$lib/ui/RoomObjectsPanel.svelte';
	import SceneInspector from '$lib/ui/SceneInspector.svelte';
	import SceneSelector from '$lib/ui/SceneSelector.svelte';
	import { ui, type RoomsPaneTab } from '$lib/ui/ui.svelte';

	let search = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const activeTab = $derived(ui.roomsPaneTab);
	/** Scene switcher moved to doc-bar crumbs; keep entry point flagged off. */
	const worldPickerVisible = false;

	const TABS: { id: RoomsPaneTab; label: string }[] = [
		{ id: 'room', label: 'Room' },
		{ id: 'instances', label: 'Instances' },
		{ id: 'objects', label: 'Objects' }
	];

	function panelId(tab: RoomsPaneTab): string {
		return `left-panel-${tab}`;
	}

	$effect(() => {
		void ui.objectSearchFocusRequest;
		if (activeTab !== 'instances') return;
		queueMicrotask(() => searchInput?.focus());
	});
</script>

<div class="left-panel" aria-label="Room editor">
	<div class="panel-tabs" role="tablist" aria-label="Room views">
		{#each TABS as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id="left-tab-{tab.id}"
				class="panel-tab"
				class:active={activeTab === tab.id}
				aria-selected={activeTab === tab.id}
				aria-controls={panelId(tab.id)}
				tabindex={activeTab === tab.id ? 0 : -1}
				onclick={() => ui.setRoomsPaneTab(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if activeTab === 'room'}
		{#if worldPickerVisible}
			<div class="world-picker">
				<SceneSelector embedded />
			</div>
		{/if}
		<div
			role="tabpanel"
			id={panelId('room')}
			class="panel-body panel-body--scroll"
			aria-labelledby="left-tab-room"
		>
			<SceneInspector />
		</div>
	{:else if activeTab === 'instances'}
		<div class="panel-search">
			<InputGroup.Root class="bg-background">
				<InputGroup.Addon align="inline-start">
					<SearchIcon class="size-3.5" aria-hidden="true" />
				</InputGroup.Addon>
				<InputGroup.Input
					type="search"
					placeholder="Search instances…"
					aria-label="Search room instances"
					class="text-xs"
					bind:value={search}
					bind:ref={searchInput}
				/>
			</InputGroup.Root>
		</div>
		<div
			role="tabpanel"
			id={panelId('instances')}
			class="panel-body panel-body--scroll"
			aria-labelledby="left-tab-instances"
		>
			<EntityList {search} showFooter />
		</div>
	{:else}
		<div
			role="tabpanel"
			id={panelId('objects')}
			class="panel-body panel-body--scroll"
			aria-labelledby="left-tab-objects"
		>
			<RoomObjectsPanel />
		</div>
	{/if}
</div>

<style>
	.left-panel {
		display: flex;
		flex-direction: column;
		flex: 0 1 auto;
		width: 100%;
		height: auto;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
		pointer-events: auto;
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

	.world-picker {
		padding: var(--spacing-sm);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		flex-shrink: 0;
	}

	.panel-search {
		padding: var(--spacing-sm);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		flex-shrink: 0;
	}

	.panel-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.panel-body--scroll {
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
