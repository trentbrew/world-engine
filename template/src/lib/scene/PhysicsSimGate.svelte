<script lang="ts">
	import { useRapier } from '@threlte/rapier';

	interface Props {
		/** Run the Rapier simulation (play mode). */
		running: boolean;
	}

	let { running }: Props = $props();

	// <World autoStart> is captured once at context creation — it never reacts to
	// prop changes, so a world mounted in edit mode stays paused forever. Drive
	// pause/resume reactively from in here, where the rapier context is available.
	const { pause, resume } = useRapier();

	$effect(() => {
		if (running) resume();
		else pause();
	});
</script>
