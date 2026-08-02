#!/usr/bin/env node
/** Smoke — audit script classifies known fixtures correctly. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditCharacterGlb, auditModelsDir, summarizeAudit } from './character-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

const mannequin = await auditCharacterGlb(
	join(ROOT, 'static/models/characters/mannequin.glb'),
	'characters/mannequin.glb'
);
assert(mannequin.action === 'ok', `mannequin should be M2M-ready, got ${mannequin.action}`);
assert(mannequin.family === 'mesh2motion-human', `mannequin family ${mannequin.family}`);

const xbot = await auditCharacterGlb(join(ROOT, 'static/models/characters/xbot.glb'), 'characters/xbot.glb');
assert(xbot.action === 'retarget', `xbot should need retarget, got ${xbot.action}`);
assert(xbot.family === 'mixamo', `xbot family ${xbot.family}`);

const barrel = await auditCharacterGlb(join(ROOT, 'static/models/barrel.glb'), 'barrel.glb').catch(() => null);
if (barrel) {
	assert(barrel.action === 'prop' || !barrel.rigged, 'barrel should be static prop');
}

const rows = await auditModelsDir(ROOT);
const summary = summarizeAudit(rows);
assert(summary.m2mReady >= 1, 'at least mannequin M2M-ready');
assert(summary.needsRetarget >= 1, 'at least one foreign rig flagged');

console.log('character-audit-smoke: PASS', summary);
