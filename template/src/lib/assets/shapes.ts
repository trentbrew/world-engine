/** Static primitive catalog for the Assets tab Shapes section. */

export type ShapeThumb = 'box' | 'sphere' | 'capsule';

export type ShapeEntry = {
	id: string;
	label: string;
	mesh: string;
	thumb: ShapeThumb;
};

export const SHAPE_CATALOG: ShapeEntry[] = [
	{ id: 'box', label: 'Box', mesh: 'primitive:box', thumb: 'box' },
	{ id: 'sphere', label: 'Sphere', mesh: 'primitive:sphere', thumb: 'sphere' },
	{ id: 'capsule', label: 'Capsule', mesh: 'primitive:capsule', thumb: 'capsule' }
];
