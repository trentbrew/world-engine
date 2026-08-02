<script lang="ts">
  import ActivityIcon from '@lucide/svelte/icons/activity';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { scheduler } from '$lib/engine/systems';
  import { debugLog } from '$lib/ui/debug/debugLog.svelte';
  import DebugStatsTab from '$lib/ui/debug/DebugStatsTab.svelte';

  let {
    embedded = false,
    placement = 'bottom-left'
  }: {
    embedded?: boolean;
    placement?: 'bottom-left' | 'top-right';
  } = $props();

  let expanded = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const pillAriaLabel = $derived(
    `Developer HUD, Stats, tick ${scheduler.tick}, ${expanded ? 'collapse' : 'expand'}`,
  );

  $effect(() => {
    debugLog.setCollapsed(!expanded);
  });

  function toggleExpanded() {
    expanded = !expanded;
    if (expanded) debugLog.markSeen();
  }

  function collapse() {
    expanded = false;
  }

  function onRootKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && expanded) {
      event.stopPropagation();
      collapse();
    }
  }

  $effect(() => {
    if (!expanded) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      collapse();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="debug-console"
  class:embedded
  class:top-right={placement === 'top-right'}
  role="group"
  bind:this={rootEl}
  onkeydown={onRootKeydown}
>
  <button
    type="button"
    class="debug-pill"
    aria-expanded={expanded}
    aria-label={pillAriaLabel}
    onclick={toggleExpanded}
  >
    <ActivityIcon class="pill-icon" aria-hidden="true" />
    <span class="pill-tab">Stats</span>
    <span class="pill-sep" aria-hidden="true">·</span>
    <span class="pill-metric">tick {scheduler.tick}</span>
    <ChevronDownIcon class="pill-chev" aria-hidden="true" />
  </button>

  {#if expanded}
    <div class="debug-panel" role="region" aria-label="Stats">
      <div class="panel-header">
        <span class="panel-title">Stats</span>
        <button type="button" class="collapse-btn" aria-label="Collapse" onclick={collapse}>
          −
        </button>
      </div>
      <div class="panel-body">
        <DebugStatsTab />
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-console {
    position: absolute;
    bottom: var(--float-inset);
    left: var(--float-inset);
    z-index: 10;
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-start;
    gap: 8px;
    pointer-events: auto;
  }

  .debug-console.top-right {
    position: static;
    bottom: auto;
    left: auto;
    flex-direction: column;
    align-items: flex-end;
  }

  .debug-console.embedded {
    position: static;
    z-index: auto;
  }

  @media (max-width: 767px) {
    .debug-console {
      display: none;
    }
  }

  .debug-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px 0 8px;
    border-radius: var(--rounded-pill);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.24);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .debug-pill:hover {
    background: var(--secondary);
  }

  .debug-pill:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  :global(.pill-icon) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.85;
  }

  .pill-tab {
    color: var(--muted-foreground);
  }

  .pill-sep {
    color: var(--muted-foreground);
    opacity: 0.5;
  }

  .pill-metric {
    font-family: var(--font-mono);
    font-weight: 500;
  }

  :global(.pill-chev) {
    width: 14px;
    height: 14px;
    opacity: 0.5;
    margin-left: 2px;
  }

  .debug-panel {
    display: flex;
    flex-direction: column;
    width: 300px;
    height: 220px;
    border-radius: var(--rounded-lg);
    border: 1px solid var(--border);
    background: var(--card);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.28);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    padding: 0 4px 0 var(--spacing-sm);
    flex-shrink: 0;
    min-height: 36px;
  }

  .panel-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--foreground);
  }

  .collapse-btn {
    width: 28px;
    height: 28px;
    margin: 4px 4px 4px 0;
    border: none;
    border-radius: var(--rounded-sm);
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  .collapse-btn:hover {
    background: var(--secondary);
    color: var(--foreground);
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .debug-pill,
    .debug-panel {
      transition: none;
    }
  }
</style>

