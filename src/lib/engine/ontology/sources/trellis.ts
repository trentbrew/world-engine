/**
 * Trellis durable source — the integration point for backing a world's *rules*
 * with a Trellis graph instead of a static file.
 *
 * The durability split (see the engine README / AGENTS.md): Trellis owns the
 * durable, op-logged graph — component schemas, entity types, instances,
 * relationships, persistent progression. The realtime tier (transforms, etc.)
 * stays on PartyKit and never enters the op-log. So all this adapter must do is
 * turn a Trellis query result into the same JSON-LD `@graph` the loader already
 * understands; entities map 1:1 to Trellis nodes, components to attributes.
 *
 * This ships as a typed seam rather than a hard dependency: pass any client that
 * can return the world graph. Once Trellis' browser client is wired in, this is
 * the only file that changes — `loadOntology(trellisSource(client))` and done.
 */
import type { JsonLdDoc, WorldSource } from '../source';

export interface TrellisWorldClient {
	/** Return the world as a JSON-LD document ({ '@graph': [...] }). */
	queryWorld(worldId: string): Promise<JsonLdDoc>;
}

export function trellisSource(client: TrellisWorldClient, worldId: string): WorldSource {
	return () => client.queryWorld(worldId);
}
