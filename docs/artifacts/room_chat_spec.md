# Spec: Room chat (multiplayer FAB)

**Status:** Ready for implementation  
**Parent:** Proposal — Room chat (TRL-81)  
**Design:** [room_chat_design.md](./room_chat_design.md) · [mockup](./room_chat_mockup.html)

---

## Goal

Ephemeral text chat for collaborators in a multiplayer room — circular FAB bottom-right, glass panel on expand, synced over existing `NetTransport`.

## Non-goals (v1)

- Trellis durable persistence / history replay on join
- Typing indicators, reactions, threads
- Play-mode-only restriction (chat works in edit and play)

## Wire protocol

Add to `NetMessage`:

```ts
{ t: 'chat'; id: string; message: { text: string; at: number; name: string } }
```

- `text`: trimmed, max 280 chars
- `at`: `Date.now()` from sender (dedupe key with `id`)
- `name`: `collab.localDisplayName()` at send time

Peers apply on receive; sender does not process own message from wire (optimistic local ingest).

## State

`roomChat.svelte.ts`:

- Ring buffer max 100 lines
- `unread` increments when panel closed and message is from remote peer
- `reset()` on session disconnect

## UI

`RoomChat.svelte` in `WorldViewport`:

- FAB 48px, `MessageCircle` icon, unread badge
- Panel 300×360 max, glass surface matching design tokens
- Composer: pill input + circular send
- `Escape` closes; focus input on open
- Stacks above `DebugConsole` (debug offset +56px bottom)

## Acceptance criteria

- [ ] `pnpm check` passes
- [ ] `PW_REUSE=1 pnpm test:e2e e2e/room-chat.spec.ts` passes
- [ ] Two-tab BroadcastChannel: message from tab A visible in tab B
- [ ] Unread badge when collapsed and remote message arrives
- [ ] Messages cleared on disconnect / reload
