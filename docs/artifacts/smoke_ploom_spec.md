# Spec: Naruto Shadow Clone Smoke Ploom (Kage Bunshin VFX)

## 1. Goal & Aesthetic Direction
Recreate the iconic **Naruto "Poof" Smoke Ploom** that erupts whenever a ninja performs Kage Bunshin no Jutsu (Shadow Clone Jutsu) or dispels a clone.

### Visual Targets
- **Anime Stylization**: High-energy, cel-shaded volumetric "cloud cluster" rather than photorealistic wispy particles.
- **Silhouette**: Rapidly expanding radial cluster of toon puffs that billow upwards into a cloud before cleanly popping/dispersing into thin air.
- **Color & Shading**: Chalky ninja-smoke white (`#f4f4f6`) with subtle warm/cool cel shadow tints (`#d1d5db` to `#9ca3af`), high opacity during the burst peak, flat/toon shaded or unlit with sharp comic edges.
- **Timing**: Snappy and punchy. Total lifecycle is approximately **800ms - 900ms**:
  - **T = 0 to 120ms (The Pop)**: Instantaneous explosive radial expansion from scale 0 to 1.3x.
  - **T = 120ms to 400ms (The Billow)**: Decelerating outward velocity + upward vertical buoyancy drift (~1.2m/s), gentle random tumbling.
  - **T = 400ms to 850ms (The Dissipate)**: Rapid contraction & opacity fade to zero with scale shrinking to 0, leaving clear air.

---

## 2. Technical Architecture

### 2.1 Geometry & Puff Structure
Rather than heavy point clouds or 2D billboard sprites (which clip into 3D characters and terrain when viewed at grazing angles), use a **procedural 3D puff cluster**:
- **Geometry**: Low-poly deformed spheres (`IcosahedronGeometry(radius, 2)` or `DodecahedronGeometry`), giving crisp stylized facets.
- **Cluster Count**: 14 to 18 individual puff spheres per burst.
- **Offset Distribution**:
  - Core cloud: 4-6 central puffs at clone torso height (`y ≈ 0.8 - 1.2m`).
  - Base ring: 5-7 outer puffs bursting outwards at foot/ground level (`y ≈ 0.2 - 0.4m`).
  - Canopy ring: 4-5 puffs billowing towards head/above (`y ≈ 1.4 - 1.8m`).

### 2.2 Material & Shading
- `MeshToonMaterial` or `MeshBasicMaterial` with custom depth-write disable (`depthWrite: false`, `transparent: true`).
- Blending: `NormalBlending` with opacity envelope $O(t)$.
- Edge Accent: Optional stylized outer ring / shockwave disc at the ground plane that expands horizontally and fades out in 200ms.

### 2.3 Burst State & Lifecycle (`smokePloom.svelte.ts`)
```ts
export interface SmokeBurst {
  id: number;
  position: [number, number, number];
  startTime: number;
  durationMs: number; // ~850ms
  puffs: Array<{
    baseOffset: [number, number, number];
    direction: [number, number, number];
    speed: number;
    maxScale: number;
    rotSpeed: [number, number, number];
  }>;
}
```

### 2.4 Rendering Component (`SmokePloomHost.svelte`)
- Mounted in `WorldScene.svelte` inside the Threlte canvas.
- Subscribes to `smokePloomState.bursts`.
- Advances puff transforms on `useTask` render tick:
  - Radial push along `direction * easeOutQuad(progress)`.
  - Upward float along `+Y`.
  - Scale envelope: $S(t) = \text{popIn}(t) \times \text{shrinkOut}(t)$.
  - Auto-despawns bursts once `progress >= 1.0`.

---

## 3. Trigger Points
1. **Clone Summon (`spawnClone`)**:
   - Triggers at `spawnPos` immediately as the clone entity appears in the world.
   - Synchronized with jutsu sound effect / authentic "poof" audio.
2. **Clone Dispel (`dispelClone`)**:
   - Triggers at the clone's exact current `Transform.position`.
   - Entity despawns as smoke bursts, so the clone is masked by the smoke cloud and seamlessly vanishes.

---

## 4. Performance & Memory Budget
- Max active bursts capped at 6 concurrent bursts (excess bursts auto-culled).
- Pooled geometries and single shared `MeshToonMaterial` / `MeshBasicMaterial` across all puffs.
- Total polygon cost per burst: ~3,000 triangles, lasting under 1 second. Zero garbage collection pressure.
