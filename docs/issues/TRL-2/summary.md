# TRL-2: Enable proximity dispel for shadow clones

## Context
Currently, shadow clones can be dispelled globally via the bottom HUD "Dispel" button. In Naruto lore and gameplay ergonomics, a shinobi should also be able to dispel a specific clone in-world when walking directly up to it.

## Design & Architecture
1. **Proximity Detection**:
   - Check distance between local player position and active clone positions each frame in `shadowClone.svelte.ts` or `playerSystem.ts`.
   - Proximity threshold: $\le 2.0\text{m}$.
2. **In-World Interaction Prompt**:
   - When close to a clone, render an interactive prompt billboard or HUD indicator:
     - Keyboard: `[E] Talk · [X] Dispel` (or hold `E` to dispel).
     - Gamepad: `[X] Talk · [Hold B / Circle] Dispel`.
3. **Execution & Feedback**:
   - Triggering dispel plays `/audio/shadowclone.wav` (or a distinctive dispersal poof).
   - Shows a notification: *"Shadow clone dispelled — Chakra returned."*
   - Immediately despawns the entity from the world and updates the clone toolbar.

## Acceptance Criteria
- [ ] Walking within 2m of a shadow clone reveals a visible prompt with a dispel action.
- [ ] Pressing the dispel input dispels that specific clone with sound and feedback.
- [ ] Dispel properly cleans up entity from `world`, `session.owners`, and `shadowCloneState.clones`.
- [ ] If currently in proximity chat with that clone, chat session terminates cleanly.
