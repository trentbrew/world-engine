<script lang="ts">
	// Side-effect import: registers built-in component views.
	import '$lib/engine/render/registerViews';
	import { getView, viewComponentsFor } from '$lib/engine/ontology/registry';
	import { eraGateVisible, museumDecade } from '$lib/engine/world/eraGate';
	import { world } from '$lib/engine/runtime/world.svelte';
	import type { Entity } from '$lib/engine/ontology/schema';
	import PhysicsBody from '$lib/engine/render/PhysicsBody.svelte';
	import { OBJECT_STAGE_KEY, type ObjectStageContext } from '$lib/scene/objectStage';
	import { getContext } from 'svelte';
	import Self from './Thing.svelte';

	let { entity }: { entity: Entity } = $props();

	const objectStage = getContext<ObjectStageContext | undefined>(OBJECT_STAGE_KEY);
	const decade = $derived(museumDecade(world));
	const eraVisible = $derived(eraGateVisible(entity, decade));
	const hasPhysics = $derived('Physics' in entity.components && !objectStage?.skipPhysics);
	const renderable = $derived(viewComponentsFor(Object.keys(entity.components)));
	const children = $derived(
		(entity.children ?? [])
			.map((id) => world.getEntity(id))
			.filter((child): child is Entity => child !== undefined)
	);
</script>

{#snippet entityViews()}
	{#each renderable as name (name)}
		{@const View = getView(name)}
		{#if View}
			<View {entity} />
		{/if}
	{/each}
{/snippet}

{#if eraVisible}
	{#if hasPhysics}
		<PhysicsBody {entity}>
			{@render entityViews()}
		</PhysicsBody>
	{:else}
		{@render entityViews()}
	{/if}

	{#each children as child (child.id)}
		<Self entity={child} />
	{/each}
{/if}
