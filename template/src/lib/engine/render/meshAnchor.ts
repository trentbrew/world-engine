import { Box3, Matrix4, Vector3, type Object3D } from 'three';

/** How a loaded mesh is aligned to `Transform.position`. */
export type MeshAnchor = 'origin' | 'bottom' | 'center';

export type MeshBounds = {
	size: [number, number, number];
	/** Offset from entity origin to the bbox center (after anchor correction). */
	center: [number, number, number];
};

const ORIGIN: [number, number, number] = [0, 0, 0];
const PADDING = 0.15;
const center = new Vector3();
const offset = new Vector3();
const min = new Vector3();
const max = new Vector3();
const invWorld = new Matrix4();
const localBox = new Box3();

/** Local-space AABB of `scene` (strips parent world transform). */
function localBoundingBox(scene: Object3D): Box3 {
	scene.updateWorldMatrix(true, true);
	localBox.setFromObject(scene);
	if (localBox.isEmpty()) return localBox;
	// setFromObject returns world AABB; convert into scene-local so parent
	// position/scale are not baked into anchor math or stored bounds.
	invWorld.copy(scene.matrixWorld).invert();
	localBox.applyMatrix4(invWorld);
	return localBox;
}

/** Offset applied to a glTF scene so the chosen anchor sits on the entity origin. */
export function meshAnchorOffset(scene: Object3D, anchor: MeshAnchor): [number, number, number] {
	if (anchor === 'origin') return ORIGIN;

	const box = localBoundingBox(scene);
	if (box.isEmpty()) return ORIGIN;

	if (anchor === 'bottom') return [0, -box.min.y, 0];

	box.getCenter(center);
	return [-center.x, -center.y, -center.z];
}

/** Offset for built-in primitives so anchor modes align to `Transform.position`. */
export function primitiveAnchorOffset(
	kind: 'box' | 'sphere' | 'capsule',
	anchor: MeshAnchor
): [number, number, number] {
	if (anchor === 'origin') return ORIGIN;
	const halfY = kind === 'capsule' ? 0.25 + 0.32 : 0.5;
	if (anchor === 'bottom') return [0, halfY, 0];
	return ORIGIN;
}

/**
 * AABB relative to `root`'s world position.
 * `center` is worldCenter − rootWorldPos so callers can do `position + center`
 * without double-counting a parented Group's world matrix.
 */
export function meshBoundsFromRoot(root: Object3D): MeshBounds {
	root.updateWorldMatrix(true, true);
	const box = new Box3().setFromObject(root);
	if (box.isEmpty()) {
		return { size: [1.15, 1.15, 1.15], center: ORIGIN };
	}

	box.getCenter(center);
	root.getWorldPosition(offset);

	return {
		size: [
			box.max.x - box.min.x + PADDING,
			box.max.y - box.min.y + PADDING,
			box.max.z - box.min.z + PADDING
		],
		center: [center.x - offset.x, center.y - offset.y, center.z - offset.z]
	};
}

/**
 * Local-space selection bounds for a glTF scene after anchor correction.
 * Safe when `scene` is already parented under a positioned/scaled entity Group.
 */
export function meshBounds(scene: Object3D, anchor: MeshAnchor): MeshBounds {
	const box = localBoundingBox(scene);
	if (box.isEmpty()) {
		return { size: [1.15, 1.15, 1.15], center: ORIGIN };
	}

	const [ox, oy, oz] = meshAnchorOffset(scene, anchor);
	offset.set(ox, oy, oz);
	min.copy(box.min).add(offset);
	max.copy(box.max).add(offset);

	return {
		size: [max.x - min.x + PADDING, max.y - min.y + PADDING, max.z - min.z + PADDING],
		center: [(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2]
	};
}
