/**
 * World Author API smoke — requires dev server on :9292.
 * Run: pnpm dev (separate terminal) && pnpm test:world-api
 */
const BASE = (process.env.WORLD_AUTHOR_URL ?? 'http://localhost:9292').replace(/\/$/, '');

async function api(path, init) {
	const response = await fetch(`${BASE}${path}`, {
		headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
		...init
	});
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		throw new Error(`${path} → invalid JSON: ${text.slice(0, 200)}`);
	}
	if (!response.ok) {
		throw new Error(`${path} → ${response.status}: ${text}`);
	}
	return body;
}

try {
	const games = await api('/api/world');
	if (!Array.isArray(games.games) || games.games.length < 1) {
		throw new Error('world_list: expected games array');
	}

	const schema = await api('/api/world/schema');
	if (!Array.isArray(schema.components) || !schema.components.some((c) => c.name === 'Transform')) {
		throw new Error('world_schema: missing Transform');
	}

	const summary = await api('/api/world/blank');
	if (summary.entityCount < 1) throw new Error('world_summary: blank world empty');

	const patch = await api('/api/world/blank/patch', {
		method: 'POST',
		body: JSON.stringify({
			patch: {
				entityId: 'entity:ground/main',
				component: 'Ground',
				field: 'color',
				value: '#101018'
			}
		})
	});
	if (!patch.ok) throw new Error('world_patch failed');

	const entity = await api(
		`/api/world/blank/entity?id=${encodeURIComponent('entity:ground/main')}`
	);
	const color = entity.entity?.components?.Ground?.color;
	if (color !== '#101018') throw new Error(`set_field: expected #101018, got ${color}`);

	const spawned = await api('/api/world/blank/spawn', {
		method: 'POST',
		body: JSON.stringify({
			type: 'Prop',
			position: [3, 0.5, 3],
			overrides: { Render: { color: '#aabbcc' } }
		})
	});
	const spawnId = spawned.entity?.id;
	if (!spawnId) throw new Error('world_spawn: missing id');

	await api(`/api/world/blank/entity?id=${encodeURIComponent(spawnId)}`, { method: 'DELETE' });

	await api('/api/world/blank/patch', {
		method: 'POST',
		body: JSON.stringify({
			patch: {
				entityId: 'entity:ground/main',
				component: 'Ground',
				field: 'color',
				value: '#0e0e12'
			}
		})
	});

	// --- animation clip catalogs (Phase 3) ---------------------------------
	const catalogs = await api('/api/animation/catalogs');
	const human = (catalogs.catalogs ?? []).find((c) => c.id === 'catalog:mesh2motion-human');
	if (!human || human.clipCount < 1) throw new Error('animation_list_catalogs: mesh2motion-human missing');

	const detail = await api('/api/animation/clips?catalog=catalog:mesh2motion-human');
	const clipIds = (detail.clips ?? []).map((c) => c.id);
	if (!clipIds.includes('Walk_Loop')) throw new Error('animation_list_clips: missing Walk_Loop');
	if (clipIds.includes('Bogus_NotReal')) throw new Error('animation_list_clips: unexpected bogus clip');

	let unknownThrew = false;
	try {
		await api('/api/animation/clips?catalog=definitely-not-real');
	} catch {
		unknownThrew = true;
	}
	if (!unknownThrew) throw new Error('animation_list_clips: unknown catalog should 404');

	// world_set_character_clip flow: spawn a Character, validate + set its clip.
	const char = await api('/api/world/blank/spawn', {
		method: 'POST',
		body: JSON.stringify({ type: 'Character', position: [1, 0, 1] })
	});
	const charId = char.entity?.id;
	if (!charId) throw new Error('spawn Character: missing id');

	const charRead = await api(`/api/world/blank/entity?id=${encodeURIComponent(charId)}`);
	const animator = charRead.entity?.components?.Mesh3DAnimator;
	if (!animator) throw new Error('spawned Character missing Mesh3DAnimator component');
	// Spawned bags are empty in the file (schema defaults resolve at load time), so
	// world_set_character_clip falls back to the default catalog — mirror that here.
	const charCatalog = animator.catalog ?? 'catalog:mesh2motion-human';
	// The exact membership check world_set_character_clip performs before patching.
	const validClips = (await api(`/api/animation/clips?catalog=${encodeURIComponent(charCatalog)}`)).clips.map((c) => c.id);
	if (!validClips.includes('Walk_Loop') || validClips.includes('Bogus_NotReal')) {
		throw new Error('set_character_clip: validation set wrong');
	}

	await api('/api/world/blank/patch', {
		method: 'POST',
		body: JSON.stringify({
			patch: { entityId: charId, component: 'Mesh3DAnimator', field: 'clip', value: 'Walk_Loop' }
		})
	});
	const charAfter = await api(`/api/world/blank/entity?id=${encodeURIComponent(charId)}`);
	if (charAfter.entity?.components?.Mesh3DAnimator?.clip !== 'Walk_Loop') {
		throw new Error('set_character_clip: clip not applied');
	}

	await api(`/api/world/blank/entity?id=${encodeURIComponent(charId)}`, { method: 'DELETE' });

	console.log(
		'world-api-smoke: PASS — list, schema, patch, spawn, delete, animation catalogs/clips/set-character-clip'
	);
} catch (error) {
	console.error('world-api-smoke: FAIL —', error instanceof Error ? error.message : error);
	process.exit(1);
}
