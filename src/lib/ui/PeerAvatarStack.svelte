<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { peerColor, peerInitials } from '$lib/engine/collab/peerColor';
  import { collab } from '$lib/engine/collab/collab.svelte';
  import { session } from '$lib/engine/net/session.svelte';

  const MAX_VISIBLE = 5;

  type AvatarPeer = {
    id: string;
    name: string;
    color: string;
    initials: string;
    self: boolean;
    isHost: boolean;
  };

  const peers = $derived.by((): AvatarPeer[] => {
    const hostId = session.host;
    const selfId = session.clientId;
    const sorted = [...session.members].sort((a, b) => a.localeCompare(b));
    const others = sorted.filter((id) => id !== selfId && id !== hostId);
    const ordered = [
      ...(hostId ? [hostId] : []),
      ...others,
      ...(selfId && selfId !== hostId ? [selfId] : []),
    ];
    return ordered.map((id) => {
      const wireName =
        id === session.clientId
          ? collab.localDisplayName()
          : session.peerSelections[id]?.name;
      const name = collab.displayNameFor(id, wireName ?? '');
      return {
        id,
        name,
        color:
          id === session.clientId ? collab.localAvatarColor() : peerColor(id),
        initials: peerInitials(name),
        self: id === session.clientId,
        isHost: id === hostId,
      };
    });
  });

  const visiblePeers = $derived(peers.slice(0, MAX_VISIBLE));
  const overflow = $derived(Math.max(0, peers.length - MAX_VISIBLE));
</script>

<div class="avatar-stack" role="list" aria-label="Collaborators in room">
  {#each visiblePeers as peer, index (peer.id)}
    <div
      role="listitem"
      class="stack-item"
      class:overlap={index > 0}
      style:z-index={index + 1}
      title={peer.self
        ? peer.isHost
          ? `${peer.name} (host) — edit identity`
          : `${peer.name} — edit identity`
        : peer.isHost
          ? `${peer.name} (host)`
          : peer.name}
    >
      {#if peer.self}
        <button
          type="button"
          class="avatar-btn"
          aria-label={peer.isHost
            ? `${peer.name}, host, edit identity`
            : `${peer.name}, edit identity`}
          onclick={() => collab.openIdentityDialog()}
        >
          <div
            class="avatar-wrapper"
            class:host={peer.isHost}
            style:background={peer.color}
          >
            <Avatar.Root class="avatar">
              <Avatar.Fallback class="avatar-fallback">
                {peer.initials}
              </Avatar.Fallback>
              {#if peer.isHost}
                <div class="host-badge">
                  <CrownIcon />
                </div>
              {/if}
            </Avatar.Root>
          </div>
        </button>
      {:else}
        <div
          class="avatar-wrapper"
          class:host={peer.isHost}
          style:background={peer.color}
          aria-hidden="true"
        >
          <Avatar.Root class="avatar">
            <Avatar.Fallback class="avatar-fallback">
              {peer.initials}
            </Avatar.Fallback>
            {#if peer.isHost}
              <div class="host-badge">
                <CrownIcon />
              </div>
            {/if}
          </Avatar.Root>
        </div>
      {/if}
    </div>
  {/each}
  {#if overflow > 0}
    <span
      class="stack-item overlap avatar overflow"
      style:z-index={visiblePeers.length + 1}
      aria-label="{overflow} more collaborators"
    >
      +{overflow}
    </span>
  {/if}
</div>

<style>
  .avatar-stack {
    display: flex;
    align-items: center;
    position: relative;
    z-index: 2;
  }

  .stack-item {
    position: relative;
    flex-shrink: 0;
  }

  .stack-item.overlap {
    margin-left: -6px;
  }

  .avatar-wrapper {
    position: relative;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--foreground) 22%, var(--border));
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
  }

  .avatar-wrapper.host {
    border-color: var(--accent-spawn);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-spawn) 45%, transparent),
      0 1px 2px rgb(0 0 0 / 0.35);
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  :global(.avatar-fallback) {
    background: transparent !important;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
  }

  .avatar-btn {
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    font-family: inherit;
    cursor: pointer;
    transition: transform 120ms ease;
  }

  .avatar-btn:hover {
    transform: translateY(-1px);
  }

  .avatar-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .host-badge {
    position: absolute;
    left: -3px;
    bottom: -3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent-spawn);
    color: var(--card);
    border: 1.5px solid color-mix(in srgb, var(--foreground) 22%, var(--border));
    pointer-events: none;
  }

  .host-badge :global(svg) {
    width: 8px;
    height: 8px;
  }

  .avatar.overflow {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--foreground) 22%, var(--border));
    background: var(--secondary);
    color: var(--muted-foreground);
    font-size: 9px;
    font-weight: 500;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
  }
</style>
