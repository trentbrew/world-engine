<script lang="ts">
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { ui } from '$lib/ui/ui.svelte';
	import SceneSelector from '$lib/ui/SceneSelector.svelte';
	import {
		PLAYLAB_LABEL,
		resolveActiveRoomLabel,
		resolveActiveWorldRoute,
		worldRouteLabel
	} from '$lib/ui/worldNav';

	const activeWorldRoute = $derived(resolveActiveWorldRoute());
	const routeLabel = $derived(worldRouteLabel(activeWorldRoute));
	const inObjectEditor = $derived(ui.railRoute === 'object' && !!ui.objectTarget);
	const showEditTrail = $derived(ui.shellMode === 'edit');
	/** Non-null only for multi-room games — the active room as a world level. */
	const roomLabel = $derived(resolveActiveRoomLabel());
	/**
	 * The default `rooms` route is the world's home view — the scene/room crumb
	 * already represents it, so skip a redundant "Rooms" crumb there. Other
	 * routes (and the object editor's back-link) still get a trail crumb.
	 */
	const showRouteCrumb = $derived(activeWorldRoute !== 'rooms' || inObjectEditor);

	function goRoomsRoute(event: MouseEvent) {
		event.preventDefault();
		ui.setRoute('rooms');
	}

	function shortId(id: string): string {
		const parts = id.split('/');
		return parts[parts.length - 1] ?? id;
	}

	function goRooms(event: MouseEvent) {
		event.preventDefault();
		if (inObjectEditor) {
			ui.exitObject();
			return;
		}
		ui.setRoute('rooms');
	}
</script>

<Breadcrumb.Root class="doc-breadcrumb">
	<Breadcrumb.List>
		<Breadcrumb.Item>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<span {...props} class="doc-crumb-stub">{PLAYLAB_LABEL}</span>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6} class="text-xs">
					Games coming soon
				</Tooltip.Content>
			</Tooltip.Root>
		</Breadcrumb.Item>

		<Breadcrumb.Separator />
		<Breadcrumb.Item>
			<SceneSelector compact />
		</Breadcrumb.Item>

		{#if roomLabel}
			<Breadcrumb.Separator />
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/" onclick={goRoomsRoute} class="doc-crumb-link">
					{roomLabel}
				</Breadcrumb.Link>
			</Breadcrumb.Item>
		{/if}

		{#if showEditTrail && showRouteCrumb}
			<Breadcrumb.Separator />
			<Breadcrumb.Item>
				{#if inObjectEditor}
					<Breadcrumb.Link href="/" onclick={goRooms} class="doc-crumb-link">
						{routeLabel}
					</Breadcrumb.Link>
				{:else}
					<Breadcrumb.Page class="doc-crumb-page">{routeLabel}</Breadcrumb.Page>
				{/if}
			</Breadcrumb.Item>

			{#if inObjectEditor && ui.objectTarget}
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					<Breadcrumb.Page class="doc-crumb-page">{shortId(ui.objectTarget)}</Breadcrumb.Page>
				</Breadcrumb.Item>
			{:else if activeWorldRoute === 'objects' && ui.selectedObjectType}
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					<Breadcrumb.Page class="doc-crumb-page">{ui.selectedObjectType}</Breadcrumb.Page>
				</Breadcrumb.Item>
			{/if}
		{/if}
	</Breadcrumb.List>
</Breadcrumb.Root>

<style>
	:global(.doc-breadcrumb) {
		min-width: 0;
	}

	:global(.doc-breadcrumb [data-slot='breadcrumb-list']) {
		flex-wrap: nowrap;
		align-items: center;
		font-size: 12px;
		gap: 6px;
	}

	:global(.doc-breadcrumb [data-slot='breadcrumb-item']) {
		display: inline-flex;
		align-items: center;
		min-width: 0;
	}

	.doc-crumb-stub {
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		color: var(--muted-foreground);
		cursor: default;
	}

	:global(.doc-crumb-link) {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		color: var(--foreground);
	}

	:global(.doc-crumb-page) {
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
</style>
