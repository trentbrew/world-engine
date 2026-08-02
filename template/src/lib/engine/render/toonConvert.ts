import {
	Mesh,
	MeshToonMaterial,
	type Material,
	type MeshStandardMaterial,
	type Object3D
} from 'three';
import { toonGradientMap } from './toonGradient';

/** Per-mesh caches so we can flip between original and toon materials freely. */
const originals = new WeakMap<Mesh, Material | Material[]>();
const toonVersions = new WeakMap<Mesh, Material | Material[]>();

/** Swap an object tree between its original materials and toon equivalents. */
export function applyToonToObject(root: Object3D, toon: boolean): void {
	root.traverse((obj) => {
		if (!(obj instanceof Mesh)) return;
		if (!originals.has(obj)) originals.set(obj, obj.material);

		if (toon) {
			let cached = toonVersions.get(obj);
			if (!cached) {
				cached = mapMaterial(originals.get(obj)!);
				toonVersions.set(obj, cached);
			}
			obj.material = cached;
		} else {
			obj.material = originals.get(obj)!;
		}
	});
}

function mapMaterial(material: Material | Material[]): Material | Material[] {
	return Array.isArray(material) ? material.map(toToon) : toToon(material);
}

function toToon(material: Material): Material {
	const std = material as MeshStandardMaterial;
	const toon = new MeshToonMaterial({
		gradientMap: toonGradientMap(),
		map: std.map ?? null,
		transparent: std.transparent,
		opacity: std.opacity,
		side: std.side
	});
	if (std.color) toon.color.copy(std.color);
	if (std.emissive) toon.emissive.copy(std.emissive);
	return toon;
}
