# TRL-4: Make shadow clone bottom toolbar horizontal

## Context
The current shadow clone HUD (`ShadowCloneHud.svelte`) renders active clone cards in a vertical stack in the bottom-left/center area. As multiple clones are spawned (e.g. $\times 3$ to $\times 12$ from Ram multiplier), a vertical stack crowds viewport height.

## Design & Architecture
1. **Docked Horizontal Strip**:
   - Align clone entries horizontally in a docked dock/strip across the bottom of the screen (`display: flex; flex-direction: row; gap: 8px; overflow-x: auto;`).
   - Compact chips featuring:
     - Avatar icon / color indicator
     - Clone # and status badge ("Idle", "Working", "Following")
     - Quick action buttons (Talk, Possess, Dispel)
2. **Minimalist Responsive Design**:
   - Matches the dark glassmorphic styling of the Hand Signs overlay (`rgba(15, 23, 42, 0.85)` + subtle border).
   - "Dispel All" button pinned to the right edge.
   - Smooth horizontal scrolling or wrap for squads of up to 12 clones.

## Acceptance Criteria
- [ ] Clone entries layout in a horizontal row at the bottom center of the screen.
- [ ] Supports clean rendering for 1 to 12 clones without vertical screen clutter.
- [ ] Individual clone actions (Talk, Dispel) remain intuitive and accessible.
- [ ] Maintains cohesive aesthetic with Hand Signs overlay and chat HUD.
