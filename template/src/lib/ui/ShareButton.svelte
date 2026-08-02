<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { browser } from '$app/environment';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { collab } from '$lib/engine/collab/collab.svelte';
  import { toast } from '$lib/ui/toast.svelte';

  interface Props {
    /** Overlap at the end of the peer avatar stack. */
    stacked?: boolean;
    /** z-index within the avatar stack (rightmost / on top). */
    stackZIndex?: number;
  }

  let { stacked = false, stackZIndex = 1 }: Props = $props();

  let open = $state(false);

  const roomLink = $derived(browser ? window.location.href : '');
  const roomLabel = $derived(collab.roomAlias || collab.roomId || 'Room');

  async function copyRoomLink() {
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(roomLink);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="share-btn"
        class:stacked
        class:active={open}
        style:z-index={stacked ? stackZIndex : undefined}
        aria-label="Share room"
        aria-expanded={open}
        title="Share room"
      >
        <PlusIcon class="share-btn-icon" aria-hidden="true" />
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="share-popover" align="end" sideOffset={8}>
    <div class="share-panel">
      <p class="share-title">Share room</p>
      <p class="share-room">
        <span class="share-room-name">{roomLabel}</span>
        {#if collab.roomId}
          <span class="share-room-id">{collab.roomId}</span>
        {/if}
      </p>
      <label class="share-field">
        <span class="share-label">Invite link</span>
        <input class="share-input" type="text" readonly value={roomLink} />
      </label>
      <button type="button" class="share-copy-btn" onclick={copyRoomLink}>
        <CopyIcon class="size-3.5" aria-hidden="true" />
        Copy link
      </button>
    </div>
  </Popover.Content>
</Popover.Root>

<style>
  .share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: var(--rounded-pill);
    background: var(--card);
    color: var(--muted-foreground);
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
  }

  .share-btn.stacked {
    box-sizing: border-box;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    margin-left: -10px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--foreground) 22%, var(--border));
    background: var(--secondary);
    color: var(--foreground);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.28);
    position: relative;
  }

  .share-btn:hover,
  .share-btn.active {
    background: var(--accent);
    color: var(--foreground);
    border-color: var(--card);
  }

  .share-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  :global(.share-btn-icon) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .share-btn.stacked :global(.share-btn-icon) {
    width: 16px;
    height: 16px;
  }

  :global(.share-popover) {
    width: min(320px, calc(100vw - 24px));
    padding: 12px;
  }

  .share-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .share-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
  }

  .share-room {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .share-room-name {
    font-size: 12px;
    color: var(--foreground);
  }

  .share-room-id {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .share-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .share-label {
    font-size: 11px;
    color: var(--muted-foreground);
  }

  .share-input {
    width: 100%;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--background);
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .share-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .share-copy-btn:hover {
    background: var(--accent);
  }
</style>
