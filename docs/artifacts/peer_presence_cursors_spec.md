---
version: 1
name: Peer Presence & Collaboration Chrome
parent: TRL-42
design: docs/artifacts/peer_presence_cursors_design.md
mock: docs/artifacts/peer_presence_cursors_mockup.html
status: queue-ready
---

# Spec: Peer Presence & Collaboration Chrome

**Parent:** TRL-42 (Proposal) · TRL-43 (Design)  
**Design:** [peer_presence_cursors_design.md](./peer_presence_cursors_design.md)  
**Mock:** [peer_presence_cursors_mockup.html](./peer_presence_cursors_mockup.html)  
**Human addendum (Architect):** overlapping peer avatars + Share in doc-bar upper-right; room alias indicator; optional username prompt on first load (frontend-only persistence).

---

## Summary

Ship **multiplayer collaboration awareness** in edit mode:

1. **Viewport cursors** — 2D normalized pointer overlays (design artifact).
2. **Doc-bar collaboration cluster** (upper-right) — room label, overlapping peer avatar stack, Share button.
3. **Identity** — optional username on first visit; editable anytime; broadcast to peers for cursor labels + avatars.
4. **Room alias** — human-friendly name for the active room id; frontend-only (`localStorage`).

All presence data is **ephemeral** and travels on the existing **`NetSession` / `NetTransport`** seam (Option A — no parallel `trellis/realtime` channel).

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Transport | Extend `NetMessage` with `{ t: 'presence'; … }` on existing session | One room, one pipe; M3/M4/M5 unchanged |
| Publish rate | Max **20 Hz**, same timer as `#publish` (50 ms) | Align with realtime field cadence |
| Color assignment | **Deterministic** from sorted `clientId` → 6-color palette (design tokens) | Same peer, same color everywhere |
| Display name | **`collab.username`** if set, else `Peer {last4(clientId)}` | Human addendum + design label text |
| Cursor label | `{displayName}` / `{displayName} (you)` | Design artifact |
| OFFSCREEN | `x === -1 \|\| y === -1` → hide cursor | Reference demo |
| Avatar stack location | **`DocBar` right cluster** (`doc-meta` region), z-index within doc bar | Upper-right, always visible in edit; avoids fighting floating right panel |
| Avatar v1 content | **Initials** (1–2 chars from display name) on peer-color fill, 28px circle, 2px `--border` ring, **-8px overlap** | Matches reference image stack pattern; no photo upload v1 |
| Max visible avatars | **5** faces + **`+N`** overflow chip if more peers | Prevent doc-bar overflow |
| Self in stack | **Include self** (rightmost / front of stack) | Reference image shows all active including you |
| Room display | **`alias ?? roomId`** — alias from localStorage | Human addendum |
| Room alias storage | `localStorage` key `collab:room-alias:{roomId}` | Frontend-only v1 |
| Default alias | On first join: alias defaults to **`currentGame().title`** if room resolves from `?game=`, else `roomId` | Friendly default without prompt |
| Username storage | `localStorage` key `collab:username` (global per browser) | Frontend-only v1 |
| First-load prompt | **`UsernameDialog`** if `collab:username` unset and `collab:username-prompted` unset | Optional — Skip sets prompted flag, no username |
| Re-prompt | **Never** auto re-prompt; user edits via Collaboration settings | Human addendum |
| Share button | Copy **`location.href`** (full URL incl. `?game=` `?room=` `?net=`) to clipboard + toast | Human addendum |
| Share aria | `aria-label="Copy room link to clipboard"` | a11y |
| Play mode | Hide cursors + doc-bar avatar stack (keep room id internal); **Share still available** if doc bar visible — doc bar hidden in play per AppShell | Play uses player avatars in world |
| Toggle | `ui.chrome.peerCursors` default **`true`** | Design open question resolved |
| Solo cursors | Show **self cursor** when toggle on + connected | Design recommendation |

---

## Net layer (`session.svelte.ts`, `transport.ts`)

### Types

```ts
export const PRESENCE_OFFSCREEN = -1;

export type PeerPresence = {
  x: number;       // 0..1 normalized, or PRESENCE_OFFSCREEN
  y: number;
  name: string;    // display name (username or fallback)
  color: string;   // hex from palette
};

export type NetMessage =
  | /* existing */
  | { t: 'presence'; id: string; presence: PeerPresence };
```

