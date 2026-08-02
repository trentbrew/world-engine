<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferGeometry, Float32BufferAttribute, type Line } from 'three';
	import { peerColor } from '$lib/engine/collab/peerColor';
	import { isPlayerEntity, playerClientId } from '$lib/engine/player/access';
	import { outlineLayers } from '$lib/engine/render/outlineLayers';
	import { entityFootprint } from '$lib/scene/entityFootprint';
	import {
		overlayCircleBorderGeometry,
		overlayGroupRotation,
		overlayRectBorderGeometry
	} from '$lib/scene/playPlane';
	import { session } from '$lib/engine/net/session.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const visible = $derived(
		ui.shellMode === 'edit' && ui.chrome.selectionOutline && !ui.placementDraft
	);

	const playPlane = $derived(worldProfile.profile.plane);
	const overlayRotation = $derived(overlayGroupRotation(playPlane));

	const footprints = $derived.by(() => {
		if (!visible) return [];

		return outlineLayers()
			.flatMap((layer) =>
				layer.entityIds.map((entityId) => {
					const entity = world.getEntity(entityId);
					if (!entity) return null;
					const footprint = entityFootprint(entity, playPlane);
					if (!footprint) return null;

					const clientId = isPlayerEntity(entity) ? playerClientId(entity) : null;
					const color =
						layer.id === 'hover'
							? '#ffffff'
							: clientId != null
								? peerColor(clientId)
								: session.connected
									? peerColor(session.clientId)
									: layer.color;

					return {
						key: `${layer.id}:${entityId}`,
						footprint,
						color,
						emphasized: layer.emphasized,
						isHover: layer.id === 'hover',
						showFill: footprint.fill !== false
					};
				})
			)
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
	});

	function rectBorderGeometry(width: number, depth: number) {
		const geometry = new BufferGeometry();
		geometry.setAttribute(
			'position',
			new Float32BufferAttribute(overlayRectBorderGeometry(width, depth, playPlane), 3)
		);
		return geometry;
	}

	function circleBorderGeometry(radius: number, segments = 48) {
		const geometry = new BufferGeometry();
		geometry.setAttribute(
			'position',
			new Float32BufferAttribute(overlayCircleBorderGeometry(radius, playPlane, segments), 3)
		);
		return geometry;
	}

	function onBorderLineCreate(line: Line) {
		line.computeLineDistances();
	}
</script>

{#if visible}
	{#each footprints as entry (entry.key)}
		{@const { footprint, color, emphasized, isHover, showFill } = entry}
		<T.Group position={footprint.center}>
			<T.Group rotation.y={footprint.yaw}>
				<T.Group rotation={overlayRotation}>
					{#if showFill}
						{#if footprint.shape === 'circle'}
							<T.Mesh renderOrder={2}>
								<T.CircleGeometry args={[footprint.radius, 48]} />
								<T.MeshBasicMaterial
									{color}
									transparent
									opacity={isHover ? 0.08 : emphasized ? 0.16 : 0.12}
									depthTest={false}
									depthWrite={false}
								/>
							</T.Mesh>
						{:else}
							<T.Mesh renderOrder={2}>
								<T.PlaneGeometry args={[footprint.width, footprint.depth]} />
								<T.MeshBasicMaterial
									{color}
									transparent
									opacity={isHover ? 0.08 : emphasized ? 0.16 : 0.12}
									depthTest={false}
									depthWrite={false}
								/>
							</T.Mesh>
						{/if}
					{/if}
				</T.Group>
				{#if footprint.shape === 'circle'}
					<T.Line
						geometry={circleBorderGeometry(footprint.radius)}
						oncreate={onBorderLineCreate}
						renderOrder={3}
					>
						<T.LineDashedMaterial
							{color}
							dashSize={0.1}
							gapSize={0.07}
							transparent
							opacity={isHover ? 0.45 : emphasized ? 0.8 : 0.6}
							depthTest={false}
							depthWrite={false}
						/>
					</T.Line>
				{:else}
					<T.Line
						geometry={rectBorderGeometry(footprint.width, footprint.depth)}
						oncreate={onBorderLineCreate}
						renderOrder={3}
					>
						<T.LineDashedMaterial
							{color}
							dashSize={0.12}
							gapSize={0.08}
							transparent
							opacity={isHover ? 0.45 : emphasized ? 0.8 : 0.6}
							depthTest={false}
							depthWrite={false}
						/>
					</T.Line>
				{/if}
			</T.Group>
		</T.Group>
	{/each}
{/if}
