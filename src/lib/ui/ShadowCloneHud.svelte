<script lang="ts">
  import { shadowCloneState } from '$lib/engine/player/shadowClone.svelte';
  import { ui } from '$lib/ui/ui.svelte';

  const clones = $derived(shadowCloneState.clones);
</script>

{#if ui.shellMode === 'play' && clones.length > 0}
  <aside
    class="shadow-clone-hud"
    data-testid="shadow-clone-hud"
    aria-label="Active Shadow Clones"
  >
    <div class="hud-header">
      <span class="hud-title">SHADOW CLONES</span>
      <span class="hud-count">{clones.length} ACTIVE</span>
    </div>

    <div class="clone-list">
      {#each clones as clone (clone.id)}
        <div class="clone-card">
          <div class="clone-info">
            <span class="clone-name">{clone.name}</span>
            <div class="clone-status" class:working={clone.status === 'working'} class:awaiting={clone.status === 'awaiting instructions'} class:standby={clone.status === 'standing by'}>
              <span class="status-dot"></span>
              <span class="status-text">{clone.status}</span>
            </div>
          </div>

          <button
            type="button"
            class="dispel-btn"
            title="Dispel clone"
            onclick={() => shadowCloneState.dispelClone(clone.clientId)}
          >
            Dispel
          </button>
        </div>
      {/each}
    </div>

    {#if clones.length > 1}
      <div class="hud-footer">
        <button
          type="button"
          class="dispel-all-btn"
          onclick={() => shadowCloneState.dispelAll()}
        >
          Dispel All ({clones.length})
        </button>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .shadow-clone-hud {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 22;
    user-select: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 7px 12px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    min-width: 240px;
    max-width: 90vw;
    animation: slide-up 0.15s ease-out;
  }

  .hud-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 3px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .hud-title {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #94a3b8;
  }

  .hud-count {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    font-weight: 600;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .clone-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .clone-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 3px 2px;
  }

  .clone-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .clone-name {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 11px;
    font-weight: 600;
    color: #f8fafc;
  }

  .clone-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: #94a3b8;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #94a3b8;
  }

  .clone-status.awaiting .status-dot {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .clone-status.awaiting .status-text {
    color: #a7f3d0;
  }

  .clone-status.working .status-dot {
    background: #38bdf8;
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
  }

  .clone-status.working .status-text {
    color: #bae6fd;
  }

  .clone-status.standby .status-dot {
    background: #cbd5e1;
  }

  .clone-status.standby .status-text {
    color: #cbd5e1;
  }

  .status-text {
    text-transform: capitalize;
  }

  .dispel-btn {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 500;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    padding: 2px 7px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  }

  .dispel-btn:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .hud-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 3px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .dispel-all-btn {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    font-weight: 500;
    color: #94a3b8;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    transition: color 0.12s ease;
  }

  .dispel-all-btn:hover {
    color: #f87171;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
</style>
