/**
 * In-memory reference implementation of TrellisWorldClient. Holds worlds as EAV
 * triples and serves them as JSON-LD via the same `queryWorld` contract the real
 * Trellis browser client will implement. Use it to develop/test the durable tier
 * before the SDK lands:
 *
 *   const client = new MemoryTrellisClient();
 *   client.put('arena', triples);
 *   const entities = await loadOntology(trellisSource(client, 'arena'));
 */
import type { JsonLdDoc } from '../source';
import type { TrellisWorldClient } from './trellis';
import { eavToGraph, type EavTriple } from './eav';

export class MemoryTrellisClient implements TrellisWorldClient {
	#worlds = new Map<string, EavTriple[]>();

	put(worldId: string, triples: EavTriple[]) {
		this.#worlds.set(worldId, triples);
	}

	async queryWorld(worldId: string): Promise<JsonLdDoc> {
		const triples = this.#worlds.get(worldId);
		if (!triples) throw new Error(`No world "${worldId}" in MemoryTrellisClient`);
		return eavToGraph(triples);
	}
}
