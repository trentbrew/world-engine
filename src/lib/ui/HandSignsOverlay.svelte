<script lang="ts">
  import {
    handSigns,
    HAND_SIGNS_MAP,
    ALL_SHOULDER_SIGNS,
    formatChordLabel,
    type ShoulderSignDef
  } from '$lib/engine/player/handSigns.svelte';
  import {
    gamepad,
    gamepadNorthLabel,
    gamepadEastLabel,
    gamepadActiveFamily
  } from '$lib/engine/player/gamepad.svelte';
  import { toast } from '$lib/ui/toast.svelte';

  const rows = [
    ['q', 'w', 'e', 'r'],
    ['a', 's', 'd', 'f'],
    ['z', 'x', 'c', 'v']
  ];

  let lastReportedResultId = $state<number | null>(null);
  const isGamepadMode = $derived(gamepad.connected || handSigns.shoulderMask > 0 || handSigns.activeChord !== null);
  const padFamily = $derived(gamepadActiveFamily());

  const singleSigns = $derived(ALL_SHOULDER_SIGNS.filter((s) => s.group === 'single'));
  const pairSigns = $derived(ALL_SHOULDER_SIGNS.filter((s) => s.group === 'pair'));
  const chordSigns = $derived(ALL_SHOULDER_SIGNS.filter((s) => s.group === 'chord'));

  // Trigger toast message once chain is complete
  $effect(() => {
    const res = handSigns.lastResult;
    if (!res || res.id === lastReportedResultId) return;
    lastReportedResultId = res.id;

    if (res.matched && res.jutsu) {
      if (!res.jutsu.id.startsWith('shadow_clone')) {
        toast.success(`${res.jutsu.japanese} ${res.jutsu.name}`, {
          description: `${res.symbols} (${res.chainSummary})`
        });
      }
    } else {
      toast.warning('No action mapped', {
        description: `${res.symbols} (${res.chainSummary})`
      });
    }
  });
</script>

