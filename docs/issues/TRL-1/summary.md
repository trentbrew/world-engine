# TRL-1: Enable taking control of a shadow clone

## Context
When shadow clones are summoned (`Kage Bunshin no Jutsu`), they exist as separate `Player` entities in the world with identical visual rigs and autonomous status. This feature enables the player to "possess" or switch direct keyboard/gamepad locomotion and camera control into any chosen active shadow clone.

## Design & Architecture
1. **Controller Handoff**:
   - `world.localPlayerId` swaps from the current avatar (`entity:player/local`) to the selected clone (`entity:player/clone_N`).
   - The previously controlled body is retained as an active avatar entity and transitioned into autonomous/idle status.
2. **Camera Target Transition**:
   - Camera follow target smoothly shifts from the previous avatar to the new controlled entity.
3. **UI Entry Point**:
   - "Possess" / "Take Control" button on the clone's HUD card.
   - Gamepad shortcut or proximity radial option to cycle control across active clones (e.g. D-pad left/right or `Tab` key).
4. **Ownership**:
   - The local client retains engine ownership (`session.owners`) of both the original avatar and all clones, ensuring zero desync over multiplayer relay.

## Acceptance Criteria
- [ ] User can click "Take Control" (or press hotkey) on any active shadow clone card to switch active input focus to that clone.
- [ ] Camera smoothly re-centers on the newly possessed clone.
- [ ] Locomotion, jumping, and hand-sign weaving function identically from the clone's body.
- [ ] The previous avatar remains standing in the world and appears in the clone HUD as available to re-possess.
- [ ] Dispelling the currently possessed clone safely snaps control back to the original player body.
