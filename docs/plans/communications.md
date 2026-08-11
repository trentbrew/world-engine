# Plan: Communications — in-world device, spatial bubble, and identity-addressed DMs

## Context

Chat today is **room-scoped and screen-bound**: a `roomChat` store
(`src/lib/engine/collab/roomChat.svelte.ts`) rendered as a DOM panel
(`src/lib/ui/RoomChat.svelte`), carried over the room-partitioned transport as
`{ t: 'chat', message }` (`src/lib/engine/net/session.svelte.ts`). Everyone in a
room hears everything, and nobody can reach someone who isn't in the same space.

We want a **scope ladder** of three communication modes, **additive** on top of
the existing room chat (per AGENTS.md conventions — flag on, never delete):

| Mode        | Gate       | Addressable                    | Durable               |
| ----------- | ---------- | ------------------------------ | --------------------- |
| `Bubble`    | proximity  | whoever's in earshot           | no — ephemeral        |
| `Device` DM | identity   | anyone, any space (via `to`)   | ephemeral now, durable slot later |
| Room chat   | room       | everyone present               | today's `RoomChat`    |

The key architectural shift: **chat address moves from *room* to *identity*.**
A DM is addressed to a person (`clientId`), and the engine already has identity
(`collab.displayNameFor`, `peerColor`, `session.members`) plus presence (players
spawn/despawn, host broadcasts). The device is an address-book UI over presence
that already exists.

## Ontology (data-only tier — this is live in the pack)

`packs/communications/components.jsonld` defines three nodes. Because
`registerComponent` merges fields (registry.ts:53), the component schemas are
pure additive. Only the sync-flagged fields go on the wire; everything else is
derived.

| Component | Field | Type | Sync | Default | Note |
| --------- | ----- | ---- | ---- | ------- | ---- |
| **Device** | `powered` | boolean | durable | `true` | phone on/off |
|           | `screen`  | string  | realtime | `""` | active line on the phone face; owner-synced, peers render it |
| **Bubble** | `text`    | string  | realtime | `""` | line currently spoken; owner sets it, peers read it |
|           | `speaking`| boolean | derived  | `=Bubble.text != ''` | view gate — never on the wire |
|           | `since`   | number  | realtime | `0` | epoch ms when `text` was set; the overlay fades after a beat |

`type:DeviceHolder` composes `Transform + Render + Device + Bubble` for
**non-player** carriers — NPCs, kiosks, artifacts that can receive a DM or speak
spatially. World-authored entities conform via the normal `conformsTo` path.

### Attaching to code-spawned players — the `type:Player` delta

Players are code-spawned (`buildPlayer`, `spawnPlayer.ts`), not authored
entities. `registerType` **overwrites** (registry.ts:98) and `loadOntology`
registers world `type:Player` nodes *before* `session.connect()` spawns players
(loadOntology.ts:56 → session.svelte.ts:148), so a world's `type:Player`
override flows into every avatar. This is the proven `player-avatar-override.jsonld`
pattern. The pack deliberately does **not** embed a full override (wholesale
replacement would drift as engine defaults change and silently drop behaviors);
instead, a world adds a **delta** to whatever `type:Player` override it already
has:

```jsonc
{
  "@id": "type:Player",
  "@type": "EntityType",
  "components": ["Transform", "SkinnedMesh", "Mesh3DAnimator", "Player",
                 "Physics", "Jump", "Device", "Bubble"],
  "defaults": {
    "Device": { "powered": true },
    "Bubble": {}
    // ...the rest of the player defaults, unchanged
  }
}
```

Because the override is a wholesale replace, the surrounding block must keep all
existing components/defaults — copy it from
`static/games/player-avatar-override.jsonld`, don't retype it.

## Wire protocol (proposed — code-backed)

The DM path is the one place engine code is required, and it's small:

- `NetMessage` (`src/lib/engine/net/transport.ts`) gains
  `{ t: 'dm'; id: string; to: string; message: RoomChatWire }`.
- `session.sendDm(to, text)` broadcasts like `sendChat` (session.svelte.ts:196);
  receivers filter `msg.to === this.clientId` into a new per-peer `dmInbox`
  store (a sibling of `roomChat.svelte.ts`), then reflect the line onto their
  `Device.screen` realtime field so peers see it on the phone face.
- **In-room DMs need no transport change** — the transport already routes every
  peer in the room; `to` is a delivery filter.
- **Cross-space reach requires relay identity routing** — the relay is
  room-partitioned today. That is the single real future seam (Phase 3), not
  this one.

## Views (proposed — code-backed)

- **`BubbleView`** — a screen-space DOM overlay above the entity's head,
  reusing the `PeerSelectionLabelProjector.svelte` /
  `peerSelectionLabels.svelte.ts` precedent (project world position → screen
  coords, readable, no new dependency — `@threlte/extras` `Html` isn't in this
  version). Gate on `Bubble.speaking`, fade on `Bubble.since`, billboard the
  projection automatically. Register in `registerViews.ts` so `<Thing/>` picks
  it up.
- **`PhoneView`** — a small in-world mesh (canvas-texture face, no dependency)
  rendering `Device.screen`. Registered the same way.

## Identity map

| Concept | Source |
| ------- | ------ |
| device identity | `clientId` / `peerId` (session) |
| contact name | `collab.displayNameFor(clientId)` |
| avatar color | `peerColor(clientId)` |
| address book | `session.members` + `peerSelections` names |
| presence / same space | existing spawn/despawn + `goto_room` |

## Durability slot

DM log is **ephemeral** to start, matching room chat ("not persisted to
Trellis"). The durable path is `Device.inbox` (a `json` field, durable) applied
through the existing `DurablePatch` / `src/lib/engine/durable/session.svelte`
path when `?durable=trellis` covers it — the inbox is the durable tier, the
bubble is the realtime tier, and nothing in this design changes that split.

## Phases

1. **This change (data + spec).** Pack fragment + manifest + this doc. No engine
   code. Verification: JSON-LD parses; hydrating the fragment inline in a scratch
   world stays warn-and-skip clean.
2. **Code-backed** (only when a second world earns it): `dmEnvelope` in
   transport/session + `dmInbox` store; `BubbleView` + `PhoneView` in
   `registerViews`; the `type:Player` delta in a demo world
   (`static/games/communications-demo.jsonld`); e2e modeled on
   `e2e/room-chat.spec.ts` (open two tabs, bubble appears near a speaker, DM
   lands only on the addressed peer).
3. **Cross-space**: relay identity routing so DMs reach other rooms.
