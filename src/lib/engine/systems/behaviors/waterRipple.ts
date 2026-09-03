/**
 * Ripple emission — the gameplay half of the stylized water port.
 *
 * The shader has always had the ripple uniforms (they came over with the surface);
 * what was missing was anything to decide WHO is standing in the water. Upstream
 * answered that per-object, with each floating component calling a `useWaterRipple`
 * hook on itself. That does not translate: here the water is an entity with a
 * footprint, the swimmer is an entity with a position, and the overlap between the
 * two is exactly the kind of thing a system is for.
 *
 * Emits into `rippleBus`, which `WaterSurfaceView` drains — see that file for why
 * ripples never touch the entity graph.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { capsuleFitFor, DEFAULT_CAPSULE } from '$lib/engine/player/playerCapsuleFit';
import { emitWaterRipple } from '$lib/engine/render/water/rippleBus';
import { world } from '$lib/engine/runtime/world.svelte';
import type { Entity, TickContext } from '$lib/engine/ontology/schema';
import { ui } from '$lib/ui/ui.svelte';

registerComponent({
	name: 'WaterRipple',
	fields: {
		enabled: { t: 'boolean', default: true, sync: 'durable' },
		/** World units/sec of motion before this entity disturbs the surface. */
		minSpeed: { t: 'number', default: 0.6, sync: 'durable' },
		/** Seconds between impacts. Below ~0.15 the 8 shader slots churn too fast to read. */
		interval: { t: 'number', default: 0.22, sync: 'durable' },
		/** Vertical half-band around the water plane that counts as "in the water", measured at the feet. */
		depth: { t: 'number', default: 0.8, sync: 'durable' }
	}
});

type RippleParams = {
	enabled: boolean;
	minSpeed: number;
	interval: number;
	depth: number;
};

const DEFAULTS: RippleParams = { enabled: true, minSpeed: 0.6, interval: 0.22, depth: 0.8 };

type Vec3 = [number, number, number];

/** Last seen position per emitter, to derive speed — the engine has no velocity component. */
const lastPos = new Map<string, Vec3>();
/** Sim time of each emitter's last impact, for the cadence gate. */
const lastEmit = new Map<string, number>();

export function resetWaterRippleState(): void {
	lastPos.clear();
	lastEmit.clear();
}

function transformOf(entity: Entity): { pos: Vec3; scale: Vec3; yaw: number } | null {
	const t = entity.components.Transform as
		| { position?: Vec3; rotation?: [number, number, number, number]; scale?: Vec3 }
		| undefined;
	const pos = t?.position;
	if (!pos) return null;
	const scale = t.scale ?? [1, 1, 1];
	const r = t.rotation ?? [0, 0, 0, 1];
	const [x, y, z, w] = r;
	// Yaw only. A water plane tilted off horizontal has no meaningful XZ footprint
	// to test against, so spinning a pond about Y is the case worth being right about.
	const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
	return { pos, scale, yaw };
}

function paramsOf(entity: Entity): RippleParams {
	const raw = entity.components.WaterRipple as Partial<RippleParams> | undefined;
	if (!raw) return DEFAULTS;
	return {
		enabled: raw.enabled ?? DEFAULTS.enabled,
		minSpeed: Number(raw.minSpeed ?? DEFAULTS.minSpeed),
		interval: Number(raw.interval ?? DEFAULTS.interval),
		depth: Number(raw.depth ?? DEFAULTS.depth)
	};
}

/**
 * The Y that gets tested against the water plane — the entity's FEET, not its origin.
 *
 * This matters because a player's Transform is the capsule CENTRE, ~0.98 above the
 * floor it stands on. Measured there, a player standing ankle-deep in a pond at
 * y=0.06 reads as 0.92 above the surface and never ripples — the feature would look
 * wired but do nothing in the shipped meadow world. Props keep their origin, which
 * is conventionally at their base.
 */
