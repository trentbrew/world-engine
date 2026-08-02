/** Smoke — catalog locomotion bindings + type override merge (TRL-157 / TRL-199). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	applyLocomotionOverride,
	M2M_HUMAN_LOCOMOTION,
	parseLocomotionOverride
} from '../src/lib/engine/animation/clipCatalog.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const EXPECTED = {
	idle: 'Idle_Loop',
	walk: 'Walk_Loop',
	jog: 'Jog_Fwd_Loop',
	run: 'Sprint_Loop',
	sprint: 'Sprint_Loop',
	jumpStart: 'Jump_Start',
	jumpLoop: 'Jump_Loop',
	jumpLand: 'Jump_Land',
	doubleJumpStart: 'NinjaJump_Start',
	doubleJumpLoop: 'NinjaJump_Idle_Loop',
	doubleJumpLand: 'NinjaJump_Land'
};

const root = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
	readFileSync(path.join(root, '../static/catalogs/mesh2motion-human.json'), 'utf8')
) as {
	locomotion?: Record<string, string>;
	clips?: { id: string; loop?: boolean }[];
};

assert(catalog.locomotion, 'mesh2motion-human.json missing locomotion map');

for (const [key, expected] of Object.entries(EXPECTED)) {
	assert(
		catalog.locomotion![key] === expected,
		`locomotion.${key}: expected ${expected}, got ${catalog.locomotion![key]}`
	);
}

const clipMeta = new Map((catalog.clips ?? []).map((c) => [c.id, c.loop]));
assert(clipMeta.get(EXPECTED.idle) === true, 'idle loop meta');
assert(clipMeta.get(EXPECTED.jumpStart) === false, 'jumpStart one-shot');

// TRL-199 — override merge
assert(Object.keys(parseLocomotionOverride(undefined)).length === 0, 'absent → empty');
assert(Object.keys(parseLocomotionOverride({})).length === 0, '{} → empty');
assert(Object.keys(parseLocomotionOverride({ walk: '' })).length === 0, 'blank string ignored');
assert(parseLocomotionOverride({ walk: 'Jog_Fwd_Loop', nope: 'x' }).walk === 'Jog_Fwd_Loop', 'parse walk');
assert(
	!('nope' in parseLocomotionOverride({ walk: 'Jog_Fwd_Loop', nope: 'x' })),
	'unknown key ignored'
);

const merged = applyLocomotionOverride(M2M_HUMAN_LOCOMOTION, { walk: 'Jog_Fwd_Loop' });
assert(merged.walk === 'Jog_Fwd_Loop', 'override wins walk');
assert(merged.idle === M2M_HUMAN_LOCOMOTION.idle, 'unset keys keep catalog');
assert(M2M_HUMAN_LOCOMOTION.walk === 'Walk_Loop', 'base map not mutated');

console.log('player-locomotion-bindings-smoke: PASS');
