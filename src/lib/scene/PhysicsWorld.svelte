<script lang="ts">
	import { World } from '@threlte/rapier';
	import type { Snippet } from 'svelte';
	import PhysicsColliderDebug from '$lib/scene/PhysicsColliderDebug.svelte';
	import PhysicsSchedulerTick from '$lib/scene/PhysicsSchedulerTick.svelte';
	import PhysicsSimGate from '$lib/scene/PhysicsSimGate.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { viewportDebug } from '$lib/ui/viewportDebug.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	const playing = $derived(ui.shellMode === 'play');
	const simRunning = $derived(playing && !ui.playPaused);
	const gravity = $derived<[number, number, number]>(
		simRunning ? worldProfile.profile.gravity : [0, 0, 0]
	);
</script>

<World {gravity} autoStart>
	<PhysicsSchedulerTick running={simRunning} />
	<PhysicsSimGate running={simRunning} />
	{#if viewportDebug.showColliders}
		<PhysicsColliderDebug />
	{/if}
	{@render children()}
</World>
