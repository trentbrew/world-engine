<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dev } from '$app/environment';
	import { assetRootForKind, type AssetKind } from '$lib/assets/catalog';

	interface Props {
		kind: AssetKind;
		disabled?: boolean;
		onUpload: (files: File[]) => void | Promise<void>;
		children?: Snippet;
	}

	let { kind, disabled = false, onUpload, children }: Props = $props();

	const root = $derived(assetRootForKind(kind));
	const hint = $derived(
		kind === 'models'
			? '.glb, .gltf'
			: kind === 'textures'
				? '.png, .jpg, .webp, .hdr…'
				: kind === 'audio'
					? '.mp3, .ogg, .wav…'
					: '.mp4, .pdf, .txt, .md…'
	);

	let dragging = $state(false);
	let dragDepth = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	export function browse() {
		if (disabled) return;
		inputEl?.click();
	}

	async function handleFiles(fileList: FileList | File[]) {
		if (disabled) return;
		const files = [...fileList];
		if (files.length === 0) return;
		await onUpload(files);
	}

	function onDragEnter(event: DragEvent) {
		if (disabled || !dev) return;
		event.preventDefault();
		dragDepth += 1;
		dragging = true;
	}

	function onDragOver(event: DragEvent) {
		if (disabled || !dev) return;
		event.preventDefault();
	}

	function onDragLeave(event: DragEvent) {
		if (disabled || !dev) return;
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dragging = false;
	}

	async function onDrop(event: DragEvent) {
		if (disabled || !dev) return;
		event.preventDefault();
		dragDepth = 0;
		dragging = false;
		const files = event.dataTransfer?.files;
		if (files) await handleFiles(files);
	}
</script>

<div
	class="upload-area"
	class:dragging
	class:disabled
	role="region"
	aria-label="Upload {root.dir} files"
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{#if children}
		{@render children()}
	{/if}

	{#if dev && dragging}
		<div class="drop-overlay" aria-hidden="true">
			<p class="drop-overlay-text">Drop {hint}</p>
			<p class="drop-overlay-path">static/{root.dir}/</p>
		</div>
	{/if}

	{#if dev}
		<input
			bind:this={inputEl}
			class="sr-only"
			type="file"
			accept={root.accept}
			multiple
			{disabled}
			onchange={(event) => {
				const files = event.currentTarget.files;
				if (files) void handleFiles(files);
				event.currentTarget.value = '';
			}}
		/>
	{/if}
</div>

<style>
	.upload-area {
		position: relative;
	}

	.upload-area.disabled {
		opacity: 0.55;
	}

	.drop-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 12px 8px;
		border: 1px dashed var(--ring);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--card) 88%, transparent);
		text-align: center;
		pointer-events: none;
	}

	.drop-overlay-text {
		margin: 0;
		font-size: 11px;
		color: var(--foreground);
		line-height: 1.4;
	}

	.drop-overlay-path {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--muted-foreground);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
