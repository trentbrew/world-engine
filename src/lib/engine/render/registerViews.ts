/**
 * Wires built-in component views into the ontology registry. Imported once for
 * its side effects (see Thing.svelte). Keeping this separate from registry.ts
 * lets the ontology layer stay free of `.svelte` imports.
 */
import { registerView } from '$lib/engine/ontology/registry';
import GaussianSplatView from './views/GaussianSplatView.svelte';
import GroundView from './views/GroundView.svelte';
import LightView from './views/LightView.svelte';
import MarkerView from './views/MarkerView.svelte';
import MeshView from './views/MeshView.svelte';
import SkinnedMeshView from './views/SkinnedMeshView.svelte';
import SpriteView from './views/SpriteView.svelte';

registerView('Render', MeshView);
registerView('GaussianSplat', GaussianSplatView);
registerView('SkinnedMesh', SkinnedMeshView);
registerView('Sprite', SpriteView);
registerView('Ground', GroundView);
registerView('Marker', MarkerView);
registerView('Light', LightView);
