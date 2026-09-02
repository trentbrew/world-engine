<script lang="ts">
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
  import SendIcon from '@lucide/svelte/icons/send';
  import XIcon from '@lucide/svelte/icons/x';
  import { peerColor, peerInitials } from '$lib/engine/collab/peerColor';
  import { collab } from '$lib/engine/collab/collab.svelte';
  import { roomChat } from '$lib/engine/collab/roomChat.svelte';
  import { session } from '$lib/engine/net/session.svelte';
  import { playerClientId } from '$lib/engine/player/access';
  import { world } from '$lib/engine/runtime/world.svelte';
  import { playerInteractPrompt } from '$lib/engine/room/playerInteractPrompt.svelte';
  import { boxRimPoint, edgeBeaconPlacement, formatDistance } from '$lib/ui/edgeBeacon';
  import { ui } from '$lib/ui/ui.svelte';
  import VerticalResizeHandle from '$lib/ui/VerticalResizeHandle.svelte';

  interface Props {
    /** When false, toggle lives in the doc bar (edit mode). */
    showFab?: boolean;
  }

  let { showFab = true }: Props = $props();
  /** Edit mode only — play mode anchors above the walk-up partner's head. */
  const anchoredToDocBar = $derived(!showFab && ui.shellMode !== 'play');
  const interactPrompt = $derived(playerInteractPrompt.prompt);
  const anchoredToPlayer = $derived(ui.shellMode === 'play' && !!interactPrompt?.visible);
  const inPlayViewport = $derived(ui.shellMode === 'play');
  /** Chat partner walked off the viewport — pin to the rim with a wayfinder. */
  const pinnedToEdge = $derived(anchoredToPlayer && interactPrompt?.onScreen === false);
  const playerName = $derived.by(() => {
    if (!interactPrompt) return '';
    const entity = world.getEntity(interactPrompt.entityId);
    const peerId = entity ? playerClientId(entity) : null;
    return peerId ? collab.displayNameFor(peerId) : '';
  });

  const PANEL_MIN_W = 260;
  const PANEL_MAX_W = 480;
  const PANEL_MIN_H = 220;
  const PANEL_MAX_H = 640;

  /** Avatars shown in the roster strip before collapsing into a +N chip. */
  const MAX_ROSTER_AVATARS = 5;

  /** Re-send the typing edge at most this often while composing. */
  const TYPING_PING_MS = 2500;
  /** Idle this long after the last keystroke → broadcast "stopped typing". */
  const TYPING_IDLE_MS = 2000;
  /** Breathing room between edge-pinned panel and viewport rim. */
  const EDGE_PIN_INSET = 20;

  let draft = $state('');
  let messagesEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);
  let composerFocused = $state(false);
  let chatHeight = $state(360);
  let chatWidth = $state(320);
  let anchorStyle = $state('');
  /** Rim arrow (panel-local px + rotation) while pinned to the viewport edge. */
  let arrow = $state<{ x: number; y: number; deg: number } | null>(null);

  let typingSentAt = 0;
  let typingIdleTimer = 0;

  const open = $derived(roomChat.open);
  const unread = $derived(roomChat.unread);
  const peerLabel = $derived(
    session.connected ? `${session.peerCount} online` : 'offline',
  );
  const roomLabel = $derived(collab.roomAlias || collab.roomId || 'room');
  const sendDisabled = $derived(!draft.trim() || !session.connected);
  const partnerDistance = $derived(
    interactPrompt ? formatDistance(interactPrompt.distance) : '',
  );

  const participants = $derived.by(() => {
    void roomChat.members;
    const ids =
      ui.shellMode === 'play' && roomChat.members.length
        ? roomChat.members
        : session.connected
          ? session.members
          : [session.clientId].filter(Boolean);
    return ids.map((id) => {
      const self = id === session.clientId;
      const name = self ? 'You' : collab.displayNameFor(id);
      return {
        id,
        name,
        self,
        color: self ? collab.localAvatarColor() : peerColor(id),
        initials: self ? 'YO' : peerInitials(name),
      };
    });
  });
  const activeMessages = $derived.by(() => {
    void roomChat.messages.length;
    void roomChat.convoId;
    return roomChat.activeMessages();
  });
  const chatTitle = $derived.by(() => {
    if (ui.shellMode === 'edit') return 'Room chat';
    const others = roomChat.members.filter((id) => id !== session.clientId);
    if (others.length === 0) return 'Chat';
    if (others.length === 1) return `Chat with ${collab.displayNameFor(others[0])}`;
    if (others.length === 2) {
      return `Chat with ${collab.displayNameFor(others[0])}, ${collab.displayNameFor(others[1])}`;
    }
    return `Group chat (${roomChat.members.length})`;
  });
  const rosterLabel = $derived(
    participants.length === 1
      ? 'just you'
      : ui.shellMode === 'play'
        ? `${participants.length} in chat`
        : `${participants.length} here`,
  );
  const composerPlaceholder = $derived(
    session.connected
      ? ui.shellMode === 'play'
        ? 'Message the group…'
        : 'Message the room…'
      : 'Connect to chat…',
  );
  const rosterAvatars = $derived(participants.slice(0, MAX_ROSTER_AVATARS));
  const rosterOverflow = $derived(
    Math.max(0, participants.length - MAX_ROSTER_AVATARS),
  );

  const typingNames = $derived.by(() => {
    void roomChat.typing;
    return roomChat.typingNames();
  });
  const typingLabel = $derived.by(() => {
    const names = typingNames;
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return `${names.length} people are typing`;
  });

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

  function syncPlayerAnchor() {
    if (!anchoredToPlayer || !open || !interactPrompt) {
      anchorStyle = '';
      arrow = null;
      return;
    }

    const margin = 8;

    // Partner walked off-screen: park the panel on the viewport rim along the
    // center→partner ray and point an arrow down it (graph-beacon wayfinding).
    if (!interactPrompt.onScreen) {
      const place = edgeBeaconPlacement(
        window.innerWidth,
        window.innerHeight,
        interactPrompt.x,
        interactPrompt.y,
        chatWidth / 2 + margin + EDGE_PIN_INSET,
        chatHeight / 2 + margin + EDGE_PIN_INSET,
      );
      anchorStyle =
        `left:${place.x}px;top:${place.y}px;bottom:auto;right:auto;` +
        `transform:translate(-50%, -50%);`;
      const rim = boxRimPoint(chatWidth / 2, chatHeight / 2, place.angleRad, 22);
      arrow = {
        x: chatWidth / 2 + rim.x,
        y: chatHeight / 2 + rim.y,
        deg: (place.angleRad * 180) / Math.PI,
      };
      return;
    }

    // Hover the panel above the player's head (screen-projected by
    // PlayerInteractPromptProjector each frame), clearing the prompt pill.
    arrow = null;
    const offsetAbove = 40;
    const left = Math.min(
      Math.max(chatWidth / 2 + margin, interactPrompt.x),
      Math.max(chatWidth / 2 + margin, window.innerWidth - chatWidth / 2 - margin)
    );
    const topMin = chatHeight + offsetAbove + margin;
    const topMax = Math.max(topMin, window.innerHeight - margin + offsetAbove);
    const top = Math.min(Math.max(topMin, interactPrompt.y), topMax);
    anchorStyle =
      `left:${left}px;top:${top}px;bottom:auto;right:auto;` +
      `transform:translate(-50%, calc(-100% - ${offsetAbove}px));`;
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
    if (!open && ui.shellMode === 'edit') {
      roomChat.ensureRoomConvo(session.members);
    }
    roomChat.setOpen(!open);
  }

  function closePanel() {
    stopTyping();
    if (ui.shellMode === 'play') {
      const convoId = roomChat.leaveConvo();
      if (convoId) session.sendConvoLeave(convoId);
    } else {
      roomChat.closeConversation();
    }
  }

  /** Throttled "still typing" edge; auto-stops after an idle gap. */
  function noteTyping() {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (now - typingSentAt > TYPING_PING_MS) {
      typingSentAt = now;
      session.sendTyping(true);
    }
    clearTimeout(typingIdleTimer);
    typingIdleTimer = window.setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  function stopTyping() {
    if (typeof window !== 'undefined') clearTimeout(typingIdleTimer);
    typingIdleTimer = 0;
    roomChat.setLocalComposing(false);
    if (typingSentAt === 0) return;
    typingSentAt = 0;
    session.sendTyping(false);
  }

  function onDraftInput() {
    const composing = draft.trim().length > 0;
    roomChat.setLocalComposing(composing);
    if (composing) noteTyping();
    else stopTyping();
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    session.sendChat(text);
    draft = '';
    stopTyping();
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
    void activeMessages.length;
    void open;
    if (open) queueMicrotask(scrollToEnd);
  });

  $effect(() => {
    void open;
    void anchoredToDocBar;
    void anchoredToPlayer;
    void chatWidth;
    void chatHeight;
    // Projector updates these every frame — re-pin the panel as the partner moves.
    void interactPrompt?.x;
    void interactPrompt?.y;
    void interactPrompt?.onScreen;
    void interactPrompt?.distance;
    if (!open) {
      anchorStyle = '';
      arrow = null;
      return;
    }
    if (anchoredToPlayer) {
      syncPlayerAnchor();
      const onResize = () => syncPlayerAnchor();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    if (anchoredToDocBar) {
      syncDocBarAnchor();
      const onResize = () => syncDocBarAnchor();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    anchorStyle = '';
    arrow = null;
  });

  // Escape is two-stage: hand the keyboard back to the avatar first (so you can
  // walk away mid-conversation), then close on a second press.
  $effect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (inputEl && document.activeElement === inputEl) {
        inputEl.blur();
        return;
      }
      closePanel();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  });

  $effect(() => {
    if (!open) {
      stopTyping();
      return;
    }
    // Land the caret in the composer so opening the chat means "start talking".
    void session.connected;
    queueMicrotask(() => {
      if (open && inputEl && session.connected) inputEl.focus();
    });
  });

  $effect(() => () => stopTyping());