<!-- Bottom-Left: Hand Signs Interface (Shoulder Chords Palette on Gamepad, 3x4 Grid on Keyboard) -->
{#if handSigns.active}
  <aside
    class="hand-signs-grid-panel"
    class:shoulder-mode={isGamepadMode}
    data-testid="hand-signs-grid"
    aria-label="Hand signs input"
  >
    {#if isGamepadMode}
      <!-- Gamepad Shoulder Buttons & Chords Palette -->
      <div class="grid-header">
        <span class="grid-title">SHOULDER SEALS</span>
        <div class="header-badges">
          <span class="grid-cancel-badge">[{gamepadEastLabel()} CANCEL]</span>
          <span class="grid-key-badge">{gamepadNorthLabel()} HOLD</span>
        </div>
      </div>

      <div class="shoulder-palette">
        <!-- Section: Singles (4) -->
        <div class="palette-section">
          <div class="section-label">SINGLES</div>
          <div class="palette-cards-grid four-cols">
            {#each singleSigns as sign (sign.mask)}
              {@const isHeld = (handSigns.shoulderMask & sign.mask) === sign.mask && handSigns.shoulderMask === sign.mask}
              {@const isCommitted = handSigns.committedChord?.mask === sign.mask || handSigns.lastPressedKey === sign.key}
              <div
                class="shoulder-card"
                class:held={isHeld}
                class:committed={isCommitted}
              >
                <span class="chord-badge">{formatChordLabel(sign.buttons, padFamily)}</span>
                <span class="card-kanji">{sign.japanese}</span>
                <span class="card-romaji">{sign.romaji}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Section: Pairs (6) -->
        <div class="palette-section">
          <div class="section-label">PAIRS</div>
          <div class="palette-cards-grid three-cols">
            {#each pairSigns as sign (sign.mask)}
              {@const isHeld = (handSigns.shoulderMask & sign.mask) === sign.mask && handSigns.shoulderMask === sign.mask}
              {@const isCommitted = handSigns.committedChord?.mask === sign.mask || handSigns.lastPressedKey === sign.key}
              {@const isShadowClone = sign.key === 'a'}
              <div
                class="shoulder-card"
                class:held={isHeld}
                class:committed={isCommitted}
                class:special={isShadowClone}
              >
                <div class="card-top">
                  <span class="chord-badge">{formatChordLabel(sign.buttons, padFamily)}</span>
                  {#if isShadowClone}
                    {#if handSigns.cloneMultiplier > 1}
                      <span class="special-multiplier" title="{handSigns.cloneMultiplier} Clones Ready">×{handSigns.cloneMultiplier}</span>
                    {:else}
                      <span class="special-star" title="Shadow Clone Jutsu">★</span>
                    {/if}
                  {/if}
                </div>
                <span class="card-kanji">{sign.japanese}</span>
                <span class="card-romaji">{sign.romaji}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Section: Chords (2) -->
        <div class="palette-section">
          <div class="section-label">CHORDS</div>
          <div class="palette-cards-grid two-cols">
            {#each chordSigns as sign (sign.mask)}
              {@const isHeld = (handSigns.shoulderMask & sign.mask) === sign.mask && handSigns.shoulderMask === sign.mask}
              {@const isCommitted = handSigns.committedChord?.mask === sign.mask || handSigns.lastPressedKey === sign.key}
              <div
                class="shoulder-card"
                class:held={isHeld}
                class:committed={isCommitted}
              >
                <span class="chord-badge">{sign.buttons.length === 4 ? `ALL 4` : formatChordLabel(sign.buttons, padFamily)}</span>
                <span class="card-kanji">{sign.japanese}</span>
                <span class="card-romaji">{sign.romaji}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Real-time chord hint footer -->
        <div class="shoulder-footer-hint">
          {#if handSigns.cloneMultiplier > 1}
            <span class="multiplier-hint">
              SHADOW CLONES: ×{handSigns.cloneMultiplier} (SQUEEZE AGAIN TO ADD)
            </span>
          {:else if handSigns.committedChord}
            <span class="committed-hint">
              COMMITTED: {handSigns.committedChord.japanese} {handSigns.committedChord.english} ({formatChordLabel(handSigns.committedChord.buttons, padFamily)})
            </span>
          {:else if handSigns.activeChord}
            <span class="active-chord-hint">
              SQUEEZING: {handSigns.activeChord.japanese} {handSigns.activeChord.english} ({formatChordLabel(handSigns.activeChord.buttons, padFamily)})
            </span>
          {:else}
            <span class="idle-hint">SQUEEZE SHOULDERS TO WEAVE · [{gamepadEastLabel()} CANCEL]</span>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Keyboard 3x4 Grid -->
      <div class="grid-header">
        <span class="grid-title">HAND SIGNS</span>
        <div class="header-badges">
          <span class="grid-cancel-badge">[ESC CANCEL]</span>
          <span class="grid-key-badge">CTRL</span>
        </div>
      </div>

      <div class="grid-body">
        {#each rows as row}
          <div class="grid-row">
            {#each row as key}
              {@const item = HAND_SIGNS_MAP[key]}
              {@const isPressed = handSigns.lastPressedKey === key}
              <div class="grid-cell" class:pressed={isPressed}>
                <span class="cell-key">{key.toUpperCase()}</span>
                <span class="cell-kanji">{item.japanese}</span>
                <span class="cell-label">{item.romaji}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </aside>
{/if}

<!-- Bottom-Right: Vertical Hand Signs Chain -->
{#if handSigns.visible && handSigns.chain.length > 0}
  <aside
    class="hand-signs-chain-panel"
    data-testid="hand-signs-chain"
    aria-label="Hand signs chain"
  >
    <!-- Chain status / Action mapped banner -->
    <div class="chain-status-bar">
      {#if !handSigns.active && handSigns.lastResult}
        {#if handSigns.lastResult.matched && handSigns.lastResult.jutsu}
          <div class="status-badge status-matched">
            <span class="status-icon">✓</span>
            <span class="status-name">{handSigns.lastResult.jutsu.name}</span>
            <span class="status-kanji">{handSigns.lastResult.jutsu.japanese}</span>
          </div>
        {:else}
          <div class="status-badge status-unmapped">
            <span class="status-icon">✕</span>
            <span class="status-name">No action mapped</span>
          </div>
        {/if}
      {:else if handSigns.active}
        {#if handSigns.activeJutsu}
          <div class="status-badge status-forming">
            <span class="status-dot"></span>
            <span>{handSigns.activeJutsu.name}</span>
          </div>
        {:else}
          <span class="status-count">{handSigns.chain.length} SEALS</span>
        {/if}
      {/if}
    </div>

    <!-- Vertical list of signs -->
    <div class="vertical-chain">
      {#each handSigns.chain as sign, index (sign.id)}
        {#if index > 0}
          <div class="chain-arrow" aria-hidden="true">↓</div>
        {/if}
        <div class="chain-item" class:latest={index === handSigns.chain.length - 1}>
          <span class="item-kanji">{sign.japanese}</span>
          <span class="item-romaji">{sign.romaji}</span>
          {#if sign.key === 'a' && handSigns.cloneMultiplier > 1}
            <span class="clone-count-tag">×{handSigns.cloneMultiplier}</span>
          {/if}
          <span class="item-key">{sign.key.toUpperCase()}</span>
        </div>
      {/each}
    </div>
  </aside>
{/if}

<style>
  /* Bottom-Left Grid Panel: Minimalist & Neutral */
  .hand-signs-grid-panel {
    position: absolute;
    bottom: 24px;
    left: 24px;
    z-index: 25;
    pointer-events: none;
    user-select: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    animation: fade-in 0.15s ease-out;
  }

  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 2px;
  }

  .grid-title {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #94a3b8;
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .grid-cancel-badge {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 8.5px;
    font-weight: 600;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .grid-key-badge {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .grid-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .grid-row {
    display: flex;
    gap: 4px;
  }

  .grid-cell {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 6px;
    min-width: 82px;
    border: 1px solid transparent;
    border-radius: 4px;
    transition: background 0.1s ease, border-color 0.1s ease;
  }

  .grid-cell.pressed {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .cell-key {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
  }

  .cell-kanji {
    font-size: 14px;
    font-weight: 600;
    color: #f8fafc;
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'MS Mincho', serif;
  }

  .cell-label {
    font-size: 9px;
    font-weight: 500;
    color: #94a3b8;
  }

  /* Shoulder Palette Styles */
  .hand-signs-grid-panel.shoulder-mode {
    padding: 10px 12px 8px;
    min-width: 290px;
  }

  .shoulder-palette {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .palette-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .section-label {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #64748b;
  }

  .palette-cards-grid {
    display: grid;
    gap: 4px;
  }

  .palette-cards-grid.four-cols {
    grid-template-columns: repeat(4, 1fr);
  }

  .palette-cards-grid.three-cols {
    grid-template-columns: repeat(3, 1fr);
  }

  .palette-cards-grid.two-cols {
    grid-template-columns: repeat(2, 1fr);
  }

  .shoulder-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3px 4px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    transition: all 0.1s ease;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .special-star {
    font-size: 8px;
    color: #fbbf24;
    line-height: 1;
  }

  .special-multiplier {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    font-weight: 800;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.45);
    padding: 0 3px;
    border-radius: 3px;
    line-height: 1.1;
    text-shadow: 0 0 6px rgba(251, 191, 36, 0.6);
  }

  .chord-badge {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 8px;
    font-weight: 700;
    color: #94a3b8;
    line-height: 1;
  }

  .card-kanji {
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'MS Mincho', serif;
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1.2;
  }

  .card-romaji {
    font-size: 8px;
    font-weight: 500;
    color: #64748b;
    line-height: 1;
  }

  /* Held / Squeezing state */
  .shoulder-card.held {
    background: rgba(14, 165, 233, 0.25);
    border-color: #38bdf8;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
    transform: translateY(-1px);
  }

  .shoulder-card.held .chord-badge {
    color: #38bdf8;
  }

  .shoulder-card.held .card-kanji {
    color: #ffffff;
    text-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
  }

  .shoulder-card.held .card-romaji {
    color: #bae6fd;
  }

  /* Committed state (crisp flash upon input) */
  .shoulder-card.committed {
    background: rgba(16, 185, 129, 0.35);
    border-color: #10b981;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
    transform: scale(1.04);
  }

  .shoulder-card.committed .chord-badge {
    color: #6ee7b7;
  }

  .shoulder-card.committed .card-kanji {
    color: #ffffff;
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
  }

  .shoulder-card.special {
    border-color: rgba(251, 191, 36, 0.22);
  }

  .shoulder-card.special:not(.held):not(.committed) {
    background: rgba(251, 191, 36, 0.05);
  }

  .shoulder-footer-hint {
    font-size: 8.5px;
    font-family: var(--font-mono, ui-monospace, monospace);
    letter-spacing: 0.05em;
    text-align: center;
    color: #94a3b8;
    min-height: 14px;
    margin-top: 2px;
  }

  .multiplier-hint {
    color: #fbbf24;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
  }

  .active-chord-hint {
    color: #38bdf8;
    font-weight: 600;
    text-shadow: 0 0 6px rgba(56, 189, 248, 0.5);
  }

  .committed-hint {
    color: #10b981;
    font-weight: 600;
    text-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
  }

  .idle-hint {
    opacity: 0.7;
  }

  /* Bottom-Right Vertical Chain Panel */
  .hand-signs-chain-panel {
    position: absolute;
    bottom: 24px;
    right: 24px;
    z-index: 25;
    pointer-events: none;
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    animation: fade-in 0.15s ease-out;
  }

  /* Action Mapped / Status Bar */
  .chain-status-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
    margin-bottom: 2px;
    font-family: var(--font-mono, ui-monospace, monospace);
  }

  .status-count {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #94a3b8;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Intentional Colors */
  .status-matched {
    color: #10b981;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .status-unmapped {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.14);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .status-forming {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-icon {
    font-size: 10px;
    font-weight: 800;
  }

  .status-kanji {
    font-size: 12px;
    opacity: 0.85;
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'MS Mincho', serif;
  }

  /* Vertical Chain List */
  .vertical-chain {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .chain-arrow {
    font-size: 10px;
    line-height: 1;
    color: #64748b;
    padding: 1px 0;
    text-align: center;
    width: 100%;
  }

  .chain-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    border-radius: 3px;
    transition: background 0.15s ease;
  }

  .chain-item.latest {
    color: #ffffff;
  }

  .item-kanji {
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1;
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'MS Mincho', serif;
  }

  .item-romaji {
    font-size: 11px;
    font-weight: 500;
    color: #cbd5e1;
    min-width: 44px;
  }

  .clone-count-tag {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 800;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 3px;
    padding: 1px 4px;
    line-height: 1;
    text-shadow: 0 0 6px rgba(251, 191, 36, 0.5);
  }

  .item-key {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    font-weight: 600;
    color: #64748b;
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 4px;
    border-radius: 2px;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
