/**
 * Shared GLB rig inspection — skeleton family + mesh2motion-human compatibility.
 * Used by audit-characters.mjs, inspect-glb.mjs, and character-audit-smoke.mjs.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

/** @typedef {'mesh2motion-human' | 'mixamo' | 'biped' | 'custom' | 'static'} RigFamily */

/** @typedef {{
 *   path: string;
 *   rel: string;
 *   mb: number;
 *   rigged: boolean;
 *   family: RigFamily;
 *   m2mCompatible: boolean;
 *   clipCount: number;
 *   clipNames: string[];
 *   jointNames: string[];
 *   action: 'ok' | 'prop' | 'retarget';
 * }} CharacterAuditRow */

/** Parse GLB JSON chunk. */
export async function readGlbJson(glbPath) {
	const data = await readFile(glbPath);
	if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${glbPath}`);
	const jsonLen = data.readUInt32LE(12);
	return {
		bytes: data.length,
		json: JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'))
	};
}

/** All joint node names from the first skin. */
export function jointNamesFromGlb(json) {
	const skin = json.skins?.[0];
	if (!skin?.joints?.length) return [];
	return skin.joints.map((i) => json.nodes[i]?.name).filter(Boolean);
}

/** @param {string[]} names */
export function classifyRigFamily(names) {
	if (!names.length) return 'static';
	if (names.some((n) => n.toLowerCase().startsWith('mixamorig:'))) return 'mixamo';
	if (names.some((n) => /^Bip0\d/i.test(n))) return 'biped';
	const lower = new Set(names.map((n) => n.toLowerCase()));
	if (lower.has('pelvis') && [...lower].some((n) => n.startsWith('spine_'))) {
		return 'mesh2motion-human';
	}
	return 'custom';
}

/** True when skeleton matches catalog:mesh2motion-human bone contract. */
export function isMesh2MotionHuman(names) {
	return classifyRigFamily(names) === 'mesh2motion-human';
}

/** @param {string} glbPath @param {string} [rel] */
export async function auditCharacterGlb(glbPath, rel = glbPath) {
	const { bytes, json } = await readGlbJson(glbPath);
	const clipNames = (json.animations ?? []).map((a) => a.name);
	const joints = jointNamesFromGlb(json);
	const rigged = joints.length > 0 || clipNames.length > 0;
	const family = classifyRigFamily(joints);
	const m2mCompatible = isMesh2MotionHuman(joints);
	/** @type {'ok' | 'prop' | 'retarget'} */
	let action = 'prop';
	if (rigged) action = m2mCompatible ? 'ok' : 'retarget';

	return {
		path: glbPath,
		rel,
		mb: +(bytes / 1e6).toFixed(2),
		rigged,
		family,
		m2mCompatible,
		clipCount: clipNames.length,
		clipNames,
		jointNames: joints.slice(0, 16),
		action
	};
}

/** Recursively collect .glb under dir. */
async function collectGlbs(dir, base = dir, out = []) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			await collectGlbs(abs, base, out);
		} else if (entry.name.toLowerCase().endsWith('.glb')) {
			out.push({ abs, rel: relative(base, abs).replace(/\\/g, '/') });
		}
	}
	return out;
}

/** Audit every GLB under static/models/. */
export async function auditModelsDir(rootDir) {
	const modelsDir = join(rootDir, 'static', 'models');
	const files = await collectGlbs(modelsDir);
	const rows = [];
	for (const { abs, rel } of files.sort((a, b) => a.rel.localeCompare(b.rel))) {
		try {
			rows.push(await auditCharacterGlb(abs, rel));
		} catch (err) {
			rows.push({
				path: abs,
				rel,
				mb: 0,
				rigged: false,
				family: 'static',
				m2mCompatible: false,
				clipCount: 0,
				clipNames: [],
				jointNames: [],
				action: 'prop',
				error: err.message
			});
		}
	}
	return rows;
}

export function summarizeAudit(rows) {
	const rigged = rows.filter((r) => r.rigged);
	return {
		total: rows.length,
		rigged: rigged.length,
		m2mReady: rows.filter((r) => r.action === 'ok').length,
		needsRetarget: rows.filter((r) => r.action === 'retarget').length,
		staticMeshes: rows.filter((r) => r.action === 'prop').length
	};
}
