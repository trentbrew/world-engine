/**
 * Skeleton family heuristics — matches scripts/character-rig.mjs.
 * Used at runtime to warn when Mesh3DAnimator.catalog ≠ mesh skeleton.
 */
export type RigFamily = 'mesh2motion-human' | 'mixamo' | 'biped' | 'custom' | 'static';

export function collectBoneNames(root: { traverse: (cb: (o: { name?: string; isBone?: boolean }) => void) => void }): string[] {
	const names: string[] = [];
	root.traverse((o) => {
		if (o.isBone && o.name) names.push(o.name);
	});
	return names;
}

export function classifyRigFamily(jointNames: string[]): RigFamily {
	if (!jointNames.length) return 'static';
	if (jointNames.some((n) => n.toLowerCase().startsWith('mixamorig:'))) return 'mixamo';
	if (jointNames.some((n) => /^Bip0\d/i.test(n))) return 'biped';
	const lower = new Set(jointNames.map((n) => n.toLowerCase()));
	if (lower.has('pelvis') && [...lower].some((n) => n.startsWith('spine_'))) {
		return 'mesh2motion-human';
	}
	return 'custom';
}

export function isMesh2MotionHuman(jointNames: string[]): boolean {
	return classifyRigFamily(jointNames) === 'mesh2motion-human';
}

/** Rig family a clip catalog expects (null = unknown / any embedded clips). */
export function catalogRigFamily(catalogRef: string): RigFamily | null {
	if (catalogRef.includes('mesh2motion-human')) return 'mesh2motion-human';
	if (catalogRef.includes('xbot-mixamo')) return 'mixamo';
	return null;
}

export function catalogSkeletonMismatch(
	catalogRef: string,
	jointNames: string[]
): { expected: RigFamily; actual: RigFamily } | null {
	const expected = catalogRigFamily(catalogRef);
	if (!expected || !jointNames.length) return null;
	const actual = classifyRigFamily(jointNames);
	if (actual === expected) return null;
	return { expected, actual };
}
