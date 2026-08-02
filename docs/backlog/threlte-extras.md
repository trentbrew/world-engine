# Backlog — Threlte Extras as Engine Affordances

`@threlte/extras` is already a dependency (`^9.21.0`). Every item below is pure
adoption — no new packages. Each maps to one of four engine seams:

- **scene** — world-level config, declared once per game (JSON-LD `Scene`/world
  config, surfaced in `SettingsPanel`/`SceneInspector`).
- **view** — per-object, authorable as a JSON-LD component via the
  component→view registry (`render/registerViews.ts`, `render/views/*`).
- **camera** — viewport / render-target infrastructure (`WorldScene.svelte`,
  `render/camera.svelte.ts`).
- **chrome** — editor-only UI affordance.

Priority is leverage × (1 / effort). Dependencies noted where one item unlocks
others.

---

## Tier 1 — high leverage, low effort

### EX-GRID — Configurable floor grid ✅ DONE
- **Seam:** scene · **Effort:** S · **Doc:** extras/grid
- Shipped: `<Grid>` (extras) added to `WorldScene.svelte` over the shadow-catcher
  plane, gated by `ui.chrome.grid`. Config lives in `ui.grid` (`GridConfig` +
  `DEFAULT_GRID` in `ui.svelte.ts`): cellSize / sectionSize / fadeDistance /
  infinite / cellColor / sectionColor, surfaced in `SceneInspector` Grid section
  (sliders + color inputs). Removed the now-redundant `GridHelper` from
  `GroundView` so the editor grid is the single source of truth.
- Follow-up (not done): persist grid config on per-game world config (JSON-LD)
  so games can ship their own grid; reference impl for the rest of this tier.

### EX-RESIZE — Auto-fit / normalize objects
- **Seam:** view+chrome · **Effort:** S · **Doc:** extras/resize
- `<Resize>` to normalize arbitrarily-scaled imported GLTFs to a unit box.
- Wins: AssetsPanel thumbnails, "fit to unit cube" editor action, sane default
  scale on asset drop.

### EX-TRANSITIONS — Spawn/despawn tweens
- **Seam:** view · **Effort:** S · **Doc:** extras/transitions
- Wire enter/exit transitions into the existing spawn/despawn networking (M5):
  entities tween in on `spawn`, out on `despawn`/timeout.
- Nearly-free narrative polish; no new state.

### EX-SOFTSHADOW — Soft shadows toggle
- **Seam:** scene · **Effort:** S · **Doc:** extras/soft-shadows
- `<SoftShadows>` as a single global quality toggle (PCSS) in `SettingsPanel`.

---

## Tier 2 — strong leverage, medium effort

### EX-OUTLINES — Outline component + selection unify
- **Seam:** view · **Effort:** M · **Doc:** extras/outlines
- Adopt `<Outlines>` (inverted-hull). Two uses:
  1. Replace hand-rolled `scene/SelectionOutline.svelte`.
  2. Authorable `Outline` component for cel/toon styling.

### EX-WIREFRAME — Wireframe render style
- **Seam:** view+chrome · **Effort:** M · **Doc:** extras/wireframe
- Material modifier: authorable `Wireframe` render style AND an editor
  "show wireframe" view mode (global override).

### EX-SKY — Sky + Stars backdrop
- **Seam:** scene · **Effort:** M · **Doc:** extras/sky, extras/stars
- `<Sky>` driven by sun elevation/azimuth (pair with directional light),
  `<Stars>` for night. World-level params in a `Scene`/`Environment` component.

### EX-VENV — Virtual environment / IBL
- **Seam:** scene · **Effort:** M · **Doc:** extras/virtual-environment
- `<VirtualEnvironment>` for image-based lighting — correct PBR reflections/
  ambient on GLTFs without shipping HDRI files. High visual payoff per effort.

### EX-LAYERS — Layer system
- **Seam:** view (foundational) · **Effort:** M · **Doc:** extras/layers
- Map three.js layers onto the ontology: selective rendering, per-camera
  visibility, raycast filtering. Unlocks gizmo-only layers, minimaps,
  hide-by-category. **Lands before** EX-HUD / EX-VIEW for best results.

---

## Tier 3 — high ceiling, higher effort

### EX-SPRITE — Animated sprite material
- **Seam:** view · **Effort:** M-L · **Doc:** extras/animated-sprite-material
- `<AnimatedSpriteMaterial>` → a `Sprite` view/component: sprite-sheet
  animation, billboards, cheap particles. Core to the 2D-in-3D / SSX vibe.
- **Depends on** EX-SHADOWALPHA for correct shadows.

### EX-SHADOWALPHA — Alpha-aware shadows
- **Seam:** view · **Effort:** S-M · **Doc:** extras/shadow-alpha
- `<ShadowAlpha>` so alpha-mapped meshes (sprites, foliage) cast correct
  shadows. Mostly a prerequisite/companion to EX-SPRITE.

### EX-HUD — Overlay 3D scene
- **Seam:** camera · **Effort:** M-L · **Doc:** extras/hud
- `<HUD>` generalizes the existing Gizmo: view-cube, minimap, item previews
  rendered on top of the main scene.

### EX-VIEW — Multi-viewport render
- **Seam:** camera · **Effort:** L · **Doc:** extras/view
- `<View>` — multiple DOM-positioned viewports sharing one renderer. Path to
  Blender-style multi-pane (top/front/side/persp) and per-entity thumbnail
  previews. Highest ceiling for "object management."

---

## Suggested sequencing
1. EX-GRID, EX-RESIZE, EX-TRANSITIONS, EX-SOFTSHADOW (quick wins, visible).
2. EX-LAYERS (foundational), then EX-OUTLINES + EX-WIREFRAME.
3. EX-SKY + EX-VENV (world look).
4. EX-SHADOWALPHA → EX-SPRITE.
5. EX-HUD → EX-VIEW (viewport infra, biggest lift).
