/**
 * TRL-176 — policy smoke for Player visual default allowlist.
 * Run: pnpm exec tsx scripts/player-visual-defaults-smoke.ts
 */
import assert from 'node:assert/strict';
import { registerType } from '../src/lib/engine/ontology/registry.ts';
import {
	canEditTypeDefaultField,
	canEditTypeDefaults,
	canRemoveTypeComponent,
	isEditableObjectType
} from '../src/lib/engine/runtime/typeAccess.ts';

// Minimal Player type — avoid importing spawnPlayer (pulls Svelte UI deps).
registerType({
	name: 'Player',
	components: ['Transform', 'SkinnedMesh', 'Mesh3DAnimator', 'Player', 'Physics', 'Jump'],
	defaults: {
		SkinnedMesh: { mesh: '/models/characters/mannequin.glb' }
	}
});

assert.equal(isEditableObjectType('Player'), false, 'Player composition stays locked');
assert.equal(canEditTypeDefaults('Player'), true, 'Player defaults are editable');
assert.equal(
	canEditTypeDefaultField('Player', 'SkinnedMesh', 'mesh'),
	true,
	'mesh allowlisted'
);
assert.equal(
	canEditTypeDefaultField('Player', 'Mesh3DAnimator', 'catalog'),
	true,
	'catalog allowlisted'
);
assert.equal(
	canEditTypeDefaultField('Player', 'Mesh3DAnimator', 'locomotion'),
	true,
	'locomotion allowlisted'
);
assert.equal(
	canEditTypeDefaultField('Player', 'Player', 'speed'),
	false,
	'speed not allowlisted'
);
assert.equal(
	canRemoveTypeComponent('Player', 'SkinnedMesh'),
	false,
	'cannot remove SkinnedMesh from Player'
);
assert.equal(
	canEditTypeDefaultField('Character', 'SkinnedMesh', 'mesh'),
	false,
	'Character defaults stay locked (not in allowlist)'
);

console.log('player-visual-defaults-smoke: ok');
