type Vec3 = [number, number, number];

function scaleVec(v: Vec3, s: number): Vec3 {
	return [v[0] * s, v[1] * s, v[2] * s];
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function angleBetweenDeg(a: Vec3, b: Vec3): number {
	const la = Math.hypot(a[0], a[1], a[2]);
	const lb = Math.hypot(b[0], b[1], b[2]);
	if (la < 1e-6 || lb < 1e-6) return 0;
	const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
	return Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI);
}

/** Project move direction onto the ground plane (constant speed on ramps). */
export function conformMovement(dir: Vec3, normal: Vec3): Vec3 {
	const dot = dir[0] * normal[0] + dir[1] * normal[1] + dir[2] * normal[2];
	const onPlane: Vec3 = [
		dir[0] - normal[0] * dot,
		dir[1] - normal[1] * dot,
		dir[2] - normal[2] * dot
	];

	const mag = Math.hypot(dir[0], dir[1], dir[2]);
	const planeLen = Math.hypot(onPlane[0], onPlane[1], onPlane[2]);
	if (planeLen < 1e-6) return dir;

	const scale = mag / planeLen;
	return [onPlane[0] * scale, onPlane[1] * scale, onPlane[2] * scale];
}

/** Reduce uphill move magnitude beyond minSlope degrees. */
export function inhibitMovement(
	dir: Vec3,
	normal: Vec3,
	minSlopeDeg: number,
	maxSlopeDeg: number
): Vec3 {
	const negDir: Vec3 = [-dir[0], -dir[1], -dir[2]];
	const slopeAngle = 90 - angleBetweenDeg(negDir, normal);
	const span = maxSlopeDeg - minSlopeDeg;
	const t = span <= 0 ? 1 : clamp01((slopeAngle - minSlopeDeg) / span);
	const factor = 1 - t * t;
	return scaleVec(dir, factor);
}

/** Ground motor — lerp horizontal velocity toward target. */
export function integrateGroundVelocity(
	vx: number,
	vz: number,
	targetVx: number,
	targetVz: number,
	groundAcc: number,
	dt: number
): [number, number] {
	return [
		vx + (targetVx - vx) * groundAcc * dt,
		vz + (targetVz - vz) * groundAcc * dt
	];
}

/** Air motor — dot-product steering with horizontal drag. */
export function integrateAirVelocity(
	vx: number,
	vz: number,
	moveX: number,
	moveZ: number,
	moveMag: number,
	maxSpeed: number,
	airAcc: number,
	airDrag: number,
	dt: number
): [number, number] {
	const wishX = moveX * moveMag;
	const wishZ = moveZ * moveMag;
	const vDot = wishX * vx + wishZ * vz;
	const accDif = moveMag * maxSpeed - vDot;

	let nextVx = vx - vx * airDrag * dt;
	let nextVz = vz - vz * airDrag * dt;
	nextVx += wishX * airAcc * accDif * dt;
	nextVz += wishZ * airAcc * accDif * dt;
	return [nextVx, nextVz];
}
