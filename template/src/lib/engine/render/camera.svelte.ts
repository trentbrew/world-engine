/** Camera mode: free 'orbit' (CameraControls) vs 'follow' (tracks local player).
 *
 * Camera config here is per-viewer / ephemeral — it is NOT synced to peers or
 * persisted in the scene document (that is reserved for scene-defining state).
 */

/** Lens defaults (perspective fov + clipping planes). */
export const DEFAULT_LENS = {
	fov: 50,
	near: 0.1,
	far: 2000
} as const;

/** Feel/limits for the orbit controls — maps onto @threlte/extras <CameraControls>. */
export type ControlPrefs = {
	/** Drag-to-rotate speed (applied to both azimuth and polar). */
	rotateSpeed: number;
	/** Wheel/drag dolly (zoom) speed. */
	dollySpeed: number;
	/** Right-drag pan speed. */
	truckSpeed: number;
	/** Inertia after release (seconds). */
	smoothTime: number;
	/** Inertia while dragging (seconds). */
	draggingSmoothTime: number;
	/** Closest dolly distance. */
	minDistance: number;
	/** Farthest dolly distance. */
	maxDistance: number;
	/** Vertical angle floor, degrees from straight up. */
	minPolarDeg: number;
	/** Vertical angle ceiling, degrees (keep < 90 to stay above ground). */
	maxPolarDeg: number;
	/** Zoom toward the cursor instead of the target. */
	dollyToCursor: boolean;
	/** Allow dollying past the target indefinitely. */
	infinityDolly: boolean;
	/** Invert vertical drag direction. */
	invertY: boolean;
};

export const DEFAULT_CONTROL_PREFS: ControlPrefs = {
	rotateSpeed: 0.7,
	dollySpeed: 1.0,
	truckSpeed: 2.2,
	smoothTime: 0.1,
	draggingSmoothTime: 0.05,
	minDistance: 3,
	maxDistance: 500,
	minPolarDeg: 7,
	maxPolarDeg: 85,
		dollyToCursor: true,
	infinityDolly: false,
	invertY: false
};

/** Back-compat alias — older popovers referenced these defaults. */
export const DEFAULT_ORBIT_PREFS = DEFAULT_CONTROL_PREFS;

export type NudgeSpace = 'world' | 'camera';

export const DEG2RAD = Math.PI / 180;

export type ViewCommand = {
	kind: 'reset' | 'focus';
	seq: number;
};

class CameraState {
	mode = $state<'orbit' | 'follow'>('orbit');
	projection = $state<'perspective' | 'orthographic'>('perspective');
	/** Arrow-key position nudge: 3D uses XZ; 2D side-view uses XY. */
	nudgeSpace = $state<NudgeSpace>('camera');
	fov = $state<number>(DEFAULT_LENS.fov);
	near = $state<number>(DEFAULT_LENS.near);
	far = $state<number>(DEFAULT_LENS.far);
	controls = $state<ControlPrefs>({ ...DEFAULT_CONTROL_PREFS });
	viewCommand = $state<ViewCommand | null>(null);

	setMode(mode: 'orbit' | 'follow') {
		this.mode = mode;
	}

	toggle() {
		this.setMode(this.mode === 'orbit' ? 'follow' : 'orbit');
	}

	resetControlDefaults() {
		this.controls = { ...DEFAULT_CONTROL_PREFS };
	}

	resetLensDefaults() {
		this.fov = DEFAULT_LENS.fov;
		this.near = DEFAULT_LENS.near;
		this.far = DEFAULT_LENS.far;
	}

	resetView() {
		this.viewCommand = { kind: 'reset', seq: (this.viewCommand?.seq ?? 0) + 1 };
	}

	focusSelection() {
		this.viewCommand = { kind: 'focus', seq: (this.viewCommand?.seq ?? 0) + 1 };
	}
}

export const camera = new CameraState();