</script>

<div
  class="room-chat"
  class:room-chat--doc-bar={anchoredToDocBar}
  class:room-chat--viewport={inPlayViewport}
  role="group"
  aria-label="Room chat"
  style={open ? anchorStyle : undefined}
>
  {#if open}
    <div
      class="chat-panel"
      class:chat-morph={anchoredToPlayer && !pinnedToEdge}
      class:chat-panel--pinned={pinnedToEdge}
      id="room-chat-panel"
      role="dialog"
      aria-label="Room chat"
      style:height="{chatHeight}px"
      style:width="{chatWidth}px"
    >
      {#if anchoredToPlayer}
        <div class="chat-esc-hint">
          {composerFocused ? 'esc to move · esc again to exit' : 'esc to exit chat'}
        </div>
      {/if}
      {#if anchoredToPlayer}
        <VerticalResizeHandle edge="top" onResize={onChatResize} />
      {:else}
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
      {/if}
      <div class="chat-header">
        <div>
          <div class="chat-title">{chatTitle}</div>
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

      <div class="chat-roster" aria-label={ui.shellMode === 'play' ? 'In this conversation' : 'In this room'}>
        <div class="chat-roster-avatars">
          {#each rosterAvatars as person (person.id)}
            <span
              class="chat-roster-avatar"
              class:is-self={person.self}
              style:background={person.color}
              title={person.self ? `${person.name} (you)` : person.name}
            >
              {person.initials}
            </span>
          {/each}
          {#if rosterOverflow > 0}
            <span class="chat-roster-avatar chat-roster-more" title="More in room"
              >+{rosterOverflow}</span
            >
          {/if}
        </div>
        <span class="chat-roster-label">{rosterLabel}</span>
      </div>

      <div class="chat-messages" bind:this={messagesEl} aria-live="polite">
        {#if activeMessages.length === 0}
          <p class="chat-empty">
            {ui.shellMode === 'play'
              ? 'Say hi — they can hear you here.'
              : 'Say hi to collaborators in this room.'}
          </p>
        {:else}
          {#each activeMessages as line (line.peerId + ':' + line.at)}
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

      {#if typingLabel}
        <div class="chat-typing" role="status" aria-live="polite">
          <span class="chat-typing-dots" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span class="chat-typing-label">{typingLabel}</span>
        </div>
      {/if}

      <form class="chat-composer" onsubmit={onComposerSubmit}>
        <input
          type="text"
          maxlength="280"
          placeholder={composerPlaceholder}
          disabled={!session.connected}
          bind:this={inputEl}
          bind:value={draft}
          oninput={onDraftInput}
          onfocus={() => (composerFocused = true)}
          onblur={() => {
            composerFocused = false;
            stopTyping();
          }}
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

      {#if arrow && playerName}
        <div
          class="chat-wayfinder"
          style:left="{arrow.x}px"
          style:top="{arrow.y}px"
          aria-hidden="true"
        >
          <span class="chat-wayfinder-arrow" style:rotate="{arrow.deg}deg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
          <span class="chat-wayfinder-label">{playerName} · {partnerDistance}</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if showFab && !(anchoredToPlayer && open)}
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

  /* Play mode: live inside the 3D viewport overlay stack. */
  .room-chat--viewport {
    position: absolute;
    inset: auto;
    z-index: 10;
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

  /* The "Talk with …" pill morphs into the chat — panel grows up from its head anchor. */
  @keyframes chat-morph {
    0% {
      transform: scale(0.35);
      opacity: 0;
    }
    72% {
      transform: scale(1.06);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .chat-panel.chat-morph {
    transform-origin: 50% 100%;
    animation: chat-morph 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Tracking an off-screen partner — read as a wayfinder, not a speech bubble. */
  .chat-panel--pinned {
    border-color: color-mix(in srgb, var(--ring) 45%, var(--border));
    overflow: visible;
  }

  .chat-esc-hint {
    padding: 4px;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    color: var(--muted-foreground);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
    background: transparent;
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

  .chat-roster {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: 6px var(--spacing-md);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
    background: transparent;
  }

  .chat-roster-avatars {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .chat-roster-avatar {
    width: 20px;
    height: 20px;
    margin-right: -6px;
    border-radius: 50%;
    border: 1.5px solid color-mix(in srgb, var(--border) 55%, transparent);
    font-size: 8px;
    font-weight: 600;
    color: #fff;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .chat-roster-avatar.is-self {
    outline: 1.5px solid color-mix(in srgb, var(--ring) 70%, transparent);
    outline-offset: -1.5px;
  }

  .chat-roster-more {
    background: color-mix(in srgb, var(--secondary) 55%, transparent);
    color: var(--muted-foreground);
  }

  .chat-roster-label {
    font-size: 10px;
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .chat-typing {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px var(--spacing-md) 6px;
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .chat-typing-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-typing-dots {
    display: inline-flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .chat-typing-dots i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.35;
    animation: chat-typing-bounce 1.1s infinite ease-in-out;
  }

  .chat-typing-dots i:nth-child(2) {
    animation-delay: 0.15s;
  }

  .chat-typing-dots i:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes chat-typing-bounce {
    0%,
    60%,
    100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-2px);
    }
  }

  /* Rim wayfinder — points down the ray toward an off-screen chat partner. */
  .chat-wayfinder {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 6px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    white-space: nowrap;
  }

  .chat-wayfinder-arrow {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    background: color-mix(in srgb, var(--card) 92%, transparent);
    backdrop-filter: blur(8px);
    color: var(--foreground);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.35);
    flex-shrink: 0;
  }

  .chat-wayfinder-arrow svg {
    width: 16px;
    height: 16px;
  }

  .chat-wayfinder-label {
    padding: 3px 8px;
    border-radius: var(--rounded-pill);
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    background: color-mix(in srgb, var(--card) 92%, transparent);
    backdrop-filter: blur(8px);
    font-size: 10px;
    color: var(--muted-foreground);
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

    .chat-panel.chat-morph {
      animation: none;
    }

    .chat-typing-dots i {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