### Session state

```ts
/** Latest presence per remote client (excludes self). */
peerPresence = $state<Record<string, PeerPresence>>({});

/** Sorted members with presence for UI (includes self). */
// Derived in UI or getter on session
```

### Wire protocol

| Event | Behavior |
| ----- | -------- |
| Local `pointermove` on viewport-wrap | Throttle; clamp x,y ∈ [0,1]; `#sendPresence()` |
| Local `pointerleave` | Send `{ x: -1, y: -1, name, color }` |
| Receive `presence` | Ignore if `id === clientId`; else `peerPresence[id] = presence` |
| `#forget(id)` | `delete peerPresence[id]` |
| `join` / `hello` | Optionally re-broadcast presence so newcomers see cursors immediately |

**Name/color on wire:** publisher sends own `name` (from collab store) and `color` (computed locally — peers may ignore incoming color and recompute from id for consistency; spec: **recompute color from `id` on receive**, accept `name` from wire).

### Color helper

```ts
const PEER_COLORS = ['#0f62fe', '#ee5396', '#42be65', '#ff832b', '#a56eff', '#08bdba'];

function peerColor(clientId: string): string {
  let h = 0;
  for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
}
```

---

## Collab store (`collab.svelte.ts` — new)

Frontend-only identity + room metadata. No Trellis/durable writes.

```ts
export type CollabState = {
  username: string;           // '' if unset
  roomId: string;             // set on session.connect
  roomAlias: string;          // display alias
  usernamePromptOpen: boolean;

  displayName(clientId?: string): string;
  setUsername(value: string): void;
  setRoomAlias(value: string): void;
  initRoom(roomId: string, defaultAlias: string): void;
  maybeOpenUsernamePrompt(): void;
  dismissUsernamePrompt(skipped: boolean): void;
};
```

### localStorage keys

| Key | Value |
| --- | ----- |
| `collab:username` | string |
| `collab:username-prompted` | `'1'` after first dialog (skip or save) |
| `collab:room-alias:{roomId}` | string |

### Username dialog

- **Component:** `UsernameDialog.svelte` — shadcn Dialog (match `AddEntityDialog` pattern).
- **Fields:** text input (max 32 chars, trim), placeholder "Your name (optional)".
- **Actions:** **Save** (persist + close), **Skip** (set prompted, close).
- **Mount:** `WorldShell.onMount` after world load starts — `collab.maybeOpenUsernamePrompt()`.
- **Edit later:** Scene Inspector → Collaboration → Username input + Save.

---

## UI components

| Component | Path | Responsibility |
| --------- | ---- | -------------- |
| `PeerPresenceLayer` | `src/lib/ui/PeerPresenceLayer.svelte` | Cursor overlay; listens on `viewport-wrap` |
| `PeerCursor` | `src/lib/ui/PeerCursor.svelte` | SVG pointer + label pill |
| `PeerAvatarStack` | `src/lib/ui/PeerAvatarStack.svelte` | Overlapping initials circles |
| `RoomPresenceBar` | `src/lib/ui/RoomPresenceBar.svelte` | Room label + avatar stack + Share — **mounted in DocBar** |
| `UsernameDialog` | `src/lib/ui/UsernameDialog.svelte` | First-load optional username |
| `collab.svelte.ts` | `src/lib/engine/collab/collab.svelte.ts` | Identity + room alias persistence |

### DocBar layout (extend `DocBar.svelte`)

```
[ tabs ……………………………… ] [ RoomPresenceBar ] [ score? ]
```

`RoomPresenceBar` anatomy:

```
┌─────────────────────────────────────────────┐
│  Studio Session  ·  (○○○)  [Share]          │
│  ^room alias      ^stack                     │
└─────────────────────────────────────────────┘
```

- **Room label:** `{roomAlias}` with muted `· {roomId}` tooltip on hover (full id + net mode).
- **Avatar stack:** members sorted by `clientId`; self last (front); 28px circles, overlap `-8px`.
- **Share:** icon button (Lucide `Share` or `Link`); `navigator.clipboard.writeText(location.href)`; `toast.success('Link copied')`.

### Scene Inspector — Collaboration section

| Control | Binding |
| ------- | ------- |
| Show peer cursors | `ui.chrome.peerCursors` |
| Username | input → `collab.setUsername` |
| Room alias | input → `collab.setRoomAlias` |
| Hint (solo) | "Open another tab on the same room…" when `peerCount === 1` |

