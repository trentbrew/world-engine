/**
 * Smoke: player outlines are a multiplayer affordance, not a permanent rim light.
 *
 * The outline colors avatars by peer so you can tell who is who. Alone in a room it
 * has nothing to distinguish and just reads as a rendering artifact, so it stays off
 * until someone else is present. Worth pinning: the regression that matters (outlines
 * gone when a peer IS present) is invisible while developing solo.
 *
 * Run: pnpm test:player-outline
 */
import { outlineLayers } from '$lib/engine/render/outlineLayers';
import { session } from '$lib/engine/net/session.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import { ui } from '$lib/ui/ui.svelte';
import type { Entity } from '$lib/engine/ontology/schema';

function fail(message: string): never {
	console.error(`FAIL: ${message}`);
	process.exit(1);
}
function ok(message: string): void {
	console.log(`  ok — ${message}`);
}

const player: Entity = {
	id: 'entity:player/alice',
	type: 'Player',
	components: {
		Transform: { position: [0, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
		Player: { color: '#ff8844', clientId: 'alice' }
	},
	raw: {}
};
world.setReady([player], { skipAutoSelect: true });
ui.shellMode = 'play';

const playerLayers = () => outlineLayers().filter((l) => l.id.startsWith('player:'));

session.peers = {};
if (playerLayers().length !== 0) fail('solo play must not outline the local avatar');
ok('solo play draws no player outline');

session.peers = { bob: 1 };
// members = [self, bob] once connected; offline the empty clientId drops out, so a
// single fake peer is still a one-member room.
if (playerLayers().length !== 0) fail('a one-member room must not outline');
ok('a one-member room draws no player outline');

session.peers = { alice: 1, bob: 1 };
if (session.peerCount !== 2) fail(`expected peerCount 2, got ${session.peerCount}`);
const withPeer = playerLayers();
if (withPeer.length !== 1) fail(`a shared room must outline players, got ${withPeer.length}`);
if (withPeer[0]!.color !== '#ff8844') fail('outline must carry the player designated color');
ok('a shared room outlines players in their peer color');

session.peers = {};
ui.shellMode = 'edit';
if (playerLayers().length !== 0) fail('edit mode has its own selection outlines, not play ones');
ok('edit mode draws no play-mode player outline');

console.log('\nPASS: player outline gating');
