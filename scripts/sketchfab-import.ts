#!/usr/bin/env tsx
/**
 * Sketchfab → static import CLI.
 *
 *   pnpm import:sketchfab -- --search "low poly tree" [--limit 8]
 *   pnpm import:sketchfab -- --search "tree" --import-first
 *   pnpm import:sketchfab -- --uid <UID> [--name my-slug]
 */
import {
	importSketchfabModel,
	searchSketchfab,
	sketchfabConfigured,
	SketchfabError
} from '../src/lib/sketchfab/sketchfab.server';

function die(msg: string): never {
	console.error(`sketchfab-import: ${msg}`);
	process.exit(1);
}

const args = process.argv.slice(2);
const arg = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);

if (!sketchfabConfigured()) {
	die('SKETCHFAB_API_KEY not set. Add it to .env — see .env.example.');
}

const searchQuery = arg('search');
const uid = arg('uid');
const importFirst = flag('import-first');

try {
	if (searchQuery) {
		const limit = Number(arg('limit') ?? 8) || 8;
		const rows = await searchSketchfab(searchQuery, limit);

		if (importFirst) {
			if (rows.length === 0) die('no downloadable results for that query');
			const index = Math.max(0, Number(arg('index') ?? 0) || 0);
			const pick = rows[index];
			if (!pick) die(`--index ${index} out of range (${rows.length} results)`);
			console.log(`Importing first hit: ${pick.name} (${pick.uid}, ${pick.license})\n`);
			const result = await importSketchfabModel(pick.uid, { nameOverride: arg('name') });
			printImport(result);
		} else {
			console.log(JSON.stringify(rows, null, 2));
			console.log(
				`\n${rows.length} downloadable results. Import one:\n` +
					`  pnpm import:sketchfab -- --uid <UID>\n` +
					`  pnpm import:sketchfab -- --search "${searchQuery}" --import-first`
			);
		}
	} else if (uid) {
		const result = await importSketchfabModel(uid, { nameOverride: arg('name') });
		printImport(result);
	} else {
		die('usage: --search "<query>" [--limit N] [--import-first]  |  --uid <UID> [--name <slug>]');
	}
} catch (err) {
	die(err instanceof SketchfabError ? err.message : (err as Error).message);
}

function printImport(result: Awaited<ReturnType<typeof importSketchfabModel>>) {
	console.log(
		`\n✓ ${result.url}  (${result.sizeMb} MB, ${result.rigged ? 'RIGGED → Character' : 'static → Prop'})`
	);
	console.log(`  Model: ${result.modelName}  |  license: ${result.license}`);
	console.log(
		result.rigged
			? '  Place it → spawn_character with this url, or drag from Assets → Models.'
			: '  Place it → spawn_prop with this url, or drag from Assets → Models.'
	);
	console.log(`  Provenance: static/${result.destDir}/${result.slug}.glb.provenance.json`);
}
