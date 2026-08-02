<script lang="ts">
	import { T } from '@threlte/core';
	import { playerSpawnRings } from '$lib/engine/player/spawnPoints';
	import { session } from '$lib/engine/net/session.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const rings = $derived(ui.shellMode === 'play' ? playerSpawnRings(session.members) : []);
</script>

{#each rings as ring (ring.clientId)}
	<T.Group position={[ring.position[0], ring.position[1], ring.position[2]]}>
		<T.Mesh>
			<T.CylinderGeometry args={[0.4, 0.4, 0.05, 24]} />
			<T.MeshStandardMaterial color={ring.color} transparent opacity={0.55} />
		</T.Mesh>
		<T.Mesh position.y={0.03} rotation.x={-Math.PI / 2}>
			<T.TorusGeometry args={[0.6, 0.03, 8, 32]} />
			<T.MeshStandardMaterial color={ring.color} transparent opacity={0.55} />
		</T.Mesh>
	</T.Group>
{/each}