function soleY(entity: Entity, y: number): number {
	if (entity.type !== 'Player') return y;
	const fit = capsuleFitFor(entity.id) ?? DEFAULT_CAPSULE;
	return y - (fit.halfHeight + fit.radius);
}

/**
 * Anything carrying `WaterRipple`, plus every player.
 *
 * Players are included implicitly because `buildPlayer` assembles a fixed component
 * bag at spawn — there is no authored player entity to hang the component on, so
 * requiring one would mean players silently never ripple.
 */
function emitters(): Entity[] {
	const out = world.entities.filter((e) => e.components.WaterRipple !== undefined);
	const seen = new Set(out.map((e) => e.id));
	for (const e of world.entities) {
		if (e.type === 'Player' && !seen.has(e.id)) out.push(e);
	}
	return out;
}

export function waterRippleSystem(ctx: TickContext): void {
	if (ui.shellMode !== 'play') return;

	const waters = world.query('Water').filter((w) => {
		const cfg = w.components.Water as { ripples?: boolean } | undefined;
		return cfg?.ripples !== false;
	});
	if (waters.length === 0) {
		// Nothing to disturb — drop tracking so re-entering a water world starts clean.
		if (lastPos.size > 0) resetWaterRippleState();
		return;
	}

	const live = emitters();
	const liveIds = new Set<string>();

	for (const entity of live) {
		liveIds.add(entity.id);
		const here = transformOf(entity);
		if (!here) continue;

		const prev = lastPos.get(entity.id);
		lastPos.set(entity.id, [here.pos[0], here.pos[1], here.pos[2]]);
		// First sighting: no baseline to measure against, so no speed this tick.
		if (!prev || ctx.dt <= 0) continue;

		const p = paramsOf(entity);
		if (!p.enabled) continue;

		const dx = here.pos[0] - prev[0];
		const dy = here.pos[1] - prev[1];
		const dz = here.pos[2] - prev[2];
		// 3D, not XZ: this fires both for wading (XZ) and for dropping in (Y), and
		// the vertical band below already restricts Y motion to the waterline moment.
		const speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / ctx.dt;
		if (speed < p.minSpeed) continue;

		const since = ctx.t - (lastEmit.get(entity.id) ?? -Infinity);
		if (since < p.interval) continue;

		const footY = soleY(entity, here.pos[1]);

		for (const water of waters) {
			const w = transformOf(water);
			if (!w) continue;
			if (Math.abs(footY - w.pos[1]) > p.depth) continue;

			const cfg = water.components.Water as { size?: number; infinite?: boolean } | undefined;
			// An infinite surface follows the camera and has no edges to fall outside of.
			if (!cfg?.infinite) {
				const size = Number(cfg?.size ?? 40);
				const ox = here.pos[0] - w.pos[0];
				const oz = here.pos[2] - w.pos[2];
				// Into the water's own frame, so a rotated pond keeps a square footprint.
				const cos = Math.cos(-w.yaw);
				const sin = Math.sin(-w.yaw);
				const lx = ox * cos - oz * sin;
				const lz = ox * sin + oz * cos;
				const halfX = (size / 2) * Math.abs(w.scale[0]);
				const halfZ = (size / 2) * Math.abs(w.scale[2]);
				if (Math.abs(lx) > halfX || Math.abs(lz) > halfZ) continue;
			}

			// World XZ — the shader compares against world-space `vWorldPos`.
			emitWaterRipple(water.id, here.pos[0], here.pos[2]);
			lastEmit.set(entity.id, ctx.t);
		}
	}

	// Despawned emitters would otherwise hold their last position forever, and a
	// stale baseline reads as a teleport (huge speed) if the id is ever reused.
	if (lastPos.size > liveIds.size) {
		for (const id of lastPos.keys()) {
			if (!liveIds.has(id)) {
				lastPos.delete(id);
				lastEmit.delete(id);
			}
		}
	}
}
