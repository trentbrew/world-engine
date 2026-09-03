# Vendored: stylized-components grass field

This subtree is vendored from a third-party MIT project. **It is upstream code — refactor
deliberately**, and keep the attribution below intact.

## Upstream

- **Project:** [stylized-components](https://github.com/cortiz2894/stylized-components)
- **Author:** Christian Ortiz (Cortiz)
- **License:** MIT
- **Vendored from commit:** `c0c02c47971e70b214a25de01ac9633e7608fc84`
- **Vendored on:** 2026-09-02

Upstream's README requires credit with a link back to the repository, in addition to the
MIT notice. Both obligations are met here and in the root `README.md`.

```
MIT License

Copyright (c) 2026 Christian Ortiz (Cortiz)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## What was vendored

The framework-agnostic half only — every file here imports nothing but `three` and its
own siblings. Upstream's React / react-three-fiber / leva layer was **not** ported:

| Here | Upstream path | Change on vendoring |
|---|---|---|
| `uniforms.ts` | `src/components/grassField/uniforms.ts` | verbatim |
| `presets.ts` | `src/components/grassField/presets.ts` | verbatim |
| `scatter.ts` | `src/components/grassField/utils/scatter.ts` | flattened out of `utils/`; import depth `../` → `./` |
| `materials/*.ts` | `src/components/grassField/materials/*.ts` | verbatim |
| `shaders/*.ts` | `src/components/grassField/shaders/*.ts` | verbatim |

Deliberately **not** vendored:

- `index.tsx` — the R3F component. Its build block and its per-frame params→uniforms
  table are re-expressed here as `grassField.ts` / `applyParams.ts`.
- `utils/controls.ts` — 106 leva descriptors, re-expressed as `params.ts`.
- `debug/*.tsx` — leva-driven debug overlays.
- `grass/ShadowController.tsx` — sets `shadowMap.autoUpdate = false` globally, which is
  correct for a static demo and wrong for a world with moving players and physics bodies.

## Asset provenance — unresolved

`grass-scene.glb` ships in upstream's `public/assets`, but upstream carries **no attribution
file for third-party model assets**. The MIT grant above covers the *code*; it does not
speak to the GLB. Confirm that model's origin before vendoring it — see
`docs/adr/0002-asset-storage-registry.md` for how assets are expected to land here.

## Sync policy

One-way. There is no automated path back to upstream, and given the R3F → Threlte
translation there cannot be. Each file carries a header naming its upstream path and
commit so a future upstream fix can be located and hand-applied.
