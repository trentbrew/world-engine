# TRL-6: Enable autonomous multi-clone cooperation

## Context
Shadow clones should feel like intelligent shinobi peers who can work together, delegate sub-goals, and autonomously cooperate on multi-step tasks without micromanagement from the user.

## Design & Architecture
1. **Agent Coordination Protocol**:
   - Clones act as peer agents within the room conversation graph (`chatHooks.ts` / `agent-room`).
   - A task given to the squad (e.g. "Build a wall around the spawn point" or "Scout north and south") is parsed into sub-tasks and negotiated among clones:
     - Clone #1 takes Sub-task A.
     - Clone #2 takes Sub-task B.
2. **Autonomous Behaviors & Steering**:
   - Clones execute autonomous navigation (formation follow, waypoint patrolling, object interaction).
   - Clones share world observations through peer messages (e.g. "Clone #1: Found enemy prop at [12, 0, -4]").
3. **Execution Systems**:
   - Leverage engine behaviors (`systems/behaviors/`) and WebMCP tool hooks for autonomous scene edits, placement, and pathing.

## Acceptance Criteria
- [ ] Clones can communicate with each other in chat to divide a broad task into sub-tasks.
- [ ] Clones independently navigate and perform distinct roles (e.g. one follows player while another patrols).
- [ ] Task progress is reported back to the human player conversation.
- [ ] Clones adapt if a squad member is dispelled midway through a task.
