/**
 * Locks the leva → params conversion for the vendored grass field.
 *
 * The risk this guards: upstream's presets are keyed by PARAM name
 * (`grColorBottom`), while the shader wants UNIFORM names (`uGrassBottom`).
 * The only thing that knows the mapping is applyParams.ts, transcribed from a
 * `useFrame` body. A dropped or reordered line there is silent — the scene
 * still renders, just wrong. So: assert every param reaches a uniform, and
 * assert the preset round trip upstream's own comments call out.
 *
 * No browser needed. Run: pnpm exec tsx scripts/grass-params-smoke.ts
 */
import { Color } from 'three';
import {
	GRASS_DEFAULTS,
	GRASS_PARAM_KEYS,
	GRASS_PARAM_META,
	REBUILD_KEYS,
	coerceGrassParams,
	needsRebuild,
	resolveGrassParams,
	type GrassParams
} from '$lib/engine/render/grass/params';
import { GRASS_PRESETS } from '$lib/engine/render/grass/presets';
import { getComponent, getType } from '$lib/engine/ontology/registry';
import { createGrassFieldUniforms } from '$lib/engine/render/grass/uniforms';
import { applyGrassParams, tickGrassTime } from '$lib/engine/render/grass/applyParams';

let checks = 0;
function ok(condition: boolean, message: string) {
	checks++;
	if (!condition) throw new Error(message);
}

// ── 1. SPEC integrity ────────────────────────────────────────────────────────
ok(GRASS_PARAM_KEYS.length > 90, `expected ~100 params, got ${GRASS_PARAM_KEYS.length}`);
ok(
	Object.keys(GRASS_DEFAULTS).length === GRASS_PARAM_KEYS.length,
	'GRASS_DEFAULTS and GRASS_PARAM_KEYS disagree'
);
for (const key of GRASS_PARAM_KEYS) {
	ok(GRASS_PARAM_META[key] !== undefined, `no meta for ${key}`);
	ok(typeof GRASS_PARAM_META[key].label === 'string', `${key} has no label`);
	const v = GRASS_DEFAULTS[key];
	const meta = GRASS_PARAM_META[key];
	if (typeof v === 'number' && meta.min !== undefined && meta.max !== undefined) {
		ok(v >= meta.min && v <= meta.max, `${key} default ${v} outside [${meta.min}, ${meta.max}]`);
	}
}

// The 8 geometry params upstream marks "(rebuilds)", plus the flower scatter set.
for (const key of ['grDensity', 'grMaxCount', 'grMinWidth', 'grMaxWidth', 'grMinLength', 'grMaxLength', 'grTiltMax', 'grSegments'] as const) {
	ok(REBUILD_KEYS.includes(key), `${key} must be a rebuild key`);
}
ok(!REBUILD_KEYS.includes('grWindStrength'), 'wind must NOT rebuild — it is a live uniform');
ok(!REBUILD_KEYS.includes('grColorBottom'), 'colour must NOT rebuild — it is a live uniform');

// ── 2. Every preset key is a real param ──────────────────────────────────────
// A preset naming a param that no longer exists is dead weight that silently
// does nothing — exactly the kind of drift vendoring invites.
for (const [name, preset] of Object.entries(GRASS_PRESETS)) {
	for (const key of Object.keys(preset.values)) {
		ok(
			(GRASS_PARAM_KEYS as string[]).includes(key),
			`preset "${name}" sets unknown param "${key}"`
		);
	}
}

// ── 3. The A → B → A round trip ──────────────────────────────────────────────
// Upstream's presets.ts is explicit that a preset names only its deltas, so
// switching away and back must land exactly where it started.
const a1 = resolveGrassParams('default');
resolveGrassParams('mars');
const a2 = resolveGrassParams('default');
for (const key of GRASS_PARAM_KEYS) {
	ok(a1[key] === a2[key], `default → mars → default drifted on ${key}: ${a1[key]} vs ${a2[key]}`);
}

const mars = resolveGrassParams('mars');
ok(
	GRASS_PARAM_KEYS.some((k) => mars[k] !== a1[k]),
	'the mars preset changed nothing — resolveGrassParams is not applying presets'
);

