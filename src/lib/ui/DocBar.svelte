<script lang="ts">
	import { score } from '$lib/engine/game/score.svelte';
	import ShellModeTabs from '$lib/ui/ShellModeTabs.svelte';
	import RoomPresenceBar from '$lib/ui/RoomPresenceBar.svelte';
	import ChatDocBarButton from '$lib/ui/ChatDocBarButton.svelte';
	import PublishDocBarButton from '$lib/ui/PublishDocBarButton.svelte';
	import DocBarBreadcrumb from '$lib/ui/DocBarBreadcrumb.svelte';
	import DocBarHistory from '$lib/ui/DocBarHistory.svelte';
	import EditingIndicator from '$lib/ui/EditingIndicator.svelte';
	import ViewportBottomLeft from '$lib/ui/ViewportBottomLeft.svelte';
	import { sceneLoading } from '$lib/ui/sceneLoading.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { PLAYLAB_LABEL } from '$lib/ui/worldNav';

	// World nav history is an edit-mode affordance (matches DocBarHistory's own gate).
	const showWorldNav = $derived(ui.shellMode === 'edit');
	const inPlay = $derived(ui.shellMode === 'play');
</script>

<header class="doc-bar">
	<div class="doc-bar-start">
		{#if showWorldNav}
			<DocBarHistory />
		{/if}
		{#if inPlay}
			<span class="doc-bar-playlab" aria-hidden="true">{PLAYLAB_LABEL}</span>
			<ViewportBottomLeft inline />
		{:else}
			<DocBarBreadcrumb />
		{/if}
		{#if sceneLoading.showEditingIndicator}
			<EditingIndicator inline />
		{/if}
	</div>

	<div class="doc-bar-end">
		{#if score.value > 0}
			<span class="score-chip" title="Collected">★ {score.value}</span>
		{/if}
		<RoomPresenceBar />
		{#if !inPlay}
		{#if !inPlay}
			<span class="chat-anchor" id="doc-bar-chat-anchor">
				<ChatDocBarButton />
			</span>
		{/if}
		{/if}
		<PublishDocBarButton />
		<div class="shell-mode-tabs-slot">
			<ShellModeTabs />
		</div>
	</div>
</header>

<style>
	.doc-bar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: var(--doc-bar-chrome-height);
		height: 100%;
		padding: var(--doc-bar-pad-y) var(--spacing-md);
		min-width: 0;
		flex-shrink: 0;
		pointer-events: auto;
	}

	.doc-bar-start {
		min-width: 0;
		pointer-events: auto;
		padding-left: var(--spacing-sm);
		display: flex;
		align-items: center;
		gap: 10px;
		overflow: visible;
	}

	.doc-bar-playlab {
		flex-shrink: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--muted-foreground);
	}

	.doc-bar-end {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		min-width: 0;
		flex-shrink: 0;
		pointer-events: auto;
	}

	.shell-mode-tabs-slot {
		display: inline-flex;
		width: fit-content;
		flex-shrink: 0;
	}

	.chat-anchor {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}

	.score-chip {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
	}
</style>
