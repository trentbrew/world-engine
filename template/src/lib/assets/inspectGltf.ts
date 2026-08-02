import type { ThrelteGltf } from '@threlte/extras';
import { Box3, Mesh, SkinnedMesh, Vector3, type Material, type Object3D } from 'three';

export type GltfMaterialInfo = {
	name: string;
	type: string;
	hasBaseColorMap: boolean;
	hasNormalMap: boolean;
	hasEmissiveMap: boolean;
	hasRoughnessMap: boolean;
	hasMetalnessMap: boolean;
};

export type GltfInspection = {
	meshCount: number;
	skinnedMeshCount: number;
	triangleCount: number;
	vertexCount: number;
	boneCount: number;
	animationNames: string[];
	materials: GltfMaterialInfo[];
	dimensions: { x: number; y: number; z: number };
};

function materialInfo(material: Material): GltfMaterialInfo {
	const standard = material as Material & {
		map?: unknown;
		normalMap?: unknown;
		emissiveMap?: unknown;
		roughnessMap?: unknown;
		metalnessMap?: unknown;
	};
	return {
		name: material.name || 'Material',
		type: material.type,
		hasBaseColorMap: !!standard.map,
		hasNormalMap: !!standard.normalMap,
		hasEmissiveMap: !!standard.emissiveMap,
		hasRoughnessMap: !!standard.roughnessMap,
		hasMetalnessMap: !!standard.metalnessMap
	};
}

function countGeometry(root: Object3D): { meshes: number; skinned: number; tris: number; verts: number } {
	let meshes = 0;
	let skinned = 0;
	let tris = 0;
	let verts = 0;

	root.traverse((object) => {
		if (object instanceof SkinnedMesh) {
			skinned += 1;
			meshes += 1;
		} else if (object instanceof Mesh) {
			meshes += 1;
		} else {
			return;
		}

		const geometry = object.geometry;
		if (!geometry) return;
		const position = geometry.getAttribute('position');
		if (position) verts += position.count;
		if (geometry.index) tris += geometry.index.count / 3;
		else if (position) tris += position.count / 3;
	});

	return { meshes, skinned, tris: Math.round(tris), verts };
}

function countBones(root: Object3D): number {
	let max = 0;
	root.traverse((object) => {
		if (object instanceof SkinnedMesh && object.skeleton) {
			max = Math.max(max, object.skeleton.bones.length);
		}
	});
	return max;
}

function collectMaterials(root: Object3D): GltfMaterialInfo[] {
	const seen = new Set<Material>();
	const materials: GltfMaterialInfo[] = [];

	root.traverse((object) => {
		if (!(object instanceof Mesh)) return;
		const mat = object.material;
		const list = Array.isArray(mat) ? mat : [mat];
		for (const entry of list) {
			if (!entry || seen.has(entry)) continue;
			seen.add(entry);
			materials.push(materialInfo(entry));
		}
	});

	return materials;
}

export function inspectGltf(gltf: ThrelteGltf): GltfInspection {
	const { meshes, skinned, tris, verts } = countGeometry(gltf.scene);
	const box = new Box3().setFromObject(gltf.scene);
	const size = box.getSize(new Vector3());

	return {
		meshCount: meshes,
		skinnedMeshCount: skinned,
		triangleCount: tris,
		vertexCount: verts,
		boneCount: countBones(gltf.scene),
		animationNames: gltf.animations.map((clip) => clip.name || 'Animation'),
		materials: collectMaterials(gltf.scene),
		dimensions: {
			x: Number(size.x.toFixed(3)),
			y: Number(size.y.toFixed(3)),
			z: Number(size.z.toFixed(3))
		}
	};
}
