<script lang="ts">
	import { browser } from '$app/environment';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { ensureGameInUrl } from '$lib/engine/games';
	import { ensureRoomInUrl } from '$lib/engine/net/roomUrl';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';

	let { children } = $props();

	if (browser) {
		ensureGameInUrl();
		ensureRoomInUrl();
	}
</script>

<ModeWatcher defaultMode="dark" defaultTheme="default" modeStorageKey="mode" themeStorageKey="theme" />

<svelte:head>
	<link rel="icon" href="/favicon.png" type="image/png" />
	<link rel="apple-touch-icon" href="/logo.png" />
</svelte:head>

{@render children()}

<Toaster
	position="bottom-right"
	closeButton
	visibleToasts={4}
	offset={{ bottom: 'var(--toast-inset-bottom)', right: 'var(--toast-inset-right)' }}
/>
