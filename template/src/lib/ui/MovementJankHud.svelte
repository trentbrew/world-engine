<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import { movementJank } from '$lib/engine/player/movementJank.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { viewportDebug } from '$lib/ui/viewportDebug.svelte';

	let { embedded = false }: { embedded?: boolean } = $props();

	let expanded = $state(false);

	const visible = $derived(ui.shellMode === 'play' && viewportDebug.jankHud);
	const statusClass = $derived(movementJank.status);
	const pillAriaLabel = $derived(
		`Move jank, score ${movementJank.score} ${movementJank.status}, ${expanded ? 'collapse' : 'expand'}`
	);

	function toggleExpanded() {
		expanded = !expanded;
	}

	function collapse() {
		expanded = false;
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

{#if visible}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="jank-hud"
		class:embedded
		class:rough={statusClass === 'rough'}
		class:janky={statusClass === 'janky'}
		role="group"
		onkeydown={(event) => {
			if (event.key === 'Escape' && expanded) {
				event.stopPropagation();
				collapse();
			}
		}}
	>
		<button
			type="button"
			class="jank-pill"
			aria-expanded={expanded}
			aria-label={pillAriaLabel}
			data-testid="move-jank-pill"
			onclick={toggleExpanded}
		>
			<GaugeIcon class="pill-icon" aria-hidden="true" />
			<span class="pill-tab">Jank</span>
			<span class="pill-sep" aria-hidden="true">·</span>
			<span class="pill-metric" data-testid="move-jank-score">{movementJank.score}</span>
			<span class="pill-status" data-testid="move-jank-status">{movementJank.status}</span>
			<ChevronDownIcon class="pill-chev" aria-hidden="true" />
		</button>

		{#if expanded}
			<aside class="jank-panel" role="region" aria-label="Movement smoothness">
				<header class="jank-head">
					<span class="jank-title">Move jank</span>
					<span class="jank-score">{movementJank.score}</span>
					<span class="jank-status">{movementJank.status}</span>
					<button type="button" class="collapse-btn" aria-label="Collapse" onclick={collapse}>
						−
					</button>
				</header>
				<div class="jank-meter" aria-hidden="true">
					<div class="jank-fill" style={`width: ${movementJank.score}%`}></div>
				</div>
				<dl class="jank-grid">
					<div>
						<dt>grounded</dt>
						<dd data-testid="move-jank-grounded">{movementJank.grounded ? 'yes' : 'no'}</dd>
					</div>
					<div>
						<dt>edges/s</dt>
						<dd>{movementJank.groundedEdgesPerSec}</dd>
					</div>
					<div>
						<dt>ΔY rms</dt>
						<dd>{movementJank.yJitterRms.toFixed(4)}</dd>
					</div>
					<div>
						<dt>rest Δ</dt>
						<dd>{movementJank.restDelta.toFixed(3)}</dd>
					</div>
					<div>
						<dt>vy</dt>
						<dd>{movementJank.vy.toFixed(2)}</dd>
					</div>
					<div>
						<dt>land ms</dt>
						<dd>{Math.round(movementJank.landHoldMs)}</dd>
					</div>
					<div>
						<dt>air ms</dt>
						<dd>{Math.round(movementJank.airMs)}</dd>
					</div>
					<div>
						<dt>unground</dt>
						<dd>{movementJank.lastUnground}</dd>
					</div>
				</dl>
				<p class="jank-hint">Toggle · key 5 · pause menu</p>
			</aside>
		{/if}
	</div>
{/if}

<style>
	.jank-hud {
		display: flex;
		flex-direction: column-reverse;
		align-items: flex-start;
		gap: 8px;
		pointer-events: auto;
	}

	.jank-hud.embedded {
		position: static;
		z-index: auto;
	}

	.jank-pill {
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

	.jank-pill:hover {
		background: var(--secondary);
	}

	.jank-pill:focus-visible {
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

	.pill-status {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		opacity: 0.85;
	}

	.jank-hud.rough .pill-metric,
	.jank-hud.rough .pill-status {
		color: #c9a227;
	}

	.jank-hud.janky .pill-metric,
	.jank-hud.janky .pill-status {
		color: #d94c4c;
	}

	:global(.pill-chev) {
		width: 14px;
		height: 14px;
		opacity: 0.5;
		margin-left: 2px;
	}

	.jank-panel {
		width: 220px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 92%, transparent);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.28);
		font-family: var(--font-mono);
		color: var(--foreground);
	}

	.jank-hud.rough .jank-panel {
		border-color: color-mix(in srgb, #c9a227 55%, var(--border));
	}

	.jank-hud.janky .jank-panel {
		border-color: color-mix(in srgb, #d94c4c 65%, var(--border));
	}

	.jank-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 6px;
	}

	.jank-title {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.jank-score {
		font-size: 18px;
		font-weight: 700;
		margin-left: auto;
	}

	.jank-status {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.jank-hud.rough .jank-status,
	.jank-hud.rough .jank-score {
		color: #c9a227;
	}

	.jank-hud.janky .jank-status,
	.jank-hud.janky .jank-score {
		color: #d94c4c;
	}

	.collapse-btn {
		width: 22px;
		height: 22px;
		margin: 0 -4px 0 0;
		border: none;
		border-radius: var(--rounded-sm);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		flex-shrink: 0;
	}

	.collapse-btn:hover {
		background: var(--secondary);
		color: var(--foreground);
	}

	.jank-meter {
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted-foreground) 22%, transparent);
		overflow: hidden;
		margin-bottom: 8px;
	}

	.jank-fill {
		height: 100%;
		border-radius: inherit;
		background: color-mix(in srgb, #3d9a5f 80%, var(--foreground));
		transition: width 80ms linear;
	}

	.jank-hud.rough .jank-fill {
		background: #c9a227;
	}

	.jank-hud.janky .jank-fill {
		background: #d94c4c;
	}

	.jank-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px 10px;
		margin: 0;
	}

	.jank-grid div {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		min-width: 0;
	}

	.jank-grid dt {
		margin: 0;
		font-size: 9px;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.jank-grid dd {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
	}

	.jank-hint {
		margin: 8px 0 0;
		font-size: 9px;
		color: var(--muted-foreground);
	}

	@media (prefers-reduced-motion: reduce) {
		.jank-pill,
		.jank-panel,
		.jank-fill {
			transition: none;
		}
	}
</style>
