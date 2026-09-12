# TRL-5: Enable broadcast chat to talk to all shadow clones at once

## Context
When summoning a squad of shadow clones, addressing each clone individually through separate 1-on-1 proximity chat conversations is tedious. Players want an "All Clones" broadcast channel or squad chat mode to issue orders to the entire team at once.

## Design & Architecture
1. **Squad Conversation Member Set**:
   - Create a broadcast conversation context in `roomChat`:
     `members = ['local', ...shadowCloneState.clones.map(c => c.clientId)]`.
2. **UI Entry Point**:
   - "Talk to Squad" / "Broadcast to All" button on the horizontal toolbar.
   - Proximity chat panel tab or toggle: `[Squad (@all)] | [Clone #1] | [Clone #2]`.
3. **Agent Dispatch**:
   - When a human chat message is sent to the squad conversation, all active clones receive the event via `_handleHumanChat`.
   - Each clone evaluates the prompt, updates its individual status, and responds in chat (with randomized micro-staggers: 150–400ms delay to avoid identical concurrent responses).

## Acceptance Criteria
- [ ] User can initiate a broadcast chat session including all active shadow clones.
- [ ] Chat messages sent to the squad channel are received by every active clone.
- [ ] Clones update their statuses (e.g. all transition to "working" or "following") based on the broadcast command.
- [ ] Responses appear naturally in the chat window with appropriate attribution.
