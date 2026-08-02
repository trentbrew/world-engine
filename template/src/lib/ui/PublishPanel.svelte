<script lang="ts">
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ui } from '$lib/ui/ui.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';

	const title = $derived(ui.scene.displayName?.trim() || 'Untitled game');
	const entityCount = $derived(world.selectableEntities.length);

	function copyShareLink() {
		const url = new URL(location.href);
		url.searchParams.set('mode', 'play');
		void navigator.clipboard?.writeText(url.toString());
		ui.modeMessage = 'Play link copied';
	}
</script>

<aside class="publish-panel" aria-label="Publish">
	<div class="publish-card chrome-float-card glass-panel-shell">
		<header class="publish-head">
			<span class="publish-icon-wrap" aria-hidden="true">
				<UploadIcon class="publish-icon" />
			</span>
			<div class="publish-copy">
				<h2 class="publish-title">Publish</h2>
				<p class="publish-sub">{title}</p>
			</div>
		</header>

		<dl class="publish-meta">
			<div>
				<dt>Entities</dt>
				<dd>{entityCount}</dd>
			</div>
			<div>
				<dt>Mode</dt>
				<dd>Draft</dd>
			</div>
		</dl>

		<p class="publish-body">
			Share a play link now. Hosted publish (build, version, listing) lands here next — kept out of
			the rail so authoring tools stay focused.
		</p>

		<div class="publish-actions">
			<Button variant="default" size="sm" onclick={copyShareLink}>Copy play link</Button>
			<Button variant="outline" size="sm" onclick={() => ui.exitPublish()}>Back to edit</Button>
		</div>
	</div>
</aside>

<style>
	.publish-panel {
		position: absolute;
		inset: 0;
		z-index: 8;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--doc-bar-chrome-height, 48px) + 24px) 24px 24px;
		pointer-events: none;
		background: radial-gradient(ellipse 70% 55% at 50% 42%, rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.55));
	}

	.publish-card {
		pointer-events: auto;
		width: min(420px, 100%);
		padding: 20px 22px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		border-radius: var(--rounded-lg);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 94%, transparent);
		box-shadow: 0 16px 48px rgb(0 0 0 / 0.35);
	}

	.publish-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.publish-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--primary) 18%, transparent);
		color: var(--foreground);
		flex-shrink: 0;
	}

	:global(.publish-icon) {
		width: 18px;
		height: 18px;
	}

	.publish-copy {
		min-width: 0;
	}

	.publish-title {
		margin: 0;
		font-size: 16px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.publish-sub {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.publish-meta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 16px;
		margin: 0;
	}

	.publish-meta div {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--viewport) 55%, transparent);
	}

	.publish-meta dt {
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.publish-meta dd {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		font-family: var(--font-mono);
	}

	.publish-body {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.publish-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
