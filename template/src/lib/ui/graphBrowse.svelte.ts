/**
 * Graph route — browse the world's ontology as nodes (types, components, entities).
 * Read-only scaffold; edits stay in Rooms / Objects / Collections routes for now.
 */

import { listCollections, listComponents, listTypes } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';

export type GraphNodeKind = 'all' | 'type' | 'component' | 'entity' | 'collection';

export type GraphNode = {
	id: string;
	kind: Exclude<GraphNodeKind, 'all'>;
	label: string;
	detail: string;
};

const KIND_LABELS: Record<Exclude<GraphNodeKind, 'all'>, string> = {
	type: 'Type',
	component: 'Component',
	entity: 'Entity',
	collection: 'Collection'
};

class GraphBrowseState {
	filter = $state<GraphNodeKind>('all');
	selection = $state<string | null>(null);
	search = $state('');

	readonly nodes = $derived.by((): GraphNode[] => {
		void world.entities.length;
		void world.componentRevision;
		void world.typeRevision;

		const nodes: GraphNode[] = [];

		for (const name of listTypes()) {
			const isCollection = listCollections().includes(name);
			nodes.push({
				id: isCollection ? `collection:${name}` : `type:${name}`,
				kind: isCollection ? 'collection' : 'type',
				label: name,
				detail: isCollection ? 'Collection type' : 'Entity type'
			});
		}

		for (const name of listComponents()) {
			nodes.push({
				id: `component:${name}`,
				kind: 'component',
				label: name,
				detail: 'Component schema'
			});
		}

		for (const entity of world.entities) {
			if (entity.id.startsWith('entity:player/')) continue;
			const typeName = entity.type ?? 'Thing';
			nodes.push({
				id: entity.id,
				kind: 'entity',
				label: entity.id.replace(/^entity:/, ''),
				detail: typeName
			});
		}

		return nodes.sort((a, b) => a.label.localeCompare(b.label));
	});

	readonly filteredNodes = $derived.by(() => {
		const query = this.search.trim().toLowerCase();
		return this.nodes.filter((node) => {
			if (this.filter !== 'all' && node.kind !== this.filter) return false;
			if (!query) return true;
			return (
				node.label.toLowerCase().includes(query) ||
				node.detail.toLowerCase().includes(query) ||
				node.id.toLowerCase().includes(query)
			);
		});
	});

	readonly selectedNode = $derived(
		this.selection ? (this.nodes.find((node) => node.id === this.selection) ?? null) : null
	);

	select(id: string) {
		this.selection = id;
	}

	setFilter(kind: GraphNodeKind) {
		this.filter = kind;
	}

	kindLabel(kind: GraphNodeKind): string {
		if (kind === 'all') return 'All';
		return KIND_LABELS[kind];
	}
}

export const graphBrowse = new GraphBrowseState();
