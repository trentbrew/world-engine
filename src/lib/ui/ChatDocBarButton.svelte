<script lang="ts">
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import { roomChat } from '$lib/engine/collab/roomChat.svelte';
	import { session } from '$lib/engine/net/session.svelte';

	const chatOpen = $derived(roomChat.open);
	const chatUnread = $derived(roomChat.unread);
</script>

<button
	type="button"
	class="chat-btn"
	class:active={chatOpen}
	aria-expanded={chatOpen}
	aria-controls="room-chat-panel"
	aria-label={chatOpen
		? 'Close room chat'
		: chatUnread > 0
			? `Open room chat, ${chatUnread} unread`
			: 'Open room chat'}
	title={chatOpen ? 'Close chat' : 'Room chat'}
	onclick={() => {
		if (!chatOpen) roomChat.ensureRoomConvo(session.members);
		roomChat.setOpen(!chatOpen);
	}}
>
	<MessageCircleIcon class="chat-icon" aria-hidden="true" />
	<span>Chat</span>
	{#if chatUnread > 0 && !chatOpen}
		<span class="chat-unread" aria-hidden="true">{chatUnread > 9 ? '9+' : chatUnread}</span>
	{/if}
</button>

<style>
	.chat-btn {
		position: relative;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: var(--doc-bar-height);
		padding: 0 12px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		background: var(--chrome-pill-bg);
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 120ms ease,
			color 120ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}

	:global(.chat-icon) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.9;
	}

	.chat-btn:hover:not(.active) {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--ring) 45%, var(--border));
	}

	.chat-btn.active {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--primary-foreground);
		box-shadow: 0 1px 2px color-mix(in srgb, black 24%, transparent);
	}

	.chat-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	.chat-unread {
		position: absolute;
		top: -2px;
		right: -2px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: 999px;
		background: var(--destructive);
		color: var(--destructive-foreground, #fff);
		font-size: 9px;
		font-weight: 700;
		line-height: 14px;
		text-align: center;
		border: 2px solid var(--card);
	}

	@media (prefers-reduced-motion: reduce) {
		.chat-btn {
			transition: none;
		}
	}
</style>
