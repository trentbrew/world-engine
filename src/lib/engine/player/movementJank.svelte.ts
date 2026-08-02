/**
 * Play-mode movement smoothness probe — grounded flicker, Y chase, land spam.
 * Fed by GroundSensor + jumpSystem; rendered by MovementJankHud.
 */

export type UngroundReason = 'none' | 'miss' | 'stepUp' | 'overlap';

export type MovementJankSnapshot = {
	grounded: boolean;
	height: number;
	bodyY: number;
	restDelta: number;
	vy: number;
	landHoldMs: number;
	airMs: number;
	lastUnground: UngroundReason;
	/** Rising grounded edges in the last ~1s. */
	groundedEdgesPerSec: number;
	/** Rolling RMS of frame-to-frame |ΔY| (meters). */
	yJitterRms: number;
	/** 0–100; lower = worse. */
	score: number;
	status: 'smooth' | 'rough' | 'janky';
};

const EDGE_WINDOW_MS = 1000;
const JITTER_SAMPLES = 60;

type EdgeEvent = { t: number };

let edgeTimes: EdgeEvent[] = [];
let dySamples: number[] = [];
let prevBodyY: number | null = null;
let lastSampleMs = 0;

export const movementJank = $state<MovementJankSnapshot>({
	grounded: false,
	height: 0,
	bodyY: 0,
	restDelta: 0,
	vy: 0,
	landHoldMs: 0,
	airMs: 0,
	lastUnground: 'none',
	groundedEdgesPerSec: 0,
	yJitterRms: 0,
	score: 100,
	status: 'smooth'
});

export function resetMovementJank(): void {
	edgeTimes = [];
	dySamples = [];
	prevBodyY = null;
	lastSampleMs = 0;
	movementJank.grounded = false;
	movementJank.height = 0;
	movementJank.bodyY = 0;
	movementJank.restDelta = 0;
	movementJank.vy = 0;
	movementJank.landHoldMs = 0;
	movementJank.airMs = 0;
	movementJank.lastUnground = 'none';
	movementJank.groundedEdgesPerSec = 0;
	movementJank.yJitterRms = 0;
	movementJank.score = 100;
	movementJank.status = 'smooth';
}

export function noteUngroundReason(reason: UngroundReason): void {
	if (reason === 'none') return;
	movementJank.lastUnground = reason;
}

export function noteGroundedEdge(nowGrounded: boolean, reason: UngroundReason = 'none'): void {
	const now = performance.now();
	if (nowGrounded) {
		edgeTimes.push({ t: now });
	} else {
		noteUngroundReason(reason);
	}
	pruneEdges(now);
}

/** Call once per jumpSystem tick while local player is simulating. */
export function sampleMovementJank(sample: {
	grounded: boolean;
	height: number;
	bodyY: number;
	restY: number;
	vy: number;
	landHoldMs: number;
	airMs: number;
	dtMs: number;
}): void {
	const now = performance.now();
	pruneEdges(now);

	if (prevBodyY !== null) {
		dySamples.push(Math.abs(sample.bodyY - prevBodyY));
		if (dySamples.length > JITTER_SAMPLES) dySamples.shift();
	}
	prevBodyY = sample.bodyY;
	lastSampleMs = now;

	const edges = edgeTimes.length;
	const rms =
		dySamples.length === 0
			? 0
			: Math.sqrt(dySamples.reduce((s, v) => s + v * v, 0) / dySamples.length);
	const restAbs = Math.abs(sample.restY - sample.bodyY);
	const landPenalty = sample.landHoldMs > 0 && sample.grounded ? 25 : 0;
	const edgePenalty = Math.min(50, edges * 12);
	const jitterPenalty = Math.min(40, rms * 400);
	const restPenalty = Math.min(20, restAbs * 80);
	const score = Math.max(0, Math.round(100 - edgePenalty - jitterPenalty - restPenalty - landPenalty));

	movementJank.grounded = sample.grounded;
	movementJank.height = sample.height;
	movementJank.bodyY = sample.bodyY;
	movementJank.restDelta = sample.bodyY - sample.restY;
	movementJank.vy = sample.vy;
	movementJank.landHoldMs = sample.landHoldMs;
	movementJank.airMs = sample.airMs;
	movementJank.groundedEdgesPerSec = edges;
	movementJank.yJitterRms = rms;
	movementJank.score = score;
	movementJank.status = score >= 80 ? 'smooth' : score >= 50 ? 'rough' : 'janky';
}

function pruneEdges(now: number): void {
	edgeTimes = edgeTimes.filter((e) => now - e.t <= EDGE_WINDOW_MS);
}
