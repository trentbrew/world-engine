/**
 * Edge wayfinding placement — pin a panel to the viewport rim pointing at an
 * off-screen target. Same construction as the Trellis Studio graph beacon:
 * cast the center→target ray onto an inset rectangle and reuse its angle for
 * the arrow. Insets are per-axis so a rectangular panel stays fully on-screen.
 */

export type EdgeBeacon = {
	/** Panel center, in viewport px. */
	x: number;
	y: number;
	/** Direction from viewport center to the target. */
	angleRad: number;
};

export function edgeBeaconPlacement(
	viewW: number,
	viewH: number,
	targetX: number,
	targetY: number,
	insetX: number,
	insetY: number
): EdgeBeacon {
	const cx = viewW / 2;
	const cy = viewH / 2;
	const dx = targetX - cx;
	const dy = targetY - cy;
	if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
		return { x: cx, y: cy, angleRad: 0 };
	}

	const hw = Math.max(24, cx - insetX);
	const hh = Math.max(24, cy - insetY);
	const scale = Math.min(
		Math.abs(dx) < 1e-6 ? Infinity : Math.abs(hw / dx),
		Math.abs(dy) < 1e-6 ? Infinity : Math.abs(hh / dy)
	);

	return {
		x: cx + dx * scale,
		y: cy + dy * scale,
		angleRad: Math.atan2(dy, dx)
	};
}

/**
 * Point on a `halfW × halfH` box outline (plus `pad`) along `angleRad`,
 * as an offset from the box center — where the arrow sits on the panel rim.
 */
export function boxRimPoint(
	halfW: number,
	halfH: number,
	angleRad: number,
	pad = 0
): { x: number; y: number } {
	const ax = Math.cos(angleRad);
	const ay = Math.sin(angleRad);
	const rw = halfW + pad;
	const rh = halfH + pad;
	const scale = Math.min(
		Math.abs(ax) < 1e-6 ? Infinity : Math.abs(rw / ax),
		Math.abs(ay) < 1e-6 ? Infinity : Math.abs(rh / ay)
	);
	return { x: ax * scale, y: ay * scale };
}

/** Compact wayfinding distance label ("8m", "24m"). */
export function formatDistance(meters: number): string {
	if (!Number.isFinite(meters)) return '';
	return `${Math.max(0, Math.round(meters))}m`;
}
