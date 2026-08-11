<script lang="ts">
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
  import SendIcon from '@lucide/svelte/icons/send';
  import XIcon from '@lucide/svelte/icons/x';
  import { peerInitials } from '$lib/engine/collab/peerColor';
  import { collab } from '$lib/engine/collab/collab.svelte';
  import { roomChat } from '$lib/engine/collab/roomChat.svelte';
  import { session } from '$lib/engine/net/session.svelte';
  import VerticalResizeHandle from '$lib/ui/VerticalResizeHandle.svelte';

  interface Props {
    /** When false, toggle lives in the doc bar (edit mode). */
    showFab?: boolean;
  }

  let { showFab = true }: Props = $props();
  const anchoredToDocBar = $derived(!showFab);

  const PANEL_MIN_W = 260;
  const PANEL_MAX_W = 480;
  const PANEL_MIN_H = 220;
  const PANEL_MAX_H = 640;

  let draft = $state('');
  let messagesEl = $state<HTMLDivElement | null>(null);
  let chatHeight = $state(360);
  let chatWidth = $state(320);
  let anchorStyle = $state('');

  const open = $derived(roomChat.open);
  const unread = $derived(roomChat.unread);
  const peerLabel = $derived(
    session.connected ? `${session.peerCount} online` : 'offline',
  );
  const roomLabel = $derived(collab.roomAlias || collab.roomId || 'room');
  const sendDisabled = $derived(!draft.trim() || !session.connected);

  function clampWidth(width: number): number {
    return Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, Math.round(width)));
  }

  function clampHeight(height: number): number {
    return Math.min(PANEL_MAX_H, Math.max(PANEL_MIN_H, Math.round(height)));
  }

  function syncDocBarAnchor() {
    if (!anchoredToDocBar || !open || typeof document === 'undefined') {
      anchorStyle = '';
      return;
    }
    const el = document.getElementById('doc-bar-chat-anchor');
    if (!el) {
      anchorStyle = '';
      return;
    }
    const rect = el.getBoundingClientRect();
    // Right-align panel to the chat button's right edge, clamp to viewport.
    const right = Math.max(8, window.innerWidth - rect.right);
    const top = Math.max(8, rect.bottom + 6);
    const maxRight = Math.max(8, window.innerWidth - chatWidth - 8);
    const clampedRight = Math.min(right, maxRight);
    anchorStyle = `top:${top}px;right:${clampedRight}px;bottom:auto;`;
  }

  function onChatResize(delta: number) {
    chatHeight = clampHeight(chatHeight + delta);
  }

  function onCornerPointerDown(event: PointerEvent, corner: 'sw' | 'se') {
    event.preventDefault();
    event.stopPropagation();
    let lastX = event.clientX;
    let lastY = event.clientY;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      // Panel is right-anchored — SE grows wider with +dx; SW grows with -dx.
      chatWidth = clampWidth(chatWidth + (corner === 'se' ? dx : -dx));
      chatHeight = clampHeight(chatHeight + dy);
      if (anchoredToDocBar) syncDocBarAnchor();
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function scrollToEnd() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function toggleOpen() {
    roomChat.setOpen(!open);
  }

  function closePanel() {
    roomChat.setOpen(false);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    session.sendChat(text);
    draft = '';
  }

  function onComposerSubmit(event: SubmitEvent) {
    event.preventDefault();
    sendMessage();
  }

  function formatTime(at: number): string {
    return new Date(at).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  $effect(() => {
    void roomChat.messages.length;
    void open;
    if (open) queueMicrotask(scrollToEnd);
  });

  $effect(() => {
    void open;
    void anchoredToDocBar;
    void chatWidth;
    if (!anchoredToDocBar || !open) {
      anchorStyle = '';
      return;
    }
    syncDocBarAnchor();
    const onResize = () => syncDocBarAnchor();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  $effect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  });
</script>

<div
  class="room-chat"
  class:room-chat--doc-bar={anchoredToDocBar}
  role="group"
  aria-label="Room chat"
  style={anchoredToDocBar && open ? anchorStyle : undefined}
>
  {#if open}
    <div
      class="chat-panel"
      id="room-chat-panel"
      role="dialog"
      aria-label="Room chat"
      style:height="{chatHeight}px"
      style:width="{chatWidth}px"
    >
      {#if anchoredToDocBar}
        <VerticalResizeHandle edge="bottom" onResize={onChatResize} />
        <button
          type="button"
          class="chat-corner chat-corner--sw"
          aria-label="Resize chat from bottom-left"
          onpointerdown={(e) => onCornerPointerDown(e, 'sw')}
        ></button>
        <button
          type="button"
          class="chat-corner chat-corner--se"
          aria-label="Resize chat from bottom-right"
          onpointerdown={(e) => onCornerPointerDown(e, 'se')}
        ></button>
      {:else}
        <VerticalResizeHandle edge="top" onResize={onChatResize} />
      {/if}
      <div class="chat-header">
        <div>
          <div class="chat-title">Room chat</div>
          <div class="chat-meta">{peerLabel} · {roomLabel}</div>
        </div>
        <button
          type="button"
          class="chat-close"
          aria-label="Close chat"
          onclick={closePanel}
        >
          <XIcon aria-hidden="true" />
        </button>
      </div>

      <div class="chat-messages" bind:this={messagesEl} aria-live="polite">
        {#if roomChat.messages.length === 0}
          <p class="chat-empty">Say hi to collaborators in this room.</p>
        {:else}
          {#each roomChat.messages as line (line.peerId + ':' + line.at)}
            <div class="chat-message" class:mine={line.mine}>
              <div
                class="chat-avatar"
                style:background={line.color}
                title={line.name}
              >
                {peerInitials(line.name)}
              </div>
              <div class="chat-bubble-wrap">
                <span class="chat-author">{line.mine ? 'You' : line.name}</span>
                <div class="chat-bubble">{line.text}</div>
                <span class="chat-time">{formatTime(line.at)}</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <form class="chat-composer" onsubmit={onComposerSubmit}>
        <input
          type="text"
          maxlength="280"
          placeholder={session.connected
            ? 'Message the room…'
            : 'Connect to chat…'}
          disabled={!session.connected}
          bind:value={draft}
          aria-label="Chat message"
        />
        <button
          type="submit"
          class="chat-send"
          aria-label="Send message"
          disabled={sendDisabled}
        >
          <SendIcon aria-hidden="true" />
        </button>
      </form>
    </div>
  {/if}

  {#if showFab}
    <button
      type="button"
      class="chat-fab"
      aria-expanded={open}
      aria-controls="room-chat-panel"
      aria-label={open
        ? 'Close room chat'
        : unread > 0
          ? `Open room chat, ${unread} unread`
          : 'Open room chat'}
      onclick={toggleOpen}
    >
      <MessageCircleIcon aria-hidden="true" />
      {#if unread > 0 && !open}
        <span class="chat-unread" aria-hidden="true"
          >{unread > 9 ? '9+' : unread}</span
        >
      {/if}
    </button>
  {/if}
</div>

<style>
  .room-chat {
    position: fixed;
    right: calc(var(--viewport-chrome-inset-right, 0px) + var(--float-inset));
    bottom: calc(var(--chrome-bottom-outer) + var(--rail-bottom-band, 0px) + var(--spacing-sm));
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-sm);
    pointer-events: auto;
  }

  /* Edit mode: position is set inline from #doc-bar-chat-anchor rect. */
  .room-chat--doc-bar {
    bottom: auto;
  }

  @media (max-width: 767px) {
    .room-chat {
      display: none;
    }
  }

  .chat-panel {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--rounded-lg);
    overflow: hidden;
  }

  .chat-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
    background: color-mix(in srgb, var(--surface-glass) 48%, transparent);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    border: 1px solid color-mix(in srgb, var(--border) 38%, transparent);
    box-shadow:
      0 12px 40px rgb(0 0 0 / 0.22),
      0 2px 8px rgb(0 0 0 / 0.12);
  }

  .chat-panel :global(.vertical-resize-handle.edge-bottom) {
    bottom: 0;
  }

  .chat-panel :global(.vertical-resize-handle.edge-top) {
    top: 0;
  }

  .chat-corner {
    position: absolute;
    width: 14px;
    height: 14px;
    padding: 0;
    border: none;
    background: transparent;
    z-index: 3;
    pointer-events: auto;
  }

  .chat-corner--sw {
    left: 0;
    bottom: 0;
    cursor: nesw-resize;
  }

  .chat-corner--se {
    right: 0;
    bottom: 0;
    cursor: nwse-resize;
  }

  .chat-corner--se::after,
  .chat-corner--sw::after {
    content: '';
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 1px;
    opacity: 0.35;
    border-color: var(--muted-foreground);
    border-style: solid;
  }

  .chat-corner--se::after {
    right: 3px;
    bottom: 3px;
    border-width: 0 1.5px 1.5px 0;
  }

  .chat-corner--sw::after {
    left: 3px;
    bottom: 3px;
    border-width: 0 0 1.5px 1.5px;
  }

  .chat-corner:hover::after,
  .chat-corner:focus-visible::after {
    opacity: 0.85;
    border-color: var(--foreground);
  }

  .chat-corner:focus-visible {
    outline: none;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
    background: transparent;
  }

  .chat-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground);
  }

  .chat-meta {
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .chat-close {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--rounded-sm);
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .chat-close:hover {
    background: color-mix(in srgb, var(--secondary) 55%, transparent);
    color: var(--foreground);
  }

  .chat-close :global(svg) {
    width: 14px;
    height: 14px;
  }

  .chat-messages {
    flex: 1;
    min-height: 120px;
    overflow: auto;
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chat-empty {
    margin: auto;
    font-size: 11px;
    color: var(--muted-foreground);
    text-align: center;
    padding: var(--spacing-md);
  }

  .chat-message {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .chat-message.mine {
    flex-direction: row-reverse;
  }

  .chat-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid var(--border);
    font-size: 8px;
    font-weight: 600;
    color: var(--primary-foreground);
    display: grid;
    place-items: center;
  }

  .chat-bubble-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    max-width: calc(100% - 30px);
  }

  .chat-message.mine .chat-bubble-wrap {
    align-items: flex-end;
  }

  .chat-author {
    font-size: 10px;
    color: var(--muted-foreground);
    padding: 0 4px;
  }

  .chat-bubble {
    padding: 6px 10px;
    border-radius: var(--rounded-md);
    background: color-mix(in srgb, var(--secondary) 52%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    color: var(--foreground);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
  }

  .chat-message.mine .chat-bubble {
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    border: 1px solid color-mix(in srgb, var(--primary) 28%, transparent);
  }

  .chat-time {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--muted-foreground);
    padding: 0 4px;
  }

  .chat-composer {
    display: flex;
    gap: 6px;
    padding: var(--spacing-sm);
    border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
    background: transparent;
  }

  .chat-composer input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: var(--rounded-pill);
    border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    background: color-mix(in srgb, var(--card) 32%, transparent);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    color: var(--foreground);
  }

  .chat-composer input::placeholder {
    color: var(--muted-foreground);
  }

  .chat-composer input:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent);
  }

  .chat-composer input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .chat-send {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--primary);
    color: var(--primary-foreground);
    cursor: pointer;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .chat-send:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .chat-send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .chat-send :global(svg) {
    width: 14px;
    height: 14px;
  }

  .chat-fab {
    position: relative;
    isolation: isolate;
    width: 48px;
    height: 48px;
    border: 1px solid transparent;
    border-radius: 50%;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .chat-fab::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
    background: color-mix(in srgb, var(--surface-glass) 48%, transparent);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid color-mix(in srgb, var(--border) 38%, transparent);
    box-shadow: 0 4px 20px rgb(0 0 0 / 0.14);
  }

  .chat-fab:hover::before {
    background: color-mix(in srgb, var(--surface-glass) 62%, transparent);
  }

  .chat-fab[aria-expanded='true']::before {
    background: color-mix(in srgb, var(--surface-glass) 68%, transparent);
    border-color: color-mix(in srgb, var(--ring) 45%, var(--border));
  }

  .chat-fab:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .chat-fab :global(svg) {
    width: 22px;
    height: 22px;
  }

  .chat-unread {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: var(--rounded-pill);
    background: var(--destructive);
    color: white;
    font-size: 9px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    border: 2px solid var(--card);
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-fab,
    .chat-panel {
      transition: none;
    }
  }
</style>
