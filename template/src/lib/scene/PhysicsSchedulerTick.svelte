<script lang="ts">
	import { usePhysicsTask } from '@threlte/rapier';
	import { onMount } from 'svelte';
	import { GAMEPLAY_PHYSICS_TICK } from '$lib/engine/physics/physicsTaskKeys';
	import { scheduler } from '$lib/engine/systems/scheduler.svelte';

	interface Props {
		/** Advance gameplay from Rapier's physics stage while play mode is active. */
		running: boolean;
	}

	let { running }: Props = $props();

	onMount(() => scheduler.useExternalClock());

	usePhysicsTask(GAMEPLAY_PHYSICS_TICK, (delta) => {
		if (!running) return;
		scheduler.step(delta);
	});
</script>
