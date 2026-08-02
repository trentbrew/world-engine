# Backlog — UI Chrome

Editor and shell affordances that live outside the 3D viewport. Same priority
formula as [threlte-extras.md](./threlte-extras.md): leverage × (1 / effort).

---

## Tier 1 — active wedge

*(none — pick next from high leverage below)*

### ~~UI-DEBUGCONSOLE~~ — Floating debug dock ✅ shipped

- Bottom-right Developer HUD; `StatusBar` + `InputHud` removed. See [debug-console.md](./debug-console.md).

---

## Tier 1 — high leverage, low effort

### UI-DOTLOADER — Dot-matrix frame loader (Pong)

- **Seam:** chrome · **Effort:** S · **Inspiration:** [CleanShot mockup](../artifacts/ui_dotloader_pong.png)
- A **7×7 dot grid** that animates by toggling active cells per frame — low-fi,
  on-brand loading chrome with game-engine personality. Reference React impl
  below; port to Svelte 5 as `$lib/components/ui/dot-loader/`.

#### Visual spec

| Token | Value |
| --- | --- |
| Grid | 7 cols × 7 rows (49 dots), `gap: 2px` |
| Dot idle | `bg-white/15` (or `--text-muted` at ~15% opacity) |
| Dot active | solid white (or `--text`) |
| Dot size | 6px (`size-1.5` in Tailwind terms) |
| Shape | `rounded-sm` (slightly squared pixels) |
| Container | dark pill (`--surface-raised`), label beside grid |

Example composed state (play mode):

```
[ ▪▪▪ · · · · ]  Playing
[ ▪ · · · · · ▪ ]
[ ▪ · · · · · ▪ ]
[ ▪ · ▪ · · · ▪ ]   ← ball + paddles (one frame)
[ · · · · · · ▪ ]
[ · · · · · · ▪ ]
[ · · · · · · · ]
```

#### API (target)

```svelte
<DotLoader
  frames={pongFrames}
  duration={100}
  isPlaying={true}
  repeatCount={-1}
  onComplete={() => {}}
/>
```

| Prop | Default | Notes |
| --- | --- | --- |
| `frames` | required | `number[][]` — each frame is a list of **active dot indices** (0–48, row-major) |
| `duration` | `100` | ms per frame |
| `isPlaying` | `true` | pause/resume |
| `repeatCount` | `-1` | `-1` = infinite; else stop after N full loops |
| `onComplete` | — | fires once when `repeatCount` exhausted |

Implementation notes for Svelte port:

- Prefer `$effect` + `setInterval` over DOM `classList.toggle` — bind `active`
  per dot from a reactive `frameIndex` and `frames[frameIndex].includes(i)`.
- Export preset frame sets (`pongFrames`, future: `snakeFrames`, `pulseFrames`).
- `aria-hidden="true"` on grid; pair with visible label for a11y.

#### Pong preset frames

Ship the 16-frame loop from the reference demo as `pongFrames`:

```ts
export const pongFrames: number[][] = [
  [14, 7, 0, 8, 6, 13, 20],
  [14, 7, 13, 20, 16, 27, 21],
  [14, 20, 27, 21, 34, 24, 28],
  [27, 21, 34, 28, 41, 32, 35],
  [34, 28, 41, 35, 48, 40, 42],
  [34, 28, 41, 35, 48, 42, 46],
  [34, 28, 41, 35, 48, 42, 38],
  [34, 28, 41, 35, 48, 30, 21],
  [34, 28, 41, 48, 21, 22, 14],
  [34, 28, 41, 21, 14, 16, 27],
  [34, 28, 21, 14, 10, 20, 27],
  [28, 21, 14, 4, 13, 20, 27],
  [28, 21, 14, 12, 6, 13, 20],
  [28, 21, 14, 6, 13, 20, 11],
  [28, 21, 14, 6, 13, 20, 10],
  [14, 6, 13, 20, 9, 7, 21],
];
```

Index layout (row-major, cols = 7):

```
 0  1  2  3  4  5  6
 7  8  9 10 11 12 13
14 15 16 17 18 19 20
21 22 23 24 25 26 27
28 29 30 31 32 33 34
35 36 37 38 39 40 41
42 43 44 45 46 47 48
```

#### Reference React implementation

Source: external shadcn-style `DotLoader` + `Demo` (ported 2026-06-20).

<details>
<summary>dot-loader.tsx</summary>

```tsx
"use client";

import { ComponentProps, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type DotLoaderProps = {
    frames: number[][];
    dotClassName?: string;
    isPlaying?: boolean;
    duration?: number;
    repeatCount?: number;
    onComplete?: () => void;
} & ComponentProps<"div">;

export const DotLoader = ({
    frames,
    isPlaying = true,
    duration = 100,
    dotClassName,
    className,
    repeatCount = -1,
    onComplete,
    ...props
}: DotLoaderProps) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const currentIndex = useRef(0);
    const repeats = useRef(0);
    const interval = useRef<NodeJS.Timeout>(null);

    const applyFrameToDots = useCallback(
        (dots: HTMLDivElement[], frameIndex: number) => {
            const frame = frames[frameIndex];
            if (!frame) return;
            dots.forEach((dot, index) => {
                dot.classList.toggle("active", frame.includes(index));
            });
        },
        [frames],
    );

    useEffect(() => {
        currentIndex.current = 0;
        repeats.current = 0;
    }, [frames]);

    useEffect(() => {
        if (isPlaying) {
            if (currentIndex.current >= frames.length) {
                currentIndex.current = 0;
            }
            const dotElements = gridRef.current?.children;
            if (!dotElements) return;
            const dots = Array.from(dotElements) as HTMLDivElement[];
            interval.current = setInterval(() => {
                applyFrameToDots(dots, currentIndex.current);
                if (currentIndex.current + 1 >= frames.length) {
                    if (repeatCount != -1 && repeats.current + 1 >= repeatCount) {
                        clearInterval(interval.current!);
                        onComplete?.();
                    }
                    repeats.current++;
                }
                currentIndex.current = (currentIndex.current + 1) % frames.length;
            }, duration);
        } else {
            if (interval.current) clearInterval(interval.current);
        }
        return () => {
            if (interval.current) clearInterval(interval.current);
        };
    }, [frames, isPlaying, applyFrameToDots, duration, repeatCount, onComplete]);

    return (
        <div {...props} ref={gridRef} className={cn("grid w-fit grid-cols-7 gap-0.5", className)}>
            {Array.from({ length: 49 }).map((_, i) => (
                <div key={i} className={cn("h-1.5 w-1.5 rounded-sm", dotClassName)} />
            ))}
        </div>
    );
};
```

</details>

#### Integration targets (v1)

1. **Play mode badge** — replace or augment `PlayModeButton` "Stop" state with
   `[DotLoader pong] Playing` pill (matches mockup). Keep square icon fallback
   for reduced-motion.
2. **World boot** — `WorldShell.svelte` while `world.status === 'loading'`;
   swap plain "Loading…" in `AssetsPanel` for dot loader + label.
3. **Durable sync** — optional pulse beside `durable live/offline` in
   `StatusBar.svelte` when reconnecting.

#### Follow-ups (not v1)

- Authorable frame sets in JSON-LD / game theme config.
- `prefers-reduced-motion`: static middle frame or CSS opacity pulse.
- Frame editor in devtools for designing custom 7×7 animations.
