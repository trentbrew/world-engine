<script lang="ts">
  interface Props {
    label?: string;
    detail?: string;
  }

  let { label = 'Loading', detail = '' }: Props = $props();

  const ariaLabel = $derived(detail ? `${label} — ${detail}` : label);
</script>

<div
  class="loading-overlay"
  role="status"
  aria-live="polite"
  aria-busy="true"
  aria-label={ariaLabel}
>
  <img src="/logo.png" alt="" class="logo" aria-hidden="true" />
  <div class="status">
    <p class="label">{label}</p>
    {#if detail}
      <p class="detail">{detail}</p>
    {/if}
  </div>
  <div class="progress-bar" aria-hidden="true">
    <div class="progress-fill"></div>
  </div>
</div>

<style>
  .loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--viewport);
  }

  .logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
  }

  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    max-width: min(90vw, 32ch);
    text-align: center;
  }

  .label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .detail {
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    word-break: break-word;
  }

  .progress-bar {
    width: 200px;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text) 15%, transparent);
    overflow: hidden;
  }

  .progress-fill {
    width: 100%;
    height: 100%;
    background: var(--text);
    transform-origin: left;
    animation: loading 1.5s ease-in-out infinite;
  }

  @keyframes loading {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
