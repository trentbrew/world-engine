/**
 * TRL-177 — pause menu avatar picker helpers.
 * Run: pnpm exec tsx scripts/play-pause-avatar-smoke.ts
 */
import assert from 'node:assert/strict';
import {
	applyLocalPlayerAvatarMesh,
	applyPlayerAvatarMesh,
	avatarLabel,
	isAvatarModelAsset
} from '../src/lib/ui/playPauseAvatar.ts';
import type { AssetEntry } from '../src/lib/assets/catalog.ts';

function asset(partial: Partial<AssetEntry> & Pick<AssetEntry, 'url' | 'name' | 'kind'>): AssetEntry {
	return {
		size: 1,
		...partial
	};
}

assert.equal(
	isAvatarModelAsset(
		asset({ url: '/models/characters/mannequin.glb', name: 'mannequin.glb', kind: 'models' })
	),
	true,
	'mannequin configured'
);
assert.equal(
	isAvatarModelAsset(asset({ url: '/models/player.glb', name: 'player.glb', kind: 'models' })),
	true,
	'player configured'
);
assert.equal(
	isAvatarModelAsset(asset({ url: '/models/barrel.glb', name: 'barrel.glb', kind: 'models' })),
	false,
	'props excluded'
);
assert.equal(
	isAvatarModelAsset(asset({ url: '/models/crate.glb', name: 'crate.glb', kind: 'models' })),
	false,
	'unconfigured mesh excluded'
);
assert.equal(avatarLabel('/models/player.glb'), 'player');

const calls: string[] = [];
const ok = applyPlayerAvatarMesh((type, comp, field, value) => {
	calls.push(`${type}.${comp}.${field}=${String(value)}`);
	return true;
}, '/models/player.glb');
assert.equal(ok, true);
assert.ok(calls.some((c) => c.includes('SkinnedMesh.mesh=/models/player.glb')));
assert.ok(calls.some((c) => c.includes('Mesh3DAnimator.catalog=')));
assert.ok(calls.some((c) => c.includes('Mesh3DAnimator.clip=Idle_Loop')));

assert.equal(
	applyPlayerAvatarMesh(() => true, '/models/barrel.glb'),
	false,
	'reject unconfigured mesh'
);

const entity = {
	id: 'entity:player/test',
	type: 'Player',
	components: {
		SkinnedMesh: { mesh: '/models/characters/mannequin.glb', color: '#fff' },
		Mesh3DAnimator: { catalog: 'catalog:mesh2motion-human', clip: 'Idle_Loop' }
	},
	raw: {}
};
assert.equal(
	applyLocalPlayerAvatarMesh(entity, '/models/player.glb'),
	true,
	'entity avatar apply'
);
assert.equal(
	(entity.components.SkinnedMesh as { mesh?: string }).mesh,
	'/models/player.glb',
	'entity mesh updated'
);

console.log('play-pause-avatar-smoke: ok');
