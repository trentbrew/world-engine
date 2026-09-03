function seededLcg(seed: number) {
	let s = (seed * 1664525 + 1013904223) >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

function makeValueNoise(seed: number) {
	const perm = new Uint8Array(512);
	const rng = seededLcg(Math.abs(Math.round(seed)) || 1);
	const p = new Uint8Array(256);
	for (let i = 0; i < 256; i++) p[i] = i;
	for (let i = 255; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const t = p[i];
		p[i] = p[j];
		p[j] = t;
	}
	for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

	const hash = (x: number, y: number) => perm[(perm[x & 255] + y) & 255] / 255;

	const smooth = (t: number) => t * t * (3 - 2 * t);

	return {
		noise(x: number, y: number): number {
			const xi = Math.floor(x);
			const yi = Math.floor(y);
			const xf = x - xi;
			const yf = y - yi;
			const a = hash(xi, yi);
			const b = hash(xi + 1, yi);
			const c = hash(xi, yi + 1);
			const d = hash(xi + 1, yi + 1);
			const u = smooth(xf);
			const v = smooth(yf);
			return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
		}
	};
}

export type TerrainParams = {
	size: number;
	segments: number;
	heightScale: number;
	baseHeight: number;
	noiseScale: number;
	octaves: number;
	seed: number;
};

export function sampleTerrainHeight(x: number, z: number, params: TerrainParams): number {
	const noise = makeValueNoise(params.seed);
	const half = params.size / 2;
	const nx = (x / params.segments - 0.5) * params.size;
	const nz = (z / params.segments - 0.5) * params.size;

	let amp = 0;
	let freq = params.noiseScale;
	let totalAmp = 0;
	for (let o = 0; o < params.octaves; o++) {
		const w = noise.noise(nx * freq + o * 13.7, nz * freq + o * 7.3);
		const contribution = w * Math.pow(0.55, o);
		amp += contribution;
		totalAmp += Math.pow(0.55, o);
		freq *= 2.2;
	}
	return params.baseHeight + (amp / totalAmp) * params.heightScale;
}

function estimateNormal(x: number, z: number, params: TerrainParams): [number, number, number] {
	const noise = makeValueNoise(params.seed);
	const hPos = sampleTerrainHeight(x + 0.1, z, params);
	const hNeg = sampleTerrainHeight(x - 0.1, z, params);
	const hPosZ = sampleTerrainHeight(x, z + 0.1, params);
	const hNegZ = sampleTerrainHeight(x, z - 0.1, params);
	const nx = (hNeg - hPos) / 0.2;
	const ny = 1;
	const nz = (hPosZ - hNegZ) / 0.2;
	const len = Math.hypot(nx, ny, nz);
	return len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
}

function heightBand(relHeight: number): number {
	if (relHeight < -0.3) return 0;    // water
	if (relHeight < -0.1) return 1;   // shallow water / sand
	if (relHeight < 0.2) return 2;    // grass
	if (relHeight < 0.5) return 3;    // dirt / dirt path
	if (relHeight < 0.7) return 4;    // stone
	if (relHeight < 0.85) return 5;   // metal / hard
	if (relHeight < 0.95) return 6;   // snow
	return 7;                         // default / cliff
}

function kindFromBand(band: number, normalY: number): string {
	switch (band) {
		case 0: return 'water';
		case 1: return normalY > 0.5 ? 'sand' : 'dirt';
		case 2: return 'grass';
		case 3: return 'dirt';
		case 4: return 'stone';
		case 5: return 'metal';
		case 6: return 'snow';
		default: return 'default';
	}
}

export function sampleTerrainKind(
	x: number,
	z: number,
	params: TerrainParams,
	normal: [number, number, number]
): string {
	const height = sampleTerrainHeight(x, z, params);
	const rel = (height - params.baseHeight) / params.heightScale;
	const band = heightBand(rel);
	return kindFromBand(band, normal[1]);
}