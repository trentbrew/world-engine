---
version: 1
name: GameMaker-style world navigation
status: active
labels: spec, ui, shell, ia, gamemaker
related: editor_shell_refactor_spec.md, object_context_spec.md, BottomDock.svelte, LeftPanel.svelte
---

# Spec: GameMaker-style world navigation

**Goal.** Align the editor information architecture with GameMaker's authoring order:
**Assets → Objects → Rooms**. World-level affordances live in the **bottom dock**; room-level
workbench tabs live at the **top of the left pane** when editing a room.

---

## Two navigation tiers (must stay distinct)

| Tier | Location | Purpose | Examples |
| ---- | -------- | ------- | -------- |
| **World routes** | Bottom dock | Switch the entire editor context | Graph, Assets, Objects, Rooms, Chat |
| **Room pane tabs** | Left pane header (Rooms route only) | Views within the room editor | Room, Instances, Settings |
| **Instance editor** | Not in bottom dock | Isolated character stage | Enter via dblclick / `editObject()` |

**Rule:** never label a room pane tab the same as a world route (e.g. no "Assets" tab in the
left pane — Assets is a bottom-dock place).

**Scoping rule (Game tier):** bottom-dock routes are **game-global** — Assets, Objects,
Collections, and Graph span *all rooms* of the Game; only the **Rooms** route selects which
room is active. The left-pane tabs (Room / Instances / Settings) are scoped to that active
room. This is the UI face of the Game/Room two-tier data model — see
[[game_project_tier_collections_spec]]. (Today every route loads a single `.jsonld`; once the
Game tier lands, the bottom dock addresses game-global data and Rooms is the switcher.)

---

## Bottom dock layout

```
[ Graph ]     |  Assets · Objects · Rooms  |     [ Chat ]
   (left)              (center)                    (right)
```

| Control | Route | Left panel | Canvas | Right panel |
| ------- | ----- | ---------- | ------ | ----------- |
| **Graph** | `graph` | stub | stub | stub |
| **Assets** | `assets` | `AssetsPanel` | stub | stub |
| **Objects** | `objects` | `ObjectsResourcePanel` | stub | stub |
| **Rooms** | `rooms` | `LeftPanel` (pane tabs) | `WorldViewport` | `RightPanel` |
| **Chat** | — | toggles `roomChat.open` | panel above dock | — |

Future affordances (Collections, etc.) extend the center group — do not move room tabs back
into the bottom bar. **Collections** is the reserved next center-group route: a game-global
data surface (story beats, characters, magic systems) whose records are non-spatial entities
in the Game graph. See [[game_project_tier_collections_spec]]. The **Graph** route likewise
becomes the game-global record + relation (`ref`-edge) view.

---

## Left pane (Rooms route only)

Tabs at the **top** of the left panel:

| Tab | Content |
| --- | ------- |
| **Room** | World/scene picker (`SceneSelector` embedded) + `SceneInspector` |
| **Instances** | Search + `EntityList` (placed things in this room) |
| **Settings** | `SettingsPanel` (input, grid, shortcuts) |

The world picker moved **out of DocBar** — DocBar shows world title + Edit/Play + presence only.

---

## Instance editor (`railRoute === 'object'`)

Separate from bottom-dock **Objects** (object *types* / resources).

| Region | Component |
| ------ | --------- |
| Left | `ObjectClipLibrary` |
| Canvas | `ObjectStageViewport` |
| Right | `ObjectPlaybackInspector` |
| Bottom | `ObjectBehaviorDrawer` in `BottomPane` |

**Entry:** double-click animatable entity, entity list action, inspector link, `ui.editObject(id)`.
**Exit:** `ui.exitObject()` → returns to `rooms`.

---

## State (`ui.svelte.ts`)

```ts
type WorldRoute = 'rooms' | 'objects' | 'assets' | 'graph' | 'config';
type RailRoute = WorldRoute | 'object';          // + instance editor
type RoomsPaneTab = 'room' | 'instances' | 'settings';

railRoute = $state<RailRoute>('rooms');
roomsPaneTab = $state<RoomsPaneTab>('instances');
objectTarget = $state<string | null>(null);      // instance editor only
```

- `setRoute('assets' | 'objects' | 'rooms' | 'graph')` — bottom dock world nav
- `editObject(entityId)` — instance editor (sets `railRoute = 'object'`)
- `setRoomsPaneTab(tab)` — room pane tabs (Rooms route only)

---

## GameMaker mapping

| GameMaker | This engine |
| --------- | ----------- |
| Sprites / sounds / backgrounds | **Assets** route |
| Object resources + events | **Objects** route (+ instance editor for animated chars) |
| Rooms + instances | **Rooms** route; **Instances** pane tab |
| Room properties | **Room** pane tab (`SceneInspector`) |

Authoring flow: define assets → define object types/events → place instances in rooms.

---

## Chat placement

- **Edit mode:** toggle in bottom dock; panel anchored above dock (`RoomChat showFab={false}`)
- **Play mode:** FAB in viewport corner (unchanged)

---

## References

- `src/lib/ui/BottomDock.svelte`
- `src/lib/ui/LeftPanel.svelte`
- `src/lib/ui/ObjectsResourcePanel.svelte`
- `src/lib/ui/ui.svelte.ts`
- [[editor_shell_refactor_spec]] — shell grid + overlay architecture
- [[object_context_spec]] — instance editor (Phase D)
