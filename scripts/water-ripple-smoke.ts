/**
 * Smoke: water ripple emission — the gameplay half of the stylized water port.
 *
 * Covers both sides of the seam without a GPU:
 *   - waterSurface's 8 shader slots (ring buffer, count clamp, clock wrap)
 *   - waterRippleSystem's decision to emit (footprint, depth band, speed, cadence)
 *
 * Run: pnpm test:water-ripple
 */
import { createWaterSurface, WATER_DEFAULTS } from '$lib/engine/render/water/waterSurface';
import { drainWaterRipples, clearWaterRipples } from '$lib/engine/render/water/rippleBus';
import { waterRippleSystem, resetWaterRippleState } from '$lib/engine/systems/behaviors/waterRipple';
import { capsuleRestCenterY, DEFAULT_CAPSULE } from '$lib/engine/player/playerCapsuleFit';
import { world } from '$lib/engine/runtime/world.svelte';
import { ui } from '$lib/ui/ui.svelte';
import type { Entity, TickContext } from '$lib/engine/ontology/schema';
import type { ShaderMaterial, Vector2 } from 'three';

function fail(message: string): never {
	console.error(`FAIL: ${message}`);
	process.exit(1);
}
function ok(message: string): void {
	console.log(`  ok — ${message}`);
}

// ── Surface slots ────────────────────────────────────────────────────────────
console.log('waterSurface ripple slots');

const surface = createWaterSurface({ size: 20, params: WATER_DEFAULTS });
const uniforms = (surface.object3D.material as ShaderMaterial).uniforms;
const centers = uniforms.uRippleCenters.value as Vector2[];
const times = uniforms.uRippleTimes.value as number[];

if (uniforms.uRippleCount.value !== 0) fail('a fresh surface should have no ripples');

// Ripple params must reach uniforms — they were previously hardcoded at build.
if (uniforms.uRippleStrength.value !== WATER_DEFAULTS.rippleStrength) {
	fail('rippleStrength did not reach the uniform');
}
surface.setParams({ ...WATER_DEFAULTS, rippleStrength: 2.25, rippleRings: 9 });
if (uniforms.uRippleStrength.value !== 2.25) fail('setParams did not update rippleStrength');
if (uniforms.uRippleRings.value !== 4) fail('rippleRings must clamp to the shader unroll of 4');
ok('ripple params flow through setParams and rings clamp to 4');

surface.update(1.0);
surface.emitRipple(3, -4);
if (uniforms.uRippleCount.value !== 1) fail('emit did not raise the count');
if (centers[0]!.x !== 3 || centers[0]!.y !== -4) fail('center stored wrong (expects world XZ)');
if (times[0] !== uniforms.uTime.value) fail('stamp must equal the surface clock at emit');
ok('emit stores world XZ and stamps the surface clock');

for (let i = 0; i < 20; i++) surface.emitRipple(i, i);
if (uniforms.uRippleCount.value !== 8) fail(`count must clamp at 8, got ${uniforms.uRippleCount.value}`);
// 21 emits over 8 slots: only the last 8 (12..19) survive, newest landing at slot 4.
if (centers[4]!.x !== 19) fail('ring buffer did not wrap to the newest impact');
if (centers[5]!.x !== 12) fail('ring buffer dropped the wrong impact as oldest');
ok('slots ring-buffer and the count clamps at 8');

surface.dispose();

// Clock wrap: stamps are absolute points on uTime, so they must wrap with it.
// The shader reads `elapsed = max(uTime - stamp, 0)`; if a stamp is left behind at
// 3599 while uTime restarts near 0, elapsed pins to 0 and the ripple re-fires.
const wrapping = createWaterSurface({ size: 20, params: WATER_DEFAULTS });
const wrapUniforms = (wrapping.object3D.material as ShaderMaterial).uniforms;
const wrapTimes = wrapUniforms.uRippleTimes.value as number[];

wrapping.update(3599.0); // just shy of the 3600 wrap
wrapping.emitRipple(0, 0);
if (wrapUniforms.uTime.value - wrapTimes[0]! !== 0) fail('a fresh ripple should start at elapsed 0');

wrapping.update(2.0); // crosses the wrap; uTime restarts near 1.0
const elapsed = wrapUniforms.uTime.value - wrapTimes[0]!;
if (Math.abs(elapsed - 2.0) > 1e-6) {
	fail(`elapsed across the wrap should be 2.0s, got ${elapsed} — the ripple re-fires`);
}
ok('ripple stamps wrap with the clock — no hourly re-fire');
wrapping.dispose();

// ── Emission system ──────────────────────────────────────────────────────────
console.log('waterRippleSystem emission');

const WATER_ID = 'entity:water/pond';
function scene(swimmer: Partial<Entity['components']>, waterOverrides: Record<string, unknown> = {}) {
	const entities: Entity[] = [
		{
			id: WATER_ID,
			type: 'WaterSurface',
			components: {
				Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
				Water: { size: 20, ...waterOverrides }
			},
			raw: {}
		},
		{
			id: 'entity:swimmer',
			type: 'Prop',
			components: swimmer as Entity['components'],
			raw: {}
		}
	];
	world.setReady(entities, { skipAutoSelect: true });
	resetWaterRippleState();
	clearWaterRipples();
}

