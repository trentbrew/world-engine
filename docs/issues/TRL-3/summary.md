# TRL-3: Persist shadow clone toolbar state across reloads

## Context
When the browser tab is refreshed or reopened, in-memory clones currently vanish because `shadowCloneState` is reset on client boot. Users want their summoned squad and bottom clone toolbar to persist across reloads.

## Design & Architecture
1. **State Persistence**:
   - Persist clone records (`ShadowClone[]`) to `sessionStorage` / `localStorage` (or durable world state if `?durable=trellis` is active).
   - Saved metadata: clone ID, name, status, world coordinates, orientation, visual color/rig, and creation timestamp.
2. **Rehydration on Load**:
   - On play mode initialization (`session.svelte.ts` / `shadowClone.svelte.ts`), read stored clone state.
   - Re-spawn corresponding entities into `world` with matching IDs and visual components.
   - Re-populate `shadowCloneState.clones` so the bottom toolbar mounts seamlessly.
3. **Multiplayer Safety**:
   - Verify clone ownership IDs do not collide across tabs.
   - Provide an optional "Dispel All" button or purge stale records older than session expiry.

## Acceptance Criteria
- [ ] Summoned shadow clones survive browser reload (`F5` / `Cmd+R`).
- [ ] The bottom shadow clone toolbar remains visible and displays all active clones on reload.
- [ ] Rehydrated clones can be spoken to and dispelled normally after reload.
- [ ] Explicit "Dispel All" clears both world entities and stored persistence.
