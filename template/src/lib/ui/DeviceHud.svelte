<script lang="ts">
	/**
	 * Device HUD — the edit-mode "drone" frame. Purely decorative and additive: it
	 * overlays the world viewport with pointer-events:none, so it never touches the
	 * camera, picking, or any viewport internals. Identity (name/accent/copy) comes
	 * from the generic {@link resolveDeviceProfile} seam, not hardcoded here — so the
	 * same HUD reskins per game (Turtle Slate for Craftpunk, a Snowcat for POWDER).
	 *
	 * This is the "prove the feeling" slice: establishes the language that editing is
	 * done through a device, with zero new verbs. Camera hover-bob / boot-drift (which
	 * touch the viewport rig) are a separate, browser-tuned step.
	 */
	import { currentGame } from '$lib/engine/games';
	import { resolveDeviceProfile } from '$lib/engine/hud/deviceProfile';

	const profile = resolveDeviceProfile(currentGame().param);
</script>

<div
	class="device-hud"
	style="--hud-accent: {profile.accent};"
	role="presentation"
	aria-hidden="true"
>
	<!-- boot sweep -->
	<div class="scanline"></div>

	<!-- corner brackets -->
	<span class="corner tl"></span>
	<span class="corner tr"></span>
	<span class="corner bl"></span>
	<span class="corner br"></span>

	{#if profile.reticle}
		<div class="reticle">
			<span class="tick n"></span>
			<span class="tick s"></span>
			<span class="tick e"></span>
			<span class="tick w"></span>
			<span class="dot"></span>
		</div>
	{/if}

	<!-- device telemetry chip -->
	<div class="chip">
		<span class="status"></span>
		<span class="name">{profile.name}</span>
		<span class="sep">·</span>
		<span class="tagline">{profile.tagline}</span>
	</div>
</div>

<style>
	.device-hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 4;
		color: var(--hud-accent);
		/* boot-in: fade + settle */
		animation: hud-boot 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	/* hairline inset frame, gently breathing */
	.device-hud::before {
		content: '';
		position: absolute;
		inset: 10px;
		border: 1px solid color-mix(in srgb, var(--hud-accent) 34%, transparent);
		border-radius: 4px;
		animation: hud-breathe 5.5s ease-in-out infinite;
	}

	.scanline {
		position: absolute;
		left: 10px;
		right: 10px;
		top: 10px;
		height: 2px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--hud-accent) 70%, transparent),
			transparent
		);
		opacity: 0;
		animation: hud-sweep 620ms ease-out 120ms 1;
	}

	.corner {
		position: absolute;
		width: 16px;
		height: 16px;
		border: 2px solid var(--hud-accent);
		opacity: 0.75;
	}
	.tl {
		top: 10px;
		left: 10px;
		border-right: none;
		border-bottom: none;
		border-top-left-radius: 4px;
	}
	.tr {
		top: 10px;
		right: 10px;
		border-left: none;
		border-bottom: none;
		border-top-right-radius: 4px;
	}
	.bl {
		bottom: 10px;
		left: 10px;
		border-right: none;
		border-top: none;
		border-bottom-left-radius: 4px;
	}
	.br {
		bottom: 10px;
		right: 10px;
		border-left: none;
		border-top: none;
		border-bottom-right-radius: 4px;
	}

	.reticle {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 34px;
		height: 34px;
		transform: translate(-50%, -50%);
		opacity: 0.55;
	}
	.reticle .tick {
		position: absolute;
		background: var(--hud-accent);
	}
	.reticle .tick.n,
	.reticle .tick.s {
		left: 50%;
		width: 1px;
		height: 7px;
		transform: translateX(-50%);
	}
	.reticle .tick.e,
	.reticle .tick.w {
		top: 50%;
		height: 1px;
		width: 7px;
		transform: translateY(-50%);
	}
	.reticle .tick.n {
		top: 0;
	}
	.reticle .tick.s {
		bottom: 0;
	}
	.reticle .tick.w {
		left: 0;
	}
	.reticle .tick.e {
		right: 0;
	}
	.reticle .dot {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--hud-accent);
		transform: translate(-50%, -50%);
	}

	.chip {
		position: absolute;
		left: 22px;
		bottom: 22px;
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 4px 10px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--hud-accent) 92%, var(--foreground) 8%);
		background: color-mix(in srgb, var(--card, #000) 62%, transparent);
		border: 1px solid color-mix(in srgb, var(--hud-accent) 28%, transparent);
		border-radius: 999px;
		backdrop-filter: blur(6px);
	}
	.chip .status {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--hud-accent);
		box-shadow: 0 0 6px var(--hud-accent);
		animation: hud-blink 2.4s ease-in-out infinite;
	}
	.chip .sep {
		opacity: 0.4;
	}
	.chip .tagline {
		opacity: 0.72;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	@keyframes hud-boot {
		from {
			opacity: 0;
			filter: blur(6px);
			transform: scale(1.015);
		}
		to {
			opacity: 1;
			filter: blur(0);
			transform: scale(1);
		}
	}
	@keyframes hud-sweep {
		0% {
			opacity: 0;
			transform: translateY(0);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(min(60vh, 520px));
		}
	}
	@keyframes hud-breathe {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes hud-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.device-hud,
		.scanline,
		.device-hud::before,
		.chip .status {
			animation: none;
		}
		.scanline {
			display: none;
		}
	}
</style>
