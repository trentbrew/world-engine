/**
 * Locks the terrain ground-dirt blend (design B): the grass-field dirt/lush-dry
 * treatment is injected OVER the terrain's vertex-color elevation ramp, gated by
 * a uniform — never swapping the material.
 *
 * Shader injection is verified without a GPU by invoking the material's
 * onBeforeCompile with a stub shader and asserting the ground-mask GLSL +
 * uniform gate landed. No browser needed.
 * Run: pnpm exec tsx --tsconfig .svelte-kit/tsconfig.json scripts/terrain-dirt-smoke.ts
 */
import { createTerrain, applyTerrainGroundDirt } from '$lib/engine/render/terrain/terrain';
import { createGrassFieldUniforms } from '$lib/engine/render/grass/uniforms';

function fail(message: string): never {
	console.error(`FAIL: ${message}`);
	process.exit(1);
}

const terrain = createTerrain({ params: { size: 12, segments: 16 } });
const mat = terrain.object3D.material as import('three').MeshStandardMaterial;

if (mat.userData.grassDirtApplied) fail('material unexpectedly pre-patched');

const uniforms = createGrassFieldUniforms();
const { setEnabled } = applyTerrainGroundDirt(mat, uniforms.surface, 1);

if (!mat.userData.grassDirtApplied) fail('terrain material was not patched');

// Simulate compile to prove the injection (stub shader, no GPU).
const stub: { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> } = {
	vertexShader: 'void main() { vec4 transformed = vec4(0.0); }',
	fragmentShader: '#include <color_fragment>',
	uniforms: {}
};
mat.onBeforeCompile(stub as never);
if (!stub.vertexShader.includes('vGndXZ')) fail('missing vGndXZ varying');
if (!stub.fragmentShader.includes('groundDirt')) fail('missing groundDirt() in fragment');
if (!stub.fragmentShader.includes('uGrassEnabled')) fail('missing uGrassEnabled uniform gate');
if (!stub.fragmentShader.includes('#include <color_fragment>')) fail('base color include removed (must preserve vertex ramp)');

// Toggling gates the blend via the SAME shader uniform object across re-applies;
// the idempotent re-apply path must not hand back a stale setter.
setEnabled(0);
setEnabled(1);
const { setEnabled: setEnabled2 } = applyTerrainGroundDirt(mat, uniforms.surface, 1);
if (!mat.userData.grassDirtApplied) fail('re-apply dropped the patch');
const shared = mat.userData.grassDirt as { value: number };
setEnabled2(0);
if (shared.value !== 0) fail('idempotent setter did not drive the shader uniform');
setEnabled2(1);
if (shared.value !== 1) fail('setter did not re-enable the shader uniform');

terrain.dispose();
console.log('terrain-dirt OK');
process.exit(0);
