// Vendored from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/skyDome/SkyDome.tsx:32-507 @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ../../engine/render/grass/VENDOR.md — upstream code, refactor deliberately.
//
// A stylized painted sky dome: gradient, moon/sun disc with phase terminator and
// FBM maria, hash-based twinkling stars with drift, three-zone rim-lit FBM
// clouds, aurora curtains and a side-warp lens. Rendered on a BackSide unit
// sphere that follows the camera.
//
// This is NOT the same thing as the physical <Sky> already in the engine, which
// is Preetham atmospheric scattering — daylight only, no moon, stars, clouds or
// aurora. The two are complementary; see skyDome.ts.

export const SKY_VERT = /* glsl */ `
  varying vec3 vDir;

  void main() {
    // Local-space position = direction FROM camera (dome follows camera in useFrame)
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
export const SKY_FRAG = /* glsl */ `
  #define PI 3.14159265358979

  // ── Sky gradient ─────────────────────────────────────────────────────────
  uniform vec3  uSkyLow;
  uniform vec3  uSkyHigh;
  uniform float uHorizonLine;
  uniform float uHorizonSpread;

  // ── Moon ─────────────────────────────────────────────────────────────────
  uniform vec3  uMoonDir;
  uniform vec3  uMoonColor;
  uniform vec3  uMoonGlowColor;
  uniform float uMoonSize;
  uniform float uMoonGlowFalloff;
  uniform float uMoonGlowIntensity;
  // Edge & phase
  uniform float uMoonEdgeSoftness;   // 0 = pixel-hard, 0.5 = blurry
  // Linear phase gradient across the disc's local X axis:
  //   uMoonPhasePos  < -1  → fully lit (terminator off-left)
  //   uMoonPhasePos  = 0   → half moon (terminator at centre)
  //   uMoonPhasePos  > 1   → fully dark (terminator off-right)
  uniform float uMoonPhasePos;       // -1.5 (full) … +1.5 (new)
  uniform float uMoonPhaseSoftness;  // 0.05 = sharp terminator, 1.5 = very gradual
  uniform float uMoonPhaseAngle;     // terminator rotation in radians
  uniform float uMoonEmission;       // additive brightness so the disc isn't flat
  // Surface texture (FBM spots / maria)
  uniform vec3  uMoonSpotColor;
  uniform float uMoonSpotScale;
  uniform float uMoonSpotStrength;   // overall blend factor
  uniform float uMoonSpotThreshold;  // FBM cutoff: higher = fewer/smaller patches
  uniform float uMoonSpotSharpness;  // smoothstep half-width: 0.02=hard, 0.2=soft
  uniform int   uMoonSpotOctaves;

  // ── Side distortion (boss fight) ──────────────────────────────────────────
  // Lens-like warp at the screen sides: the sampled sky direction bends and
  // twists as the view direction goes lateral — wide-angle look where cloud
  // bands streak diagonally at the edges. 0 = off (gated per-preset).
  uniform float uSideWarp;  // vertical bend at the sides
  uniform float uSideTwist; // roll/swirl at the sides (radians at full side)

  // ── Aurora / nebula curtains ──────────────────────────────────────────────
  uniform float uAuroraIntensity; // 0 = off (gated per-preset)
  uniform vec3  uAuroraColor1;    // base color (lower edge)
  uniform vec3  uAuroraColor2;    // tip color (upper edge)
  uniform float uAuroraFloor;     // dir.y where the band starts
  uniform float uAuroraCeil;      // dir.y where the band ends
  uniform float uAuroraScale;     // curtain frequency
  uniform float uAuroraSpeed;     // drift / morph speed
  uniform float uAuroraThresh;    // filament cutoff
  uniform float uAuroraSoft;      // filament softness
  uniform float uAuroraWav;       // domain-warp waviness

  // ── Stars ─────────────────────────────────────────────────────────────────
  uniform float uStarDensity;
  uniform float uStarSize;
  uniform float uStarBrightness;
  uniform float uStarFloor;
  uniform float uStarDriftY;         // Y-axis rotation speed (rad/s), ±
  uniform float uStarDriftZ;         // Z-axis rotation speed (rad/s), ±
  uniform float uStarTwinkleSpeed;   // oscillation frequency
  uniform float uStarTwinkleAmount;  // 0 = no twinkle, 1 = full on/off

  // ── Clouds ────────────────────────────────────────────────────────────────
  uniform float uTime;
  uniform float uCloudMorphSpeed;   // per-octave shape evolution speed
  uniform float uCloudSpeed;
  uniform float uCloudScale;
  uniform float uCloudDensity;
  uniform float uCloudSharpness;
  // Three-zone color model
  uniform vec3  uCloudCore;         // deep interior (darkest)
  uniform vec3  uCloudEdge;         // bright outline / backlit edge
  uniform vec3  uCloudRim;          // moon-facing glow at silhouette
  uniform float uCloudEdgeWidth;    // how quickly interior fades to edge (0..1)
  uniform float uCloudRimStrength;  // additive emission intensity
  uniform float uMoonLightRadius;   // angular radius (radians) of moon's light cone
  uniform float uMoonLightSoftness; // 0 = hard cutoff, 1 = very soft (inner edge → 0)
  uniform float uCloudDarkenFar;    // 0 = fully dark far from moon, 1 = no darkening
  uniform float uCloudStretch;      // horizontal stretch of cloud UV (< 1 = wider, > 1 = taller)
  uniform float uCloudFloor;
  uniform float uCloudCeiling;
  uniform float uCloudOpacity;
  // FBM shape controls
  uniform int   uCloudOctaves;      // 1..8
  uniform float uCloudAmplitude;    // persistence per octave (amplitude decay)
  uniform float uCloudGrain;        // high-freq edge detail (0..0.5)
  uniform float uCloudSkew;         // domain-warp strength (0..3)

  varying vec3 vDir;

  // ── Utilities ─────────────────────────────────────────────────────────────
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i),                    hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)),   hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // ── 3-D noise for spherical cloud FBM ────────────────────────────────────
  // Sampling directly on the unit-sphere surface (dir) instead of a planar
  // projection (dir.xz / dir.y) eliminates the UV blow-up at the horizon and
  // makes clouds wrap the inside of the dome naturally.

  float hash31(vec3 p) {
    p  = fract(p * vec3(127.1, 311.7, 74.7));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i),               hash31(i + vec3(1,0,0)), u.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), u.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }

  // Variable-octave 3D FBM — each octave morphs independently via time offsets.
  float fbmCloud(vec3 p) {
    float v = 0.0, a = 0.5, norm = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uCloudOctaves) break;
      float fi     = float(i) + 1.0;
      float morphT = uTime * uCloudMorphSpeed * fi;
      v    += a * valueNoise3D(p + vec3(morphT, morphT * 0.63, morphT * 0.37));
      norm += a;
      p     = p * 2.1 + vec3(1.7, 9.2, 5.4);
      a    *= uCloudAmplitude;
    }
    return v / max(norm, 0.001);
  }

  // Static FBM for moon surface detail — no time dependence so the surface
  // stays fixed regardless of how long the game runs.
  float fbmMoon(vec2 p) {
    float v = 0.0, a = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= uMoonSpotOctaves) break;
      v    += a * valueNoise(p);
      norm += a;
      p     = p * 2.1 + vec2(3.1, 7.4);
      a    *= 0.5;
    }
    return v / max(norm, 0.001);
  }

  // ── Star field ─────────────────────────────────────────────────────────────
  // Fix 1 — Equal-angle UV:  u=az/(2π), v=asin(y)/(2π)
  //          Both axes cover the same angle per UV unit at the equator.
  //          Eliminates the 4× horizontal stretch of the old dir.y mapping.
  //
  // Fix 2 — 3×3 cell sampling + fwidth AA:
  //          Sampling only the current cell causes stars to pop at cell borders
  //          as the camera moves. Checking all 9 neighbors and using the pixel
  //          footprint (fwidth) as the smoothstep edge width makes stars stable
  //          and smooth at sub-pixel sizes.
  //
  // Fix 3 — Drift + Twinkle:
  //          The direction vector is rotated slowly around Y (drift) before
  //          computing UV, so the whole star field scrolls gradually.
  //          Brightness oscillates per-star with a random phase (twinkle).
  float starField(vec3 dir) {
    if (dir.y < uStarFloor - 0.05) return 0.0;

    // Drift Y: slow rotation around world Y-axis (horizontal scroll)
    float aY = uTime * uStarDriftY;
    float cY = cos(aY), sY = sin(aY);
    vec3 d = vec3(
      dir.x * cY + dir.z * sY,
      dir.y,
      -dir.x * sY + dir.z * cY
    );

    // Drift Z: rotation around world Z-axis (roll / diagonal tilt)
    float aZ = uTime * uStarDriftZ;
    float cZ = cos(aZ), sZ = sin(aZ);
    d = vec3(
      d.x * cZ - d.y * sZ,
      d.x * sZ + d.y * cZ,
      d.z
    );

    // Equal-angle spherical UV
    // u: azimuth [0,1] spans 2π rad
    // v: elevation via asin — same angular scale as u at the equator
    float az = atan(d.z, d.x);                           // [-π, π]
    float el = asin(clamp(d.y, -1.0, 1.0));              // [-π/2, π/2]
    float u  = az / (2.0 * PI) + 0.5;                    // [0, 1]
    float v  = el / (2.0 * PI) + 0.5;                    // [0.25, 0.75]

    vec2 uv   = vec2(u, v) * uStarDensity;
    vec2 cell = floor(uv);
    vec2 f    = fract(uv);

    // Pixel footprint in UV space → used for AA edge width.
    // At the atan2 seam (az = ±π) u jumps from ~1 to ~0 across two adjacent
    // pixels, so dFdx(uv.x) spikes to ~density (~300). That makes aa enormous,
    // which causes 1-smoothstep(r, r+aa, dist) ≈ 1 for every star in the 3×3
    // loop, lighting up the entire column as a bright line.
    // Guard: if the footprint is unreasonably large we are on the seam —
    // return 0 immediately. The seam is only 1-2 pixels wide; hiding them is
    // invisible compared to the bright artifact.
    vec2 uvPx = vec2(
      length(vec2(dFdx(uv.x), dFdy(uv.x))),
      length(vec2(dFdx(uv.y), dFdy(uv.y)))
    );
    if (max(uvPx.x, uvPx.y) > 2.0) return 0.0;
    float aa = max(uvPx.x, uvPx.y);

    float result = 0.0;

    // Sample 3×3 neighbors — eliminates border-crossing flicker.
    // nw wraps n.x modulo density to fix the atan2 seam (az = ±π):
    // without the wrap, cells on the left side (n.x = -1) and cells on the
    // right side (n.x = density) look up different hashes despite being
    // spatially adjacent — producing a visible vertical artifact line that
    // worsens as drift moves the star field through the seam over time.
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 n          = cell + vec2(float(dx), float(dy));
        vec2 nw         = vec2(mod(n.x, uStarDensity), n.y); // seam-safe wrap
        float brightness = hash21(nw + 0.5);
        float hasstar    = step(0.6, brightness); // ~40% of cells

        vec2  offset = hash22(nw);
        float dist   = length(f - (vec2(float(dx), float(dy)) + offset));
        float r      = uStarSize * (0.3 + 0.7 * brightness);

        // Anti-aliased disc using pixel footprint
        float a = (1.0 - smoothstep(r, r + max(aa, 0.001), dist)) * hasstar;

        // Twinkle: per-star sine oscillation with random phase + speed
        float phase   = hash21(nw + 3.7) * 6.28318;
        float rate    = uStarTwinkleSpeed * (0.6 + 0.8 * hash21(nw + 1.3));
        float twinkle = 1.0 - uStarTwinkleAmount * (0.5 + 0.5 * sin(uTime * rate + phase));
        a *= clamp(twinkle, 0.0, 1.0);

        result = max(result, a);
      }
    }

    result *= smoothstep(uStarFloor, uStarFloor + 0.1, dir.y);
    return result;
  }

  void main() {
    vec3 dir = normalize(vDir);
    // Unwarped copy — the moon/sun disc and its glow must NOT bend with the
    // side distortion; they stay anchored at their true sky position.
    vec3 dirM = dir;

    // ── 0. Side distortion (boss fight) ───────────────────────────────────
    // Work in view space: x/|z| ≈ tan of the horizontal view angle. The
    // sampled direction is twisted (roll) and bent (vertical) quadratically
    // toward the screen sides, then rotated back to world space. Warping the
    // direction itself keeps every layer (gradient, stars, aurora, moon,
    // clouds) coherent under the same lens.
    if (abs(uSideWarp) > 0.001 || abs(uSideTwist) > 0.001) {
      vec3 vd = mat3(viewMatrix) * dir;
      float side = vd.x / max(abs(vd.z), 0.25);
      float s2   = side * side;

      // Swirl: signed quadratic twist — mirrors on left/right
      float tw = side * abs(side) * uSideTwist;
      float cs = cos(tw), sn = sin(tw);
      vd.xy = vec2(cs * vd.x - sn * vd.y, sn * vd.x + cs * vd.y);

      // Vertical bend: horizon curves at the edges
      vd.y += s2 * uSideWarp;

      // Back to world space (rotation inverse = transpose)
      dir = normalize(vd * mat3(viewMatrix));
    }

    // ── 1. Sky gradient ───────────────────────────────────────────────────
    float t     = smoothstep(uHorizonLine - uHorizonSpread, uHorizonLine + uHorizonSpread, dir.y);
    vec3  color = mix(uSkyLow, uSkyHigh, t);

    // ── 2. Moon glow (corona behind clouds & stars) — uses the UNWARPED dir
    float cosA = dot(dirM, normalize(uMoonDir));
    float glow  = pow(max(cosA, 0.0), uMoonGlowFalloff) * uMoonGlowIntensity;
    color += uMoonGlowColor * glow;

    // ── 3. Stars ──────────────────────────────────────────────────────────
    float star = starField(dir);
    color = mix(color, vec3(1.0), star * uStarBrightness);

    // ── 3b. Aurora / nebula curtains (additive, behind moon & clouds) ─────
    if (uAuroraIntensity > 0.001) {
      float aBand = smoothstep(uAuroraFloor, uAuroraFloor + 0.15, dir.y) *
                    smoothstep(uAuroraCeil, uAuroraCeil - 0.25, dir.y);
      if (aBand > 0.0) {
        vec3 ap = dir * uAuroraScale;
        ap.y *= 0.25;                        // stretch noise vertically → curtains
        ap.x += uTime * uAuroraSpeed;
        // Wavy domain warp — slow undulation of the curtains
        ap.xz += (vec2(
          valueNoise3D(ap * 0.5 + vec3(0.0, uTime * uAuroraSpeed * 0.7, 3.1)),
          valueNoise3D(ap * 0.5 + vec3(5.2, uTime * uAuroraSpeed * 0.5, 1.7))
        ) - 0.5) * uAuroraWav;

        float n = valueNoise3D(ap) * 0.65 +
                  valueNoise3D(ap * 2.3 + vec3(7.1, 0.0, 2.9)) * 0.35;
        float curtain = smoothstep(uAuroraThresh - uAuroraSoft,
                                   uAuroraThresh + uAuroraSoft, n);

        // Vertical color ramp inside the band: color1 low → color2 high
        float vt = clamp((dir.y - uAuroraFloor) /
                         max(uAuroraCeil - uAuroraFloor, 0.001), 0.0, 1.0);
        vec3 aCol = mix(uAuroraColor1, uAuroraColor2, vt);
        color += aCol * curtain * aBand * uAuroraIntensity;
      }
    }

    // ── 4. Moon disc — applied BEFORE clouds so cloud mix naturally occludes it
    float moonAngle = acos(clamp(cosA, -1.0, 1.0));

    // Build a local 2-D frame at the moon's sky position so we can project
    // the current fragment direction onto it and work in "moon UV" space.
    vec3 moonFwd   = normalize(uMoonDir);
    vec3 moonBase  = abs(moonFwd.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 moonRight = normalize(cross(moonFwd, moonBase));
    vec3 moonUp    = cross(moonRight, moonFwd);

    // Project the UNWARPED dir onto the frame: the disc ignores side distortion.
    float moonR2D = max(sin(uMoonSize), 0.0001);
    vec2  moonUV  = vec2(dot(dirM, moonRight), dot(dirM, moonUp)) / moonR2D;

    // Disc edge: 0.001 = near-pixel-hard, 0.5 = soft glow
    float edge     = max(uMoonEdgeSoftness, 0.001);
    float moonMask = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, length(moonUV));

    // ── Linear phase gradient ────────────────────────────────────────────
    // Rotate moonUV by uMoonPhaseAngle so the terminator can be tilted.
    // Then project onto the rotated X axis — negative = lit side, positive = dark.
    float cosPA   = cos(uMoonPhaseAngle);
    float sinPA   = sin(uMoonPhaseAngle);
    float projX   = moonUV.x * cosPA - moonUV.y * sinPA;
    float litFactor = 1.0 - smoothstep(
      uMoonPhasePos - uMoonPhaseSoftness,
      uMoonPhasePos + uMoonPhaseSoftness,
      projX
    );

    // ── Surface texture: thresholded FBM blobs (hard lunar maria) ────────
    // FBM is thresholded at uMoonSpotThreshold and sharpened by
    // uMoonSpotSharpness — small values give crisp dark patches like the
    // reference image; larger values give a painterly gradient.
    vec3 moonTexColor = uMoonColor;
    if (moonAngle < uMoonSize * 2.0) {
      float spots     = fbmMoon(moonUV * uMoonSpotScale);
      float spotPatch = smoothstep(
        uMoonSpotThreshold - uMoonSpotSharpness,
        uMoonSpotThreshold + uMoonSpotSharpness,
        spots
      );
      moonTexColor = mix(uMoonColor, uMoonSpotColor, spotPatch * uMoonSpotStrength);
    }

    color = mix(color, moonTexColor, moonMask * litFactor);
    // Additive emission: the lit surface radiates light beyond a flat mix,
    // giving the disc a self-luminous quality without needing post-bloom.
    color += moonTexColor * (moonMask * litFactor) * uMoonEmission;

    // ── 5. FBM clouds ─────────────────────────────────────────────────────
    // Ceiling is handled as a DENSITY falloff (fewer/smaller clouds toward the
    // top) instead of an opacity fade — only a tiny guard band remains here.
    float cloudBand = smoothstep(uCloudFloor, uCloudFloor + 0.1, dir.y) *
                      smoothstep(uCloudCeiling, uCloudCeiling - 0.05, dir.y);

    if (cloudBand > 0.0) {
      // Spherical cloud sampling: dir IS the unit-sphere surface point.
      // No planar projection → no UV blowup at the horizon, clouds wrap
      // the inside of the dome with consistent density and curvature.
      vec3 cloudP  = dir * uCloudScale;
      cloudP.x    *= uCloudStretch;       // horizontal aspect ratio (< 1 wider)
      cloudP.x    += uTime * uCloudSpeed; // eastward wind scroll

      // Domain warping on XZ plane (fbm-of-fbm for organic shapes)
      vec2 q = vec2(
        fbmCloud(cloudP),
        fbmCloud(cloudP + vec3(5.2, 1.3, 2.7))
      );
      cloudP.xz += uCloudSkew * (q - 0.5);

      // Grain: high-frequency 3D noise roughens the cloud silhouette
      float grain = (valueNoise3D(cloudP * 6.0) - 0.5) * uCloudGrain;
      float raw   = clamp(fbmCloud(cloudP) + grain, 0.0, 1.0);

      // Density falloff toward the ceiling: from 35% of the band upward the
      // effective density ramps to 0, so clouds thin out and break into
      // smaller separate puffs as they approach the ceiling (no flat fade).
      float ceilT = smoothstep(
        mix(uCloudFloor, uCloudCeiling, 0.35),
        uCloudCeiling,
        dir.y
      );
      float threshold = 1.0 - uCloudDensity * (1.0 - ceilT);

      // Cloud opacity
      float cloud = smoothstep(
        threshold - uCloudSharpness,
        threshold + uCloudSharpness,
        raw
      ) * cloudBand;

      // ── Volume / edge model ──────────────────────────────────────────
      // depth: 0.0 = cloud silhouette edge, 1.0 = deep interior
      float depth      = clamp((raw - threshold) / max(uCloudEdgeWidth, 0.001), 0.0, 1.0);
      float edgeFactor = 1.0 - depth;

      // Moon light cone: angular distance from this cloud fragment to the moon.
      // uMoonLightSoftness controls how wide the gradient is:
      //   0.0 → sharp half-radius cutoff (original behaviour)
      //   1.0 → very soft, inner edge collapses to 0 (full radius is gradient)
      float moonAngDist = acos(clamp(cosA, -1.0, 1.0));
      float innerEdge   = uMoonLightRadius * (1.0 - clamp(uMoonLightSoftness, 0.0, 0.999));
      float moonLight   = 1.0 - smoothstep(innerEdge, uMoonLightRadius, moonAngDist);

      // ── Distance darkening ───────────────────────────────────────────
      // Clouds far from the moon darken — same sky darkening as the background.
      // moonLight (0..1) drives a brightness multiplier.
      float brightness = mix(uCloudDarkenFar, 1.0, moonLight);

      // Base cloud color: core (interior) → edge (boundary), scaled by brightness.
      // No rim baked in — rim is handled separately as a silhouette halo below.
      vec3 cColor = mix(uCloudCore, uCloudEdge, edgeFactor) * brightness;

      color = mix(color, cColor, cloud * uCloudOpacity);

      // ── Rim light: silhouette halo (additive, after composite) ───────
      // cloud * (1 - cloud) peaks at 0.25 where opacity = 0.5 — exactly at
      // the cloud's silhouette boundary. Multiplying by 4 normalises it to 1.0.
      // Applied additively to the ALREADY COMPOSITED color so it glows as a
      // separate halo independent of cloud interior shading — like real backlit
      // cloud edges where light bleeds around the silhouette without tinting the
      // cloud body itself.
      float silhouetteMask = 4.0 * cloud * (1.0 - cloud);
      color += uCloudRim * silhouetteMask * moonLight * uCloudRimStrength;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
