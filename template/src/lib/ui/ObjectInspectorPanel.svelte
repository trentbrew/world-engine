<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { getType, isBuiltinType } from '$lib/engine/ontology/registry';
	import { isEditableObjectType } from '$lib/engine/runtime/typeAccess';
	import { world } from '$lib/engine/runtime/world.svelte';
	import ObjectTypeEditor from '$lib/ui/ObjectTypeEditor.svelte';
	import TypeBehaviorsPanel from '$lib/ui/TypeBehaviorsPanel.svelte';
	import TypeClipPanel from '$lib/ui/TypeClipPanel.svelte';
	import TypeSchedulePanel from '$lib/ui/TypeSchedulePanel.svelte';
	import { ui, type ObjectInspectorTab } from '$lib/ui/ui.svelte';

	const typeName = $derived(ui.selectedObjectType);
	const objectType = $derived.by(() => {
		const rev = ui.schemaRevision + world.typeRevision;
		return typeName && rev >= 0 ? getType(typeName) : undefined;
	});
	const readonly = $derived(typeName ? !isEditableObjectType(typeName) : true);
	const activeTab = $derived(ui.objectInspectorTab);

	const TABS: { id: ObjectInspectorTab; label: string; title: string }[] = [
		{ id: 'properties', label: 'Properties', title: 'Type defaults and capabilities' },
		{ id: 'events', label: 'Events', title: 'Type-level create / step / destroy events' },
		{ id: 'schedule', label: 'Schedule', title: 'Clip schedule' },
		{ id: 'clip', label: 'Clip', title: 'Type clip authoring' }
	];

	const visibleTabs = $derived(typeName ? TABS : TABS.filter((tab) => tab.id === 'properties'));

	$effect(() => {
		if (!visibleTabs.some((tab) => tab.id === ui.objectInspectorTab)) {
			ui.objectInspectorTab = 'properties';
		}
	});

	function selectTab(tab: ObjectInspectorTab) {
		ui.objectInspectorTab = tab;
	}

	function panelId(tab: ObjectInspectorTab): string {
		return `object-inspector-panel-${tab}`;
	}
</script>

<aside class="object-inspector-panel" aria-label="Object type inspector">
	<div class="inspector-header">
		{#if objectType && typeName}
			<div class="header-row">
				<span class="header-title">{typeName}</span>
				{#if isBuiltinType(typeName)}
					<Badge variant="outline" class="type-badge">Built-in</Badge>
				{:else}
					<Badge variant="outline" class="type-badge">Custom</Badge>
				{/if}
			</div>
		{:else}
			<span class="header-muted">No object type selected</span>
		{/if}
	</div>

	<div class="panel-tabs" role="tablist" aria-label="Object type inspector views">
		{#each visibleTabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id="object-inspector-tab-{tab.id}"
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
			id={panelId('properties')}
			class="tab-panel"
			class:active={activeTab === 'properties'}
			hidden={activeTab !== 'properties'}
			aria-labelledby="object-inspector-tab-properties"
		>
			<ObjectTypeEditor embedded />
		</div>

		{#if typeName}
			<div
				role="tabpanel"
				id={panelId('events')}
				class="tab-panel"
				class:active={activeTab === 'events'}
				hidden={activeTab !== 'events'}
				aria-labelledby="object-inspector-tab-events"
			>
				<TypeBehaviorsPanel {typeName} {readonly} />
			</div>

			<div
				role="tabpanel"
				id={panelId('schedule')}
				class="tab-panel"
				class:active={activeTab === 'schedule'}
				hidden={activeTab !== 'schedule'}
				aria-labelledby="object-inspector-tab-schedule"
			>
				<TypeSchedulePanel {typeName} {readonly} />
			</div>

			<div
				role="tabpanel"
				id={panelId('clip')}
				class="tab-panel"
				class:active={activeTab === 'clip'}
				hidden={activeTab !== 'clip'}
				aria-labelledby="object-inspector-tab-clip"
			>
				<TypeClipPanel {typeName} {readonly} />
			</div>
		{/if}
	</div>
</aside>

<style>
	.object-inspector-panel {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
		height: auto;
		max-height: 100%;
		width: 100%;
		flex: 0 1 auto;
		pointer-events: auto;
		box-sizing: border-box;
		padding: var(--spacing-sm);
	}

	.inspector-header {
		padding: 0 0 var(--spacing-sm);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		flex-shrink: 0;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.header-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		font-size: 13px;
	}

	.header-muted {
		color: var(--muted-foreground);
		font-weight: 500;
		font-size: 13px;
	}

	:global(.type-badge) {
		font-family: var(--font-mono);
		font-size: 10px;
		flex-shrink: 0;
	}

	.panel-tabs {
		display: flex;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		padding: 0;
		flex-shrink: 0;
	}

	.panel-tab {
		flex: 1;
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		padding: 8px 6px;
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
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.tab-panel {
		display: none;
		min-height: 0;
		flex: 1 1 auto;
		overflow: hidden;
	}

	.tab-panel.active {
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: var(--spacing-sm);
	}

	.tab-panel :global(.object-type-editor),
	.tab-panel :global(.type-behaviors),
	.tab-panel :global(.type-schedule),
	.tab-panel :global(.type-clip) {
		flex: 1 1 auto;
		min-height: 0;
		height: auto;
		max-height: none;
	}
</style>
