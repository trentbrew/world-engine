/** Known min/max/step for entity component numeric fields — enables slider + nudge inputs. */

export type NumericBounds = { min: number; max: number; step: number };

const BOUNDS: Record<string, Record<string, NumericBounds>> = {
	Transform: {
		scale: { min: 0.01, max: 50, step: 0.1 }
	},
	Player: {
		speed: { min: 0.5, max: 20, step: 0.5 },
		minSlope: { min: 0, max: 89, step: 1 },
		maxSlope: { min: 1, max: 90, step: 1 },
		groundAcc: { min: 0.5, max: 30, step: 0.5 },
		airAcc: { min: 0.5, max: 15, step: 0.5 },
		airDrag: { min: 0, max: 5, step: 0.1 },
		velocityClipThreshold: { min: 0, max: 2, step: 0.05 },
		visualsOffsetThreshold: { min: 0, max: 1, step: 0.05 },
		visualsLerpFactor: { min: 1, max: 50, step: 1 },
		maxVisualsOffset: { min: 0, max: 2, step: 0.05 },
		maxStepVisual: { min: 0, max: 2, step: 0.05 }
	},
	Light: { intensity: { min: 0, max: 10, step: 0.1 } },
	Ground: { size: { min: 1, max: 200, step: 1 } },
	Gravity: {
		g: { min: 0, max: 50, step: 0.5 },
		vy: { min: -20, max: 20, step: 0.5 },
		rest: { min: 0, max: 5, step: 0.05 }
	},
	Physics: {
		mass: { min: 0.1, max: 50, step: 0.1 },
		restitution: { min: 0, max: 1, step: 0.05 },
		friction: { min: 0, max: 2, step: 0.05 },
		gravityScale: { min: 0, max: 3, step: 0.1 }
	}
};

export function numericFieldBounds(component: string, field: string): NumericBounds | null {
	return BOUNDS[component]?.[field] ?? null;
}
