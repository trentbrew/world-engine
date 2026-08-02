#!/usr/bin/env node
import { auditCharacterGlb } from './character-rig.mjs';

const path = process.argv[2];
if (!path) {
	console.error('usage: node scripts/inspect-glb.mjs <path.glb>');
	process.exit(1);
}

const row = await auditCharacterGlb(path, path);
console.log(
	JSON.stringify(
		{
			path: row.path,
			mb: row.mb,
			family: row.family,
			m2mCompatible: row.m2mCompatible,
			action: row.action,
			clipCount: row.clipCount,
			clipNames: row.clipNames,
			jointNames: row.jointNames
		},
		null,
		2
	)
);
