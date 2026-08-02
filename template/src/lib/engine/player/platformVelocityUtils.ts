export type HorizontalVelocity = [number, number];
export type PlatformVelocity = [number, number, number];

export function subtractPlatformVelocity(
	velocity: HorizontalVelocity,
	platformVelocity: PlatformVelocity
): HorizontalVelocity {
	return [velocity[0] - platformVelocity[0], velocity[1] - platformVelocity[2]];
}

export function addPlatformVelocity(
	velocity: HorizontalVelocity,
	platformVelocity: PlatformVelocity
): HorizontalVelocity {
	return [velocity[0] + platformVelocity[0], velocity[1] + platformVelocity[2]];
}

export function platformDisplacement(
	platformVelocity: PlatformVelocity,
	dt: number
): HorizontalVelocity {
	return [platformVelocity[0] * dt, platformVelocity[2] * dt];
}
