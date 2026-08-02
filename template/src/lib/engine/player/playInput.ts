/** Scene-level play-mode input: locomotion tiers + follow-camera feel. */

export type LocomotionTier = 'idle' | 'walk' | 'jog' | 'run' | 'sprint';

export type LocomotionThresholds = {
	jog: number;
	run: number;
	sprint: number;
};

export type LocomotionSpeeds = {
	walk: number;
	jog: number;
	run: number;
	sprint: number;
};

export type LocomotionProfile = {
	thresholds: LocomotionThresholds;
	speeds: LocomotionSpeeds;
	/** m/s² — ramp up toward tier target speed. */
	accel: number;
	/** m/s² — ramp down on release or tier change. */
	decel: number;
	/** WASD tier when no modifier is held (Ctrl = walk, Shift = sprint). */
	keyboardTier: Exclude<LocomotionTier, 'idle'>;
};

export type FollowCameraPresetId =
	| 'thirdPerson'
	| 'fixed'
	| 'topDown'
	| 'sidescroller'
	| 'racing'
	| 'cinematic';

export type FollowCameraConfig = {
	preset: FollowCameraPresetId;
	/** CameraControls smoothTime (seconds). */
	smoothTime: number;
	distance: number;
	minDistance: number;
	maxDistance: number;
	/** Radians — matches Threlte useFollow / CameraControls. */
	minPolarAngle: number;
	maxPolarAngle: number;
	polarAngle: number;
	azimuthLocked: boolean;
	azimuthAngle: number;
	pointerLock: boolean;
	lookAtOffset: [number, number, number];
	deadZone: [number, number];
	lookAhead: number;
	lookAheadSmoothTime: number;
	followSmoothTime: number;
	trackRotation: boolean;
	trackRotationSmoothTime: number;
	trackRotationOffset: number;
};

/** Presets from https://threlte.xyz/docs/reference/extras/use-follow/ */
export const FOLLOW_CAMERA_PRESETS: Record<FollowCameraPresetId, FollowCameraConfig> = {
	thirdPerson: {
		preset: 'thirdPerson',
		smoothTime: 0.2,
		distance: 6,
		minDistance: 2,
		maxDistance: 20,
		minPolarAngle: 0.3,
		maxPolarAngle: 1.5,
		polarAngle: 1.1,
		azimuthLocked: false,
		azimuthAngle: 0,
		pointerLock: false,
		lookAtOffset: [0, 1, 0],
		deadZone: [0, 0],
		lookAhead: 0,
		lookAheadSmoothTime: 0.15,
		followSmoothTime: 0.15,
		trackRotation: false,
		trackRotationSmoothTime: 0,
		trackRotationOffset: 0
	},
	fixed: {
		preset: 'fixed',
		smoothTime: 0.2,
		distance: 5,
		minDistance: 2,
		maxDistance: 16,
		minPolarAngle: 0.4,
		maxPolarAngle: 1.4,
		polarAngle: 1.1,
		azimuthLocked: false,
		azimuthAngle: 0,
		pointerLock: false,
		lookAtOffset: [0, 1, 0],
		deadZone: [0, 0],
		lookAhead: 0,
		lookAheadSmoothTime: 0.15,
		followSmoothTime: 0,
		trackRotation: true,
		trackRotationSmoothTime: 0.25,
		trackRotationOffset: Math.PI
	},
	topDown: {
		preset: 'topDown',
		smoothTime: 0.2,
		distance: 11,
		minDistance: 4,
		maxDistance: 24,
		minPolarAngle: 0.6,
		maxPolarAngle: 0.6,
		polarAngle: 0.6,
		azimuthLocked: true,
		azimuthAngle: 0,
		pointerLock: false,
		lookAtOffset: [0, 0, 0],
		deadZone: [0, 0],
		lookAhead: 0,
		lookAheadSmoothTime: 0.15,
		followSmoothTime: 0,
		trackRotation: false,
		trackRotationSmoothTime: 0,
		trackRotationOffset: 0
	},
	sidescroller: {
		preset: 'sidescroller',
		smoothTime: 0.25,
		distance: 7,
		minDistance: 3,
		maxDistance: 18,
		minPolarAngle: Math.PI / 2,
		maxPolarAngle: Math.PI / 2,
		polarAngle: Math.PI / 2,
		azimuthLocked: true,
		azimuthAngle: 0,
		pointerLock: false,
		lookAtOffset: [0, 1, 0],
		deadZone: [1.5, 0.5],
		lookAhead: 0,
		lookAheadSmoothTime: 0.15,
		followSmoothTime: 0.1,
		trackRotation: false,
		trackRotationSmoothTime: 0,
		trackRotationOffset: 0
	},
	racing: {
		preset: 'racing',
		smoothTime: 0.08,
		distance: 6,
		minDistance: 3,
		maxDistance: 16,
		minPolarAngle: 1,
		maxPolarAngle: 1,
		polarAngle: 1,
		azimuthLocked: true,
		azimuthAngle: 0,
		pointerLock: false,
		lookAtOffset: [0, 0.8, 0],
		deadZone: [0, 0],
		lookAhead: 0.4,
		lookAheadSmoothTime: 0.15,
		followSmoothTime: 0.05,
		trackRotation: false,
		trackRotationSmoothTime: 0,
		trackRotationOffset: 0
	},
	cinematic: {
		preset: 'cinematic',
		smoothTime: 0.6,
		distance: 14,
		minDistance: 6,
		maxDistance: 28,
		minPolarAngle: 0.8,
		maxPolarAngle: 0.8,
		polarAngle: 0.8,
		azimuthLocked: true,
		azimuthAngle: 0,
		pointerLock: false,
		lookAtOffset: [0, 1.2, 0],
		deadZone: [0, 0],
		lookAhead: 0,
		lookAheadSmoothTime: 0.15,
		followSmoothTime: 0.5,
		trackRotation: false,
		trackRotationSmoothTime: 0,
		trackRotationOffset: 0
	}
};

