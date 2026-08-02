<script lang="ts">
	import PeerAvatarStack from '$lib/ui/PeerAvatarStack.svelte';
	import ShareButton from '$lib/ui/ShareButton.svelte';
	import { session } from '$lib/engine/net/session.svelte';

	const MAX_VISIBLE_AVATARS = 5;

	const shareStackZIndex = $derived.by(() => {
		const count = session.members.length;
		const visible = Math.min(count, MAX_VISIBLE_AVATARS);
		const overflow = count > MAX_VISIBLE_AVATARS ? 1 : 0;
		return visible + overflow + 1;
	});
</script>

{#if session.connected}
	<div class="room-presence-bar" role="region" aria-label="Room presence">
		<div class="presence-stack">
			<PeerAvatarStack />
			<ShareButton stacked stackZIndex={shareStackZIndex} />
		</div>
	</div>
{/if}

<style>
	.room-presence-bar {
		display: flex;
		align-items: center;
		min-width: 0;
		flex-shrink: 1;
	}

	.presence-stack {
		display: flex;
		align-items: center;
		min-width: 0;
		position: relative;
	}
</style>
