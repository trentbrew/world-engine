// SPIKE placeholders for the trees/flowers integration — NOT art direction.
//
// The flower shader path (flowerMaterial + scatterFlowers) is fully ported but
// has never rendered in this engine: upstream's flower/bark PNGs ship with no
// authorship info, and grass-scene.glb (the tree/rock source) carries a
// Sketchfab marker with no license, so neither can be vendored yet (see
// ./VENDOR.md "Asset provenance — unresolved").
//
// These canvas-generated sets let the dormant flower path run end-to-end with
// zero assets: they satisfy the exact texture contract in
// shaders/flower.ts (mask R = cut-out, RGB dominance = palette zones, gradient
// R = base→tip fade). Swap them for authored texture refs when those clear
// provenance; the swap is data-only (Terrain `grass.flowersFrom`, GrassField
// texture fields).
//
// Deliberately crude — a spike should look like a spike.

import { CanvasTexture, NoColorSpace, type Texture } from 'three';

/** Flower maps per variant: mask, RGB zones, base→tip gradient. */
export type PlaceholderFlowerSet = [Texture, Texture, Texture];

const SIZE = 128;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const el = document.createElement('canvas');
	el.width = SIZE;
	el.height = SIZE;
	const ctx = el.getContext('2d')!;
	return [el, ctx];
}

function toTexture(el: HTMLCanvasElement): Texture {
	const tex = new CanvasTexture(el);
	// All three maps are data (cut-out, zone picks, fade) — never sRGB.
	tex.colorSpace = NoColorSpace;
	tex.needsUpdate = true;
	return tex;
}

/** White silhouette on black: stem + leaves + petal ring. R >= 0.5 is kept. */
function paintMask(variant: 'a' | 'b'): HTMLCanvasElement {
	const [el, ctx] = canvas();
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, SIZE, SIZE);
	ctx.fillStyle = '#fff';

	// Stem: vertical bar, base at the bottom edge (uv.y = 0 is the ground).
	const stemW = variant === 'a' ? 10 : 8;
	const stemTop = variant === 'a' ? 52 : 40;
	ctx.fillRect(SIZE / 2 - stemW / 2, stemTop, stemW, SIZE - stemTop);

	// Leaves: two ellipses halfway up.
	ctx.beginPath();
	ctx.ellipse(SIZE / 2 - 16, 96, 14, 6, -0.5, 0, Math.PI * 2);
	ctx.ellipse(SIZE / 2 + 16, 100, 14, 6, 0.5, 0, Math.PI * 2);
	ctx.fill();

	// Petal ring around the crown.
	const cx = SIZE / 2;
	const cy = variant === 'a' ? 38 : 32;
	const petals = variant === 'a' ? 5 : 6;
	const ringR = variant === 'a' ? 15 : 18;
	const petalR = variant === 'a' ? 13 : 10;
	for (let i = 0; i < petals; i++) {
		const a = (i / petals) * Math.PI * 2;
		ctx.beginPath();
		ctx.arc(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, petalR, 0, Math.PI * 2);
		ctx.fill();
	}
	// Crown hub so the middle isn't hollow.
	ctx.beginPath();
	ctx.arc(cx, cy, 9, 0, Math.PI * 2);
	ctx.fill();
	return el;
}

/**
 * Zone picks: neutral gray → stem color; R/G/B-dominant → that palette slot.
 * A paints petals red, B paints them blue with a green heart.
 */
function paintZones(variant: 'a' | 'b'): HTMLCanvasElement {
	const [el, ctx] = canvas();
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, SIZE, SIZE);

	// Stem + leaves stay neutral → uColorStem.
	ctx.fillStyle = 'rgb(128,128,128)';
	const stemW = variant === 'a' ? 10 : 8;
	const stemTop = variant === 'a' ? 52 : 40;
	ctx.fillRect(SIZE / 2 - stemW / 2, stemTop, stemW, SIZE - stemTop);
	ctx.beginPath();
	ctx.ellipse(SIZE / 2 - 16, 96, 14, 6, -0.5, 0, Math.PI * 2);
	ctx.ellipse(SIZE / 2 + 16, 100, 14, 6, 0.5, 0, Math.PI * 2);
	ctx.fill();

	// Petals: dominant channel picks the palette slot.
	ctx.fillStyle = variant === 'a' ? 'rgb(255,40,40)' : 'rgb(40,40,255)';
	const cx = SIZE / 2;
	const cy = variant === 'a' ? 38 : 32;
	const petals = variant === 'a' ? 5 : 6;
	const ringR = variant === 'a' ? 15 : 18;
	const petalR = variant === 'a' ? 13 : 10;
	for (let i = 0; i < petals; i++) {
		const a = (i / petals) * Math.PI * 2;
		ctx.beginPath();
		ctx.arc(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, petalR, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.beginPath();
	if (variant === 'a') {
		ctx.fillStyle = 'rgb(255,40,40)';
		ctx.arc(cx, cy, 9, 0, Math.PI * 2);
	} else {
		// Green heart → uColorG accent against blue petals.
		ctx.fillStyle = 'rgb(40,255,40)';
		ctx.arc(cx, cy, 9, 0, Math.PI * 2);
	}
	ctx.fill();
	return el;
}

/** Base→tip fade: black at the ground edge, white toward the crown. */
function paintGradient(): HTMLCanvasElement {
	const [el, ctx] = canvas();
	const g = ctx.createLinearGradient(0, SIZE, 0, 0);
	g.addColorStop(0, '#000');
	g.addColorStop(0.7, '#fff');
	g.addColorStop(1, '#fff');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, SIZE, SIZE);
	return el;
}

export function makePlaceholderFlowerSet(variant: 'a' | 'b'): PlaceholderFlowerSet {
	return [
		toTexture(paintMask(variant)),
		toTexture(paintZones(variant)),
		toTexture(paintGradient())
	];
}