export const FOLLOW_CAMERA_PRESET_OPTIONS: { value: FollowCameraPresetId; label: string }[] = [
	{ value: 'thirdPerson', label: 'Third person' },
	{ value: 'fixed', label: 'Fixed' },
	{ value: 'topDown', label: 'Top-down' },
	{ value: 'sidescroller', label: 'Sidescroller' },
	{ value: 'racing', label: 'Racing' },
	{ value: 'cinematic', label: 'Cinematic' }
];

export function followCameraPreset(id: FollowCameraPresetId): FollowCameraConfig {
	return structuredClone(FOLLOW_CAMERA_PRESETS[id]);
}

export type PlayInputConfig = {
	locomotion: LocomotionProfile;
	followCamera: FollowCameraConfig;
};

export const DEFAULT_LOCOMOTION: LocomotionProfile = {
	thresholds: { jog: 0.45, run: 0.72, sprint: 0.92 },
	speeds: { walk: 1.8, jog: 3.4, run: 5.2, sprint: 6.8 },
	accel: 18,
	decel: 24,
	/** Plain WASD without modifiers — walk tier; Shift = sprint, Ctrl = walk override. */
	keyboardTier: 'walk'
};

export const DEFAULT_FOLLOW_CAMERA: FollowCameraConfig = followCameraPreset('thirdPerson');

export const DEFAULT_PLAY_INPUT: PlayInputConfig = {
	locomotion: DEFAULT_LOCOMOTION,
	followCamera: DEFAULT_FOLLOW_CAMERA
};

const TIERS: LocomotionTier[] = ['walk', 'jog', 'run', 'sprint'];
const PRESET_IDS = new Set<string>(Object.keys(FOLLOW_CAMERA_PRESETS));

function num(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
	if (!Array.isArray(value) || value.length < 3) return fallback;
	const x = num(value[0], fallback[0]);
	const y = num(value[1], fallback[1]);
	const z = num(value[2], fallback[2]);
	return [x, y, z];
}

