<script lang="ts">
	import { onMount } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import {
		gamepadMenuConfirmPressed,
		gamepadMenuNavDelta,
		primePlayMenuButtons
	} from '$lib/engine/player/gamepad.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { session } from '$lib/engine/net/session.svelte';
	import { setStoredPlayerAvatarMesh } from '$lib/engine/player/playerAvatarPrefs';
	import { assetLibrary } from '$lib/ui/assetLibrary.svelte';
	import {
		applyLocalPlayerAvatarMesh,
		avatarLabel,
		isAvatarModelAsset
	} from '$lib/ui/playPauseAvatar';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import {
		PLAY_VIEWPORT_ITEMS,
		viewportDebug
	} from '$lib/ui/viewportDebug.svelte';

	const visible = $derived(ui.shellMode === 'play' && ui.playPaused);

	const currentMesh = $derived.by(() => {
		void world.entities;
		const local = world.localPlayerEntity;
		const skin = local?.components.SkinnedMesh as { mesh?: string } | undefined;
		if (typeof skin?.mesh === 'string' && skin.mesh) return skin.mesh;
		void world.typeRevision;
		const fromType = world.typeDefaultValue('Player', 'SkinnedMesh', 'mesh');
		return typeof fromType === 'string' ? fromType : '';
	});

	const avatarOptions = $derived.by(() => {
		void assetLibrary.assets;
		void assetLibrary.loading;
		return assetLibrary.assets.filter(isAvatarModelAsset).sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	});

	function pollGamepadMenu() {
		if (!visible) return;
		const nav = gamepadMenuNavDelta();
		if (nav !== 0) viewportDebug.moveMenuSelection(nav);
		if (gamepadMenuConfirmPressed()) viewportDebug.toggleMenuSelection();
	}

	function selectAvatar(url: string) {
		if (url === currentMesh) return;
		const local = world.localPlayerEntity;
		if (!local || !applyLocalPlayerAvatarMesh(local, url)) {
			toast.error('Could not change avatar');
			return;
		}
		setStoredPlayerAvatarMesh(url);
		world.entities = [...world.entities];
		session.announcePlayer();
		toast.success(`Avatar → ${avatarLabel(url)}`);
	}

	onMount(() => {
		let raf = 0;
		const loop = () => {
			pollGamepadMenu();
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	$effect(() => {
		if (visible) {
			viewportDebug.resetMenu();
			primePlayMenuButtons();
			void assetLibrary.ensureLoaded();
		}
	});
</script>

{#if visible}
	<div class="pause-scrim" role="presentation"></div>
	<div
		class="pause-menu"
		role="dialog"
		aria-modal="true"
		aria-label="Paused — viewport options"
	>
		<header class="pause-head">
			<h2 class="pause-title">Paused</h2>
			<p class="pause-sub">Toggle overlays · P or Start to resume · Esc to edit</p>
		</header>

		<ul class="option-list" role="listbox" aria-label="Viewport overlays">
			{#each PLAY_VIEWPORT_ITEMS as item, index (item.id)}
				<li>
					<button
						type="button"
						role="option"
						class="option-row"
						class:selected={viewportDebug.menuIndex === index}
						aria-selected={viewportDebug.menuIndex === index}
						onclick={() => viewportDebug.toggle(item.id)}
						onfocus={() => (viewportDebug.menuIndex = index)}
					>
						<span class="option-copy">
							<span class="option-label">{item.label}</span>
							<span class="option-hint">{item.hint}</span>
						</span>
						<span class="option-meta">
							<kbd class="shortcut">{item.shortcut}</kbd>
							<span class="check" class:on={viewportDebug.getValue(item.id)} aria-hidden="true">
								{#if viewportDebug.getValue(item.id)}
									<CheckIcon class="check-icon" />
								{/if}
							</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>

		<section class="avatar-section" aria-label="Player avatar">
			<h3 class="section-label">Avatar</h3>
			{#if assetLibrary.loading && avatarOptions.length === 0}
				<p class="avatar-empty">Loading models…</p>
			{:else if avatarOptions.length === 0}
				<p class="avatar-empty">No character models in the library.</p>
			{:else}
				<ul class="option-list avatar-list" role="listbox" aria-label="Player models">
					{#each avatarOptions as asset (asset.url)}
						{@const active = asset.url === currentMesh}
						<li>
							<button
								type="button"
								role="option"
								class="option-row"
								class:active
								aria-selected={active}
								onclick={() => selectAvatar(asset.url)}
							>
								<span class="option-copy">
									<span class="option-label">{avatarLabel(asset.url)}</span>
									<span class="option-hint">{asset.name}</span>
								</span>
								<span class="option-meta">
									<span class="check" class:on={active} aria-hidden="true">
										{#if active}
											<CheckIcon class="check-icon" />
										{/if}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<footer class="pause-foot">
			<span class="foot-hint">↑↓ / stick navigate · A / Enter toggle · Start resume · Esc edit</span>
			<button type="button" class="resume-btn" onclick={() => ui.resumePlay()}>Resume</button>
		</footer>
	</div>
{/if}

<style>
	.pause-scrim {
		position: absolute;
		inset: 0;
		z-index: 14;
		background: rgb(0 0 0 / 0.42);
		backdrop-filter: blur(2px);
		pointer-events: auto;
	}

	.pause-menu {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 15;
		transform: translate(-50%, -50%);
		width: min(380px, calc(100% - 32px));
		max-height: min(560px, calc(100% - 48px));
		overflow-y: auto;
		padding: 16px;
		border-radius: 14px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 92%, var(--viewport));
		box-shadow: 0 24px 64px rgb(0 0 0 / 0.45);
		pointer-events: auto;
	}

	.pause-head {
		margin-bottom: 12px;
	}

	.pause-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.pause-sub {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.section-label {
		margin: 14px 0 6px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.avatar-section {
		min-height: 0;
	}

	.avatar-list {
		max-height: 200px;
		overflow-y: auto;
	}

	.avatar-empty {
		margin: 0;
		padding: 8px 4px;
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.option-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.option-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 10px 12px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}

	.option-row:hover,
	.option-row.selected,
	.option-row.active {
		background: color-mix(in srgb, var(--secondary) 55%, transparent);
		border-color: color-mix(in srgb, var(--border) 80%, transparent);
	}

	.option-row:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	.option-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.option-label {
		font-size: 13px;
		font-weight: 600;
		text-transform: capitalize;
	}

	.option-hint {
		font-size: 11px;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.option-meta {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.shortcut {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 6px;
		border: 1px solid var(--border);
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--viewport) 50%, transparent);
	}

	.check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 5px;
		border: 1px solid var(--border);
		color: transparent;
	}

	.check.on {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--primary-foreground);
	}

	:global(.check-icon) {
		width: 12px;
		height: 12px;
	}

	.pause-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.foot-hint {
		font-size: 10px;
		color: var(--muted-foreground);
		line-height: 1.35;
	}

	.resume-btn {
		height: 30px;
		padding: 0 14px;
		border: none;
		border-radius: var(--rounded-pill);
		background: var(--primary);
		color: var(--primary-foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
	}

	.resume-btn:hover {
		filter: brightness(1.05);
	}

	.resume-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
</style>
