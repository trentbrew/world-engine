<script lang="ts">
  import { agentFocusLabels } from '$lib/engine/render/agentFocusLabels.svelte';
  import { ui } from '$lib/ui/ui.svelte';
</script>

{#if ui.chrome.agentFocus && agentFocusLabels.labels.length > 0}
  <div class="agent-badge-layer" aria-hidden="true">
    {#each agentFocusLabels.labels as badge (badge.key)}
      {#if badge.visible}
        <span
          class="agent-badge"
          style:left="{badge.x}px"
          style:top="{badge.y}px"
          style:background="color-mix(in srgb, {badge.color} 85%, transparent)"
          style:border-color="color-mix(in srgb, {badge.color} 50%, transparent)"
        >
          <span class="agent-badge-kind">AGENT</span>
          <span class="agent-badge-dot" aria-hidden="true">·</span>
          <span class="agent-badge-name">{badge.displayName}</span>
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .agent-badge-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    overflow: hidden;
  }

  .agent-badge {
    position: absolute;
    transform: translate(-50%, -120%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--rounded-pill);
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    background: color-mix(in srgb, var(--card) 88%, transparent);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
    backdrop-filter: blur(8px);
    color: #ffffff;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
  }

  .agent-badge-kind {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .agent-badge-dot {
    opacity: 0.6;
    font-weight: 400;
  }

  .agent-badge-name {
    font-size: 12px;
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-badge {
      transition: none;
    }
  }
</style>