/** Run n ticks, moving the swimmer by `step` each time. Returns ripples emitted. */
function walk(steps: number, step: [number, number, number], dt = 1 / 60): number {
	let emitted = 0;
	let t = 0;
	const swimmer = world.getEntity('entity:swimmer')!;
	for (let i = 0; i < steps; i++) {
		const p = swimmer.components.Transform!.position as [number, number, number];
		swimmer.components.Transform!.position = [p[0] + step[0], p[1] + step[1], p[2] + step[2]];
		t += dt;
		waterRippleSystem({ dt, t, tick: i + 1 } as TickContext);
		emitted += drainWaterRipples(WATER_ID).length;
	}
	return emitted;
}

ui.shellMode = 'edit';
scene({
	Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
if (walk(60, [0.05, 0, 0]) !== 0) fail('edit mode must not emit — the sim is paused there');
ok('edit mode emits nothing');

ui.shellMode = 'play';

scene({
	Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
// 0.05/frame at 60fps = 3 u/s, well over minSpeed; 1s of walking at 0.2s cadence.
const wading = walk(60, [0.05, 0, 0]);
if (wading < 4 || wading > 6) fail(`expected ~5 ripples from 1s of wading, got ${wading}`);
ok(`wading emits on cadence (${wading} in 1s at interval 0.2)`);

scene({
	Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
// 0.002/frame = 0.12 u/s — drifting, under minSpeed.
if (walk(60, [0.002, 0, 0]) !== 0) fail('motion below minSpeed must not ripple');
ok('slow drift stays below minSpeed');

scene({
	Transform: { position: [0, 5, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
if (walk(60, [0.05, 0, 0]) !== 0) fail('an entity 5 units above the plane must not ripple');
ok('depth band excludes entities off the waterline');

scene({
	Transform: { position: [40, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
if (walk(60, [0.05, 0, 0]) !== 0) fail('an entity outside the footprint must not ripple');
ok('footprint excludes entities off the surface');

scene({
	Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: false, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
if (walk(60, [0.05, 0, 0]) !== 0) fail('enabled:false must not ripple');
ok('enabled:false opts out');

scene(
	{
		Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
		WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
	},
	{ ripples: false }
);
if (walk(60, [0.05, 0, 0]) !== 0) fail('Water.ripples:false must not receive ripples');
ok('Water.ripples:false opts the surface out');

// Players carry no WaterRipple component — buildPlayer assembles a fixed bag —
// so the system has to pick them up by type or they silently never ripple.
// A player's Transform is the capsule CENTRE, so "standing at the waterline" means
// an origin ~0.98 ABOVE it, not level with it.
const STAND_Y = capsuleRestCenterY(DEFAULT_CAPSULE, 0);
scene({ Transform: { position: [0, STAND_Y, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } });
world.getEntity('entity:swimmer')!.type = 'Player';
if (walk(60, [0.05, 0, 0]) === 0) fail('players must ripple without an authored component');
ok('players ripple with no authored component');

// The case that nearly shipped broken. Meadow's pond sits at y=0.06, so a standing
// player's ORIGIN is 0.92 above it — outside the 0.8 band. Ripples must be tested at
// the feet or players never disturb the one pond in the shipped worlds.
const POND_Y = 0.06; // static/games/meadow.jsonld → entity:water/pond
if (STAND_Y - POND_Y <= 0.8) {
	fail(`this regression needs a player standing >0.8 above the pond; got ${STAND_Y - POND_Y}`);
}
scene(
	{ Transform: { position: [0, STAND_Y + POND_Y, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } },
	{ size: 18 }
);
world.getEntity('entity:swimmer')!.type = 'Player';
world.getEntity(WATER_ID)!.components.Transform!.position = [0, POND_Y, 0];
if (walk(60, [0.05, 0, 0]) === 0) {
	fail('a player standing in the meadow pond must ripple (depth is measured at the feet)');
}
ok('a standing player ripples the meadow pond');

// A ripple lands at the emitter's world XZ, which is what the shader compares to.
scene({
	Transform: { position: [2, 0, -3], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
	WaterRipple: { enabled: true, minSpeed: 0.6, interval: 0.2, depth: 0.8 }
});
const swimmer = world.getEntity('entity:swimmer')!;
waterRippleSystem({ dt: 1 / 60, t: 1, tick: 1 } as TickContext);
swimmer.components.Transform!.position = [2.05, 0, -3];
waterRippleSystem({ dt: 1 / 60, t: 2, tick: 2 } as TickContext);
const landed = drainWaterRipples(WATER_ID);
if (landed.length !== 1) fail(`expected 1 ripple, got ${landed.length}`);
if (landed[0]!.x !== 2.05 || landed[0]!.z !== -3) {
	fail(`ripple landed at ${landed[0]!.x},${landed[0]!.z} — expected the emitter's world XZ`);
}
ok('ripple lands at the emitter world XZ');

console.log('\nPASS: water ripple emission');