### `ui.svelte.ts`

```ts
export type ChromeToggles = {
  grid: boolean;
  selectionOutline: boolean;
  statsHud: boolean;
  peerCursors: boolean;  // default true
};
```

Include `peerCursors` in play-mode snapshot restore.

### `WorldViewport.svelte`

- Mount `PeerPresenceLayer` when `ui.shellMode === 'edit' && session.connected && ui.chrome.peerCursors`.
- Attach `pointermove` / `pointerleave` on `.viewport-wrap`.

---

## Room resolution (unchanged wire, clarified display)

```ts
const room = params.get('room') ?? game ?? 'lobby';
```

**Default alias on `initRoom`:**

```ts
const defaultAlias = currentGame().title; // when game param matches; else roomId
collab.initRoom(room, defaultAlias);
```

User-edited alias persists per `roomId` only — switching `?game=` loads that game's default unless alias already stored.

---

## Acceptance criteria (testable)

### Build

- [ ] `pnpm check` passes with zero errors.

### Net / session

- [ ] `NetMessage` includes `presence` variant; `session` publishes throttled presence on pointer move.
- [ ] `pointerleave` sends OFFSCREEN; peer cursor removed from overlay.
- [ ] Peer disconnect clears `peerPresence[id]` within `PEER_TIMEOUT_MS`.
- [ ] Presence works on BroadcastChannel (two tabs, same `?room=`).

### Viewport cursors

- [ ] Edit mode: peer cursors render at normalized positions; self labeled `(you)`.
- [ ] Play mode: cursor layer not rendered.
- [ ] Toggle off in Scene Inspector hides cursors and stops publish.
- [ ] `prefers-reduced-motion`: remote cursors have no CSS transition.

### Doc-bar collaboration

- [ ] DocBar upper-right shows room alias, avatar stack (self + peers), Share button.
- [ ] Avatar stack uses initials + peer color; max 5 + overflow `+N`.
- [ ] Share copies current URL and shows toast.

### Identity & room (frontend)

- [ ] First visit (no `collab:username-prompted`): UsernameDialog appears; Skip and Save both dismiss without blocking world load.
- [ ] Username editable in Scene Inspector Collaboration section; cursor labels + avatars update after save.
- [ ] Room alias editable in Collaboration section; DocBar label updates; persisted in localStorage per roomId.

### Regression

- [ ] Game state sync (`state` / `spawn` / ownership) unchanged — smoke two-tab entity move still works.

---

## File touch list (Executor)

| Action | Path |
| ------ | ---- |
| Extend | `src/lib/engine/net/transport.ts` |
| Extend | `src/lib/engine/net/session.svelte.ts` |
| New | `src/lib/engine/collab/collab.svelte.ts` |
| New | `src/lib/engine/collab/peerColor.ts` |
| New | `src/lib/ui/PeerPresenceLayer.svelte` |
| New | `src/lib/ui/PeerCursor.svelte` |
| New | `src/lib/ui/PeerAvatarStack.svelte` |
| New | `src/lib/ui/RoomPresenceBar.svelte` |
| New | `src/lib/ui/UsernameDialog.svelte` |
| Extend | `src/lib/ui/DocBar.svelte` |
| Extend | `src/lib/scene/WorldViewport.svelte` |
| Extend | `src/lib/ui/SceneInspector.svelte` |
| Extend | `src/lib/ui/ui.svelte.ts` |
| Extend | `src/lib/ui/WorldShell.svelte` |

---

## Non-goals (v1)

- Photo avatar upload / Gravatar
- Trellis or durable persistence for username/alias
- Room creation UI beyond URL params
- 3D world-space cursors
- PartyKit cross-machine QA required for merge (nice-to-have manual test)

---

## Open for Executor (non-blocking)

- Toast import path — use existing `toast.svelte`.
- Exact Lucide icon for Share (`Link2` vs `Share2`).
- Minor doc-bar responsive truncation: truncate alias with ellipsis on narrow widths.

---

## Handoff checklist

- [x] Spec artifact at `docs/artifacts/peer_presence_cursors_spec.md`
- [ ] Trellis spec issue TRL-44 created with AC mirroring sections above
- [ ] Impl child TRL-45 queued for Executor
