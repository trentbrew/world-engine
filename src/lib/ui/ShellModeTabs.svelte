<script lang="ts">
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlayIcon from '@lucide/svelte/icons/play';
  import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
  import {
    formatBinding,
    primaryBinding,
  } from '$lib/engine/input/shortcutBinding';
  import { ui, type ShellMode } from '$lib/ui/ui.svelte';

  const mode = $derived(ui.shellMode);
  const playShortcut = $derived(
    formatBinding(primaryBinding('togglePlay', inputPrefs.shortcuts)),
  );

  function selectMode(next: Exclude<ShellMode, 'publish'>) {
    if (next === 'play') {
      if (mode !== 'play') ui.enterPlay();
      return;
    }
    if (mode !== 'edit') ui.exitToEdit();
  }
</script>

<div class="shell-mode-tabs" role="tablist" aria-label="Editor mode">
  <button
    type="button"
    role="tab"
    class="shell-mode-tab"
    aria-selected={mode === 'edit'}
    class:active={mode === 'edit'}
    onclick={() => selectMode('edit')}
  >
    <PencilIcon class="tab-icon" aria-hidden="true" />
    <span>Edit</span>
    <kbd class="tab-kbd">Esc</kbd>
  </button>
  <button
    type="button"
    role="tab"
    class="shell-mode-tab"
    aria-selected={mode === 'play'}
    class:active={mode === 'play'}
    onclick={() => selectMode('play')}
  >
    <PlayIcon class="tab-icon" aria-hidden="true" />
    <span>Play</span>
    <kbd class="tab-kbd">{playShortcut}</kbd>
  </button>
</div>

<style>
  .shell-mode-tabs {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    width: fit-content;
    height: var(--doc-bar-height);
    gap: 2px;
    padding: 2px;
    border-radius: var(--rounded-pill);
    background: var(--chrome-pill-bg);
    border: 1px solid var(--border);
    flex-shrink: 0;
  }

  .shell-mode-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 26px;
    min-width: 68px;
    padding: 0 12px;
    border: none;
    border-radius: var(--rounded-pill);
    background: transparent;
    color: var(--muted-foreground);
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .shell-mode-tab:hover:not(.active) {
    color: var(--foreground);
  }

  .shell-mode-tab.active {
    background: var(--primary);
    color: var(--primary-foreground);
    box-shadow: 0 1px 2px color-mix(in srgb, black 24%, transparent);
  }

  .tab-kbd {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 500;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    opacity: 0.72;
  }

  .shell-mode-tab.active .tab-kbd {
    border-color: color-mix(in srgb, currentColor 30%, transparent);
    background: color-mix(in srgb, currentColor 14%, transparent);
    opacity: 0.9;
  }

  .shell-mode-tab:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  :global(.tab-icon) {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    opacity: 0.85;
  }
</style>
