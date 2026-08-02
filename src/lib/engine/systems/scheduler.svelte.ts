/**
 * The tick scheduler — runs registered systems in order every frame. In plain
 * runtime it owns a requestAnimationFrame loop; inside Rapier play mode it can be
 * driven by Threlte's physics stage so gameplay and physics share one clock.
 */
import type { TickContext } from '$lib/engine/ontology/schema';

type System = (ctx: TickContext) => void;

const MAX_DT = 0.1; // clamp long frame gaps (tab switches) for stability

class Scheduler {
	tick = $state(0);
	t = $state(0);
	running = $state(false);
	paused = $state(false);

	#systems: System[] = [];
	#raf = 0;
	#last = 0;
	#externalClockUsers = 0;

	register(system: System) {
		if (!this.#systems.includes(system)) this.#systems.push(system);
	}

	clearSystems() {
		this.#systems.length = 0;
	}

	start() {
		if (this.running || typeof requestAnimationFrame === 'undefined') return;
		this.running = true;
		this.#last = performance.now();
		if (this.#externalClockUsers > 0) return;
		this.#raf = requestAnimationFrame(this.#loop);
	}

	stop() {
		this.running = false;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;
	}

	reset() {
		this.tick = 0;
		this.t = 0;
	}

	pause() {
		this.paused = true;
	}

	resume() {
		if (!this.paused) return;
		this.paused = false;
		this.#last = performance.now();
	}

	useExternalClock(): () => void {
		this.#externalClockUsers += 1;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;

		return () => {
			this.#externalClockUsers = Math.max(0, this.#externalClockUsers - 1);
			if (this.running && this.#externalClockUsers === 0 && !this.#raf) {
				this.#last = performance.now();
				this.#raf = requestAnimationFrame(this.#loop);
			}
		};
	}

	step(dt: number) {
		if (!this.running || this.paused) return;
		const clampedDt = Math.min(dt, MAX_DT);
		this.t += clampedDt;
		this.tick += 1;
		const ctx: TickContext = { dt: clampedDt, t: this.t, tick: this.tick };
		for (const system of this.#systems) system(ctx);
	}

	#loop = () => {
		if (!this.running) return;
		this.#raf = requestAnimationFrame(this.#loop);
		const now = performance.now();
		const dt = Math.min((now - this.#last) / 1000, MAX_DT);
		this.#last = now;
		this.step(dt);
	};
}

export const scheduler = new Scheduler();