// An unknown preset must fall back, not throw: world files are data.
const bogus = resolveGrassParams('does-not-exist');
ok(bogus.grColorBottom === a1.grColorBottom, 'unknown preset should fall back to defaults');

// Overrides win over the preset.
const overridden = resolveGrassParams('default', { grDensity: 42 });
ok(overridden.grDensity === 42, 'overrides must beat the preset');

// ── 4. coerceGrassParams ─────────────────────────────────────────────────────
const coerced = coerceGrassParams({
	grDensity: '120', // strings from JSON-LD / agent input
	grTintFloor: 'true',
	grColorBottom: '#ff0000',
	nonsense: 1,
	grSegments: 'not-a-number'
});
ok(coerced.grDensity === 120, 'numeric strings must coerce');
ok(coerced.grTintFloor === true, 'boolean strings must coerce');
ok(coerced.grColorBottom === '#ff0000', 'colours pass through');
ok(!('nonsense' in coerced), 'unknown keys must be dropped');
ok(!('grSegments' in coerced), 'non-numeric input for a number must be dropped, not NaN');

// ── 5. needsRebuild ──────────────────────────────────────────────────────────
const base = resolveGrassParams('default');
ok(!needsRebuild(base, { ...base }), 'identical params must not rebuild');
ok(!needsRebuild(base, { ...base, grWindStrength: 0.9 }), 'wind change must not rebuild');
ok(needsRebuild(base, { ...base, grSegments: 5 }), 'segment change MUST rebuild');

// ── 6. THE mapping: every param reaches a uniform ────────────────────────────
// Mutate one param at a time and require the uniform bag to change. This is the
// assertion that catches a line dropped from the transcription.
function snapshot(u: ReturnType<typeof createGrassFieldUniforms>): string {
	const parts: string[] = [];
	for (const bag of [u.surface, u.flower, u.bark] as Record<string, { value: unknown }>[]) {
		for (const name of Object.keys(bag).sort()) {
			const v = bag[name]?.value;
			if (v === undefined || v === null) continue;
			if (typeof v === 'object') {
				const o = v as Record<string, number>;
				// Colors, Vector2/3/4 — enough of a fingerprint to detect a change.
				parts.push(`${name}:${o.r ?? o.x ?? ''},${o.g ?? o.y ?? ''},${o.b ?? o.z ?? ''}`);
			} else {
				parts.push(`${name}:${String(v)}`);
			}
		}
	}
	return parts.join('|');
}

/** Params that legitimately drive no uniform (geometry, scatter, PBR override). */
const NON_UNIFORM: string[] = [
	...REBUILD_KEYS,
	'matOverride',
	'roughness',
	'metalness',
	'envIntensity',
	'flatShading'
];

/**
 * Params whose effect is gated behind another param. Probing them at defaults
 * would (correctly) show no uniform change, so the gate has to be opened first.
 * The linked-patch branch is asserted directly in §7.
 */
const PROBE_PRECONDITION: Partial<Record<keyof GrassParams, Partial<GrassParams>>> = {
	grPatchDry: { grPatchLinkColors: false },
	grPatchLush: { grPatchLinkColors: false }
};

/** A value guaranteed different from the default, respecting the declared range. */
function nudge(key: keyof GrassParams): GrassParams[keyof GrassParams] {
	const current = GRASS_DEFAULTS[key];
	if (typeof current === 'boolean') return !current;
	if (typeof current === 'string') return current === '#123456' ? '#654321' : '#123456';
	const meta = GRASS_PARAM_META[key];
	const min = meta.min ?? 0;
	const max = meta.max ?? current + 1;
	// Move to whichever end is further away, so the change is always real.
	return Math.abs(max - current) > Math.abs(current - min) ? max : min;
}

const u = createGrassFieldUniforms();
applyGrassParams(u, GRASS_DEFAULTS);
const baseline = snapshot(u);