function vec2(value: unknown, fallback: [number, number]): [number, number] {
	if (!Array.isArray(value) || value.length < 2) return fallback;
	return [num(value[0], fallback[0]), num(value[1], fallback[1])];
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function parseFollowCamera(raw: unknown): FollowCameraConfig {
	const base = DEFAULT_FOLLOW_CAMERA;
	if (!raw || typeof raw !== 'object') return structuredClone(base);

	const cam = raw as Partial<FollowCameraConfig> & {
		height?: number;
		yawSensitivity?: number;
		pitchSensitivity?: number;
		minPitchDeg?: number;
		maxPitchDeg?: number;
	};

	const presetRaw = cam.preset;
	const preset =
		typeof presetRaw === 'string' && PRESET_IDS.has(presetRaw)
			? (presetRaw as FollowCameraPresetId)
			: base.preset;
	const seeded = followCameraPreset(preset);

	return {
		preset,
		smoothTime: num(cam.smoothTime, seeded.smoothTime),
		distance: num(cam.distance, seeded.distance),
		minDistance: num(cam.minDistance, seeded.minDistance),
		maxDistance: num(cam.maxDistance, seeded.maxDistance),
		minPolarAngle: num(cam.minPolarAngle, seeded.minPolarAngle),
		maxPolarAngle: num(cam.maxPolarAngle, seeded.maxPolarAngle),
		polarAngle: num(cam.polarAngle, seeded.polarAngle),
		azimuthLocked: bool(cam.azimuthLocked, seeded.azimuthLocked),
		azimuthAngle: num(cam.azimuthAngle, seeded.azimuthAngle),
		pointerLock: bool(cam.pointerLock, seeded.pointerLock),
		lookAtOffset: vec3(cam.lookAtOffset, seeded.lookAtOffset),
		deadZone: vec2(cam.deadZone, seeded.deadZone),
		lookAhead: num(cam.lookAhead, seeded.lookAhead),
		lookAheadSmoothTime: num(cam.lookAheadSmoothTime, seeded.lookAheadSmoothTime),
		followSmoothTime: num(cam.followSmoothTime, seeded.followSmoothTime),
		trackRotation: bool(cam.trackRotation, seeded.trackRotation),
		trackRotationSmoothTime: num(cam.trackRotationSmoothTime, seeded.trackRotationSmoothTime),
		trackRotationOffset: num(cam.trackRotationOffset, seeded.trackRotationOffset)
	};
}

export function tierFromMagnitude(
	magnitude: number,
	thresholds: LocomotionThresholds
): LocomotionTier {
	const mag = clamp01(magnitude);
	if (mag <= 0.01) return 'idle';
	if (mag < thresholds.jog) return 'walk';
	if (mag < thresholds.run) return 'jog';
	if (mag < thresholds.sprint) return 'run';
	return 'sprint';
}

export function speedForTier(tier: LocomotionTier, speeds: LocomotionSpeeds): number {
	if (tier === 'idle') return 0;
	return speeds[tier];
}

export type LocomotionSample = {
	tier: LocomotionTier;
	speed: number;
	magnitude: number;
};

/** Map stick deflection → tier + effective m/s (analog scales within tier). */
export function resolveLocomotion(
	magnitude: number,
	profile: LocomotionProfile,
	opts?: { keyboard?: boolean; keyboardTier?: Exclude<LocomotionTier, 'idle'> }
): LocomotionSample {
	const mag = clamp01(magnitude);
	if (mag <= 0.01) return { tier: 'idle', speed: 0, magnitude: 0 };

	const tier = opts?.keyboard
		? (opts.keyboardTier ?? profile.keyboardTier)
		: tierFromMagnitude(mag, profile.thresholds);
	const base = speedForTier(tier, profile.speeds);
	const speed = opts?.keyboard ? base : base * mag;

	return { tier, speed, magnitude: mag };
}

export function parsePlayInput(raw: unknown): PlayInputConfig {
	const base = DEFAULT_PLAY_INPUT;
	if (!raw || typeof raw !== 'object') return structuredClone(base);

	const doc = raw as Partial<PlayInputConfig>;
	const loc = doc.locomotion ?? {};
	const thresholds: Partial<LocomotionThresholds> =
		(loc as Partial<LocomotionProfile>).thresholds ?? {};
	const speeds: Partial<LocomotionSpeeds> = (loc as Partial<LocomotionProfile>).speeds ?? {};

	const keyboardTier = (loc as Partial<LocomotionProfile>).keyboardTier;
	const parsedKeyboard =
		typeof keyboardTier === 'string' && TIERS.includes(keyboardTier as LocomotionTier)
			? (keyboardTier as Exclude<LocomotionTier, 'idle'>)
			: base.locomotion.keyboardTier;

	return {
		locomotion: {
			thresholds: {
				jog: num(thresholds.jog, base.locomotion.thresholds.jog),
				run: num(thresholds.run, base.locomotion.thresholds.run),
				sprint: num(thresholds.sprint, base.locomotion.thresholds.sprint)
			},
			speeds: {
				walk: num(speeds.walk, base.locomotion.speeds.walk),
				jog: num(speeds.jog, base.locomotion.speeds.jog),
				run: num(speeds.run, base.locomotion.speeds.run),
				sprint: num(speeds.sprint, base.locomotion.speeds.sprint)
			},
			accel: num((loc as Partial<LocomotionProfile>).accel, base.locomotion.accel),
			decel: num((loc as Partial<LocomotionProfile>).decel, base.locomotion.decel),
			keyboardTier: parsedKeyboard
		},
		followCamera: parseFollowCamera(doc.followCamera)
	};
}
