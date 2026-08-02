<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import { getType } from '$lib/engine/ontology/registry';
  import { world } from '$lib/engine/runtime/world.svelte';
  import { ui, type RightInspectorTab } from '$lib/ui/ui.svelte';
  import EntityAttributes from '$lib/ui/EntityAttributes.svelte';
  import EntityOpsPanel from '$lib/ui/EntityOpsPanel.svelte';
  import EntityJsonPanel from '$lib/ui/EntityJsonPanel.svelte';
  import InspectorEmptyState from '$lib/ui/InspectorEmptyState.svelte';

  interface Props {
    /**
     * When false (default), Properties render directly with no tab bar.
     * Ops and JSON panels stay in the tree and mount when this is true.
     */
    inspectorTabsVisible?: boolean;
  }

  let { inspectorTabsVisible = false }: Props = $props();

  const TABS: { id: RightInspectorTab; label: string; title: string }[] = [
    { id: 'properties', label: 'Props', title: 'Properties' },
    { id: 'ops', label: 'Ops', title: 'Durable ops log' },
    { id: 'json', label: 'JSON', title: 'Entity JSON editor' },
  ];

  const selected = $derived(world.selectedEntity);
  const activeTab = $derived(ui.entityInspectorTab);
  const objectTypeName = $derived(selected?.type ?? null);
  const canOpenObjectType = $derived(!!objectTypeName && !!getType(objectTypeName));

  $effect(() => {
    if (!inspectorTabsVisible) {
      ui.entityInspectorTab = 'properties';
      return;
    }
    if (!TABS.some((tab) => tab.id === ui.entityInspectorTab)) {
      ui.entityInspectorTab = 'properties';
    }
  });

  function shortId(id: string): string {
    const parts = id.split('/');
    return parts[parts.length - 1] ?? id;
  }

  function selectTab(tab: RightInspectorTab) {
    if (!selected) return;
    ui.entityInspectorTab = tab;
  }

  function panelId(tab: RightInspectorTab): string {
    return `inspector-panel-${tab}`;
  }

  function openInObjects() {
    if (!objectTypeName) return;
    ui.openObjectTypeInObjects(objectTypeName);
  }
</script>

<aside class="right-panel" aria-label="Inspector">
  <div class="inspector-header">
    {#if selected}
      <div class="header-row">
        <span class="header-title">{selected.type ?? 'Entity'}</span>
        {#if canOpenObjectType}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  class="open-objects-btn"
                  aria-label="Open {objectTypeName} in Objects"
                  title="Open {objectTypeName} in Objects"
                  onclick={openInObjects}
                >
                  <ExternalLinkIcon class="size-3.5" aria-hidden="true" />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="bottom" sideOffset={6} class="text-xs">
              Open type in Objects
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
        <Badge variant="outline" class="entity-id-badge"
          >{shortId(selected.id)}</Badge
        >
      </div>
    {:else}
      <span class="header-muted">No selection</span>
    {/if}
  </div>

  {#if selected}
    {#if inspectorTabsVisible}
      <div class="panel-tabs" role="tablist" aria-label="Inspector views">
        {#each TABS as tab (tab.id)}
          <button
            type="button"
            role="tab"
            id="inspector-tab-{tab.id}"
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

      <div class="inspector-body entity">
        <div
          role="tabpanel"
          id={panelId('properties')}
          class="tab-panel"
          class:active={activeTab === 'properties'}
          hidden={activeTab !== 'properties'}
          aria-labelledby="inspector-tab-properties"
        >
          <EntityAttributes embedded />
        </div>

        <div
          role="tabpanel"
          id={panelId('ops')}
          class="tab-panel"
          class:active={activeTab === 'ops'}
          hidden={activeTab !== 'ops'}
          aria-labelledby="inspector-tab-ops"
        >
          <EntityOpsPanel entityId={selected.id} />
        </div>

        <div
          role="tabpanel"
          id={panelId('json')}
          class="tab-panel"
          class:active={activeTab === 'json'}
          hidden={activeTab !== 'json'}
          aria-labelledby="inspector-tab-json"
        >
          <EntityJsonPanel entity={selected} />
        </div>
      </div>
    {:else}
      <div class="inspector-body entity">
        <EntityAttributes embedded />
      </div>
    {/if}
  {:else}
    <div class="inspector-empty">
      <InspectorEmptyState
        title="Select an entity"
        hint="Pick an object in the viewport or Objects list. Scene settings live in the Scene tab on the left."
      />
    </div>
  {/if}
</aside>

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    width: 100%;
    height: auto;
    max-height: 100%;
    flex: 0 1 auto;
    pointer-events: auto;
  }

  .inspector-header {
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .header-title {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-muted {
    color: var(--muted-foreground);
    font-weight: 500;
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

  :global(.entity-id-badge) {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    height: auto;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    flex-shrink: 0;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.open-objects-btn) {
    width: 26px;
    height: 26px;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  :global(.open-objects-btn:hover:not(:disabled)) {
    color: var(--foreground);
  }

  .inspector-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .inspector-body.entity {
    animation: fade-in 120ms ease;
  }

  .inspector-empty {
    flex: 0 1 auto;
    min-height: 0;
    overflow: auto;
    padding: var(--spacing-md);
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
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .inspector-body.entity {
      animation: none;
    }
  }
</style>