const unreached: string[] = [];
for (const key of GRASS_PARAM_KEYS) {
	if (NON_UNIFORM.includes(key)) continue;
	const pre = PROBE_PRECONDITION[key] ?? {};
	const control = { ...GRASS_DEFAULTS, ...pre } as GrassParams;
	const probe = { ...control, [key]: nudge(key) } as GrassParams;
	if (probe[key] === control[key]) continue; // nothing to test

	// Compare against the gate-open control, not the global baseline, so the
	// precondition itself isn't what registers as the change.
	const uControl = createGrassFieldUniforms();
	applyGrassParams(uControl, control);
	const uProbe = createGrassFieldUniforms();
	applyGrassParams(uProbe, probe);
	if (snapshot(uProbe) === snapshot(uControl)) unreached.push(key);
}
void baseline;
ok(
	unreached.length === 0,
	`these params drive no uniform — a line is missing from applyParams.ts: ${unreached.join(', ')}`
);

// ── 7. The linked-patch branch ───────────────────────────────────────────────
// grPatchLinkColors reads OTHER params, which is why applyParams.ts must not be
// reordered. Linked: patch colours follow the blade colours.
const linked = createGrassFieldUniforms();
applyGrassParams(linked, {
	...GRASS_DEFAULTS,
	grPatchLinkColors: true,
	grColorBottom: '#112233',
	grColorTop: '#445566'
});
ok(
	linked.surface.uPatchLush.value.getHexString() === new Color('#112233').getHexString(),
	'linked patches must take the blade bottom colour'
);
ok(
	linked.surface.uPatchDry.value.getHexString() === new Color('#445566').getHexString(),
	'linked patches must take the blade top colour'
);

const unlinked = createGrassFieldUniforms();
applyGrassParams(unlinked, {
	...GRASS_DEFAULTS,
	grPatchLinkColors: false,
	grPatchLush: '#0a0b0c',
	grPatchDry: '#0d0e0f'
});
ok(
	unlinked.surface.uPatchLush.value.getHexString() === new Color('#0a0b0c').getHexString(),
	'unlinked patches must use their own colours'
);

// ── 8. tickGrassTime ─────────────────────────────────────────────────────────
const t = createGrassFieldUniforms();
tickGrassTime(t, 0.5);
ok(t.surface.uTime.value === 0.5, 'time must advance');
ok(t.flower.uTime.value === 0.5, 'flower time must mirror surface time');
t.surface.uTime.value = 3599.75;
tickGrassTime(t, 0.5);
ok(t.surface.uTime.value < 1, 'time must wrap at 3600 to keep float precision');

// ── 9. Ontology registration ─────────────────────────────────────────────────
// Registering a renderable takes FOUR steps, and missing any one fails quietly:
// the component, the type, the view (registerViews.ts), and PICKABLE_COMPONENTS
// in world.svelte.ts. Skipping the last one is what made the first meadow load
// show "1 entity" with the grass invisible to selection and the entity tree.
const grassComponent = getComponent('GrassField');
ok(grassComponent !== undefined, 'GrassField component is not registered');
for (const field of ['model', 'size', 'preset', 'density', 'params', 'stillInEdit']) {
	ok(field in grassComponent!.fields, `GrassField schema is missing "${field}"`);
}
ok(
	grassComponent!.fields.preset.options?.every((p) => p in GRASS_PRESETS) ?? false,
	'GrassField preset options must all exist in GRASS_PRESETS'
);

const grassType = getType('GrassField');
ok(grassType !== undefined, 'GrassField type is not registered');
ok(
	grassType!.components.includes('Transform') && grassType!.components.includes('GrassField'),
	'GrassField type must carry Transform + GrassField'
);

// The Light shadow fields the blade shader depends on: it samples
// directionalShadowMap[0], and three's default ±5 ortho frustum does not cover
// a field of any size.
const lightComponent = getComponent('Light');
for (const field of ['color', 'shadowMapSize', 'shadowCamSize', 'shadowNormalBias']) {
	ok(field in lightComponent!.fields, `Light schema is missing "${field}"`);
}

console.log(
	`grass params smoke: ok — ${checks} checks, ${GRASS_PARAM_KEYS.length} params ` +
		`(${REBUILD_KEYS.length} rebuild), ${Object.keys(GRASS_PRESETS).length} presets, ` +
		`ontology registered.`
);
