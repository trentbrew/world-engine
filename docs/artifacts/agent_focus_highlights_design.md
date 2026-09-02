---
version: alpha
name: Agent Focus Highlights
description: Design artifact for TRL-224 — ephemeral outline + name badge when WebMCP agents manipulate entities
source:
  tool: greenfield
  mock: docs/artifacts/agent_focus_highlights_mockup.html
colors:
  viewport: "#0e0e0e"
  viewport-grid: "#1a1a1a"
  surface: "#141414"
  surface-raised: "#1c1c1c"
  text: "#e8e8e8"
  text-muted: "#8a8a8a"
  border: "#333333"
  border-focus: "#737373"
  peer-blue: "#0f62fe"
  peer-pink: "#ee5396"
  peer-green: "#42be65"
  peer-orange: "#ff832b"
  peer-purple: "#a56eff"
  peer-teal: "#08bdba"
  agent-accent: "#a56eff"
  agent-halo: "#ffffff"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  agent-badge:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.35
  agent-badge-kind:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.06em
rounded:
  sm: 6px
  md: 10px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  badge-pad-x: 12px
  badge-pad-y: 6px
  badge-stack-y: 22px
motion:
  agent-pulse: "outline pulseSpeed 1.2 (ViewportComposer OutlineEffect)"
  badge-enter: "opacity 120ms ease-out, transform 120ms ease-out"
  badge-exit: "opacity 200ms ease-in (prefers-reduced-motion: instant)"
  focus-ttl: "3500ms default per tool call"
components:
  agent-focus-badge:
    typography: agent-badge
    padding: "{spacing.badge-pad-y} {spacing.badge-pad-x}"
    rounded: pill
    textColor: "#ffffff"
agent-display-names:
  cursor: Cursor
  chatgpt: ChatGPT
  chrome: Chrome
  agent: Agent
  headless: Architect
peer-colors:
  - "{colors.peer-blue}"
  - "{colors.peer-pink}"
  - "{colors.peer-green}"
  - "{colors.peer-orange}"
  - "{colors.peer-purple}"
  - "{colors.peer-teal}"
---

# Design: Agent Focus Highlights

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-224 (Proposal: agent focus highlights for WebMCP)  
**Mock:** [agent_focus_highlights_mockup.html](./agent_focus_highlights_mockup.html)  
**Inherits:** [peer_presence_cursors_design.md](./peer_presence_cursors_design.md) badge + palette; [appshell_ui_foundation_design.md](./appshell_ui_foundation_design.md) via `src/app.css`

---

## Overview

When an **agent** manipulates the world through WebMCP tools (`spawn_prop`, `set_entity_field`, `select_entity`, …), humans watching the viewport should see **which entity** was touched and **which agent** acted — without conflating that signal with human peer selection.

**Audience:** builder-engineers (and demo viewers) watching Playlab while ChatGPT Site tools, Cursor browser automation, or a headless MCP room agent edits the scene.

**Emotional tone:** *“the agent is working here”* — brief, legible, non-alarming. Distinct from persistent human co-editor selection but visually related (same badge family).

**Scope:** 3D viewport overlay (outline pass + screen-space badge). Edit mode primary; also visible in play when an agent mutates durable/runtime state. Flag-gated (`ui.chrome.agentFocus`, default **on**).

**Explicit non-goals (v1):** agent cursor/pointer overlay, tool-call log UI, approval gates, changing WebMCP tool output, Multiplex bridge UI.

---

## Colors

| Token | Role |
| ----- | ---- |
| `peer-*` palette (6) | Deterministic color from `agentId` via existing `peerColor()` — same function as human peers |
| `agent-accent` | Default accent when no stable id (`#a56eff`) — mock / docs only |
| `agent-halo` | White x-ray halo on emphasized agent outline (same as local/peer selection) |
| Badge fill | `color-mix(in srgb, {agentColor} 85%, transparent)` — matches `PeerSelectionLabelOverlay` |
| Badge border | `color-mix(in srgb, {agentColor} 50%, transparent)` |
| Badge text | `#ffffff` on tinted fill |

**Visual differentiation from human peer selection**

| Aspect | Human peer selection | Agent focus |
| ------ | -------------------- | ----------- |
| Duration | While peer holds selection | **Ephemeral** — TTL ~3.5s after tool completes (refresh on next touch) |
| Outline motion | Steady (`pulseSpeed: 0`) | **Pulsing** outline (`pulseSpeed: 1.2`) |
| Badge label | Display name only (`Alex`) | **Kind pill + name** — e.g. `AGENT · ChatGPT` |
| Net requirement | Requires `session.connected` + multi-peer | Local for in-browser WebMCP; **synced** for relay headless agents |

---

## Typography

| Level | Use |
| ----- | --- |
| Badge name | 12px / 600 — agent platform or configured display name |
| Badge kind | 10px mono uppercase `AGENT` — constant prefix, not the platform name |
| Inspector toggle | Existing Scene inspector label style |

Platform names use title case: **Cursor**, **ChatGPT**, **Chrome**, **Agent**, **Architect** (headless default).

---

## Layout

```
WorldViewport (relative)
├── Threlte canvas (outline passes include agent layers)
├── PeerSelectionLabelOverlay (human peers — unchanged)
└── AgentFocusLabelOverlay (new — same z-index band, z-index 2)
```

Badge anchor: reuse `badgeAnchorForEntity()` + vertical stack offset (`stack * 22px` screen, `stack * 0.18m` world) when multiple agents focus the same entity.

When **both** a human peer and an agent target the same entity, render **both** badges stacked (agent badge above peer badge — agent is the more transient signal).

---

## Elevation & Depth

Badges: frosted pill (`backdrop-filter: blur(8px)`), drop shadow `0 8px 24px rgb(0 0 0 / 0.35)` — identical depth language to peer badges.

Outline: x-ray emphasized pass (white halo + colored core) — same postprocessing stack as local/peer selection; only `pulseSpeed` differs for agent layers.

---

## Shapes

- Badge: pill radius (`var(--rounded-pill)` / 999px)
- Kind prefix: inline, separated from name by `·` (middle dot) with 6px gap
- No avatar circle v1 — platform name is sufficient at demo distance

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **Agent focus outline** | OutlineEffect halo + core on entity meshes | active (pulsing), off (toggle) | Extend `outlineLayers()` + `OutlineLayer.pulseSpeed?`; `ViewportComposer.svelte` |
| **Agent focus badge** | `[AGENT · {name}]` pill projected above entity | enter, visible, exit (TTL), offscreen hidden | New `AgentFocusLabelProjector.svelte` + `AgentFocusLabelOverlay.svelte` mirroring peer pattern |
| **Agent focus store** | `{ agentId, displayName, entityIds[], expiresAt }[]` | add/refresh on tool, prune on tick | New `agentFocus.svelte.ts` |
| **Scene toggle** | “Agent focus highlights” in Scene inspector | on (default) / off | `ui.chrome.agentFocus` in `ui.svelte.ts`, `SceneInspector.svelte` |
| **Tool wrapper** | Records entity targets after mutating WebMCP calls | per-invocation | Wrap `WEBMCP_HANDLERS` in `handlers.ts` or `execute.ts` |

### Agent display name resolution (UX contract)

| Priority | Source | Example label |
| -------- | ------ | ------------- |
| 1 | Headless `displayName` option | `Architect` |
| 2 | `displayNameForBot(clientId)` | `Brave` |
| 3 | `?agent=` URL bot registry | `Brave` |
| 4 | `agentId` platform slug | `agent:chatgpt` → **ChatGPT** |
| 5 | `VITE_AGENT_LABEL` build env | Custom |
| 6 | Fallback | **Agent** |

Platform slug map (normative for v1): `cursor`→Cursor, `chatgpt`→ChatGPT, `chrome`→Chrome, `openai`→ChatGPT.

### Entity targeting (which meshes get the outline)

| Tool pattern | Entities highlighted |
| ------------ | -------------------- |
| Input has `entityId` | That entity |
| Spawn tools (`spawn_prop`, `spawn_character`, …) | Newly created entity id |
| `select_entity` | Selected entity (same as mutate) |
| Read-only tools (`list_entities`, `get_entity_json`, …) | **None** (no badge/outline) |
| Multi-entity batch (future) | All touched ids |

---

## Interaction matrix

| Input | Precondition | Output |
| ----- | ------------ | ------ |
| WebMCP mutating tool completes | `ui.chrome.agentFocus === true` | Outline + badge on target entity(s); TTL 3.5s |
| Same agent calls another tool before TTL | Focus active | Refresh TTL; update entity set |
| Second agent touches same entity | Both focuses active | Stacked badges; two outline layers (distinct colors) |
| TTL expires | — | Badge fades out; outline layer removed |
| User toggles agent focus off | Inspector | Clear all agent focus state immediately |
| User toggles selection outline off | Inspector | Agent outlines **also** hidden (agent focus is subordinate to master outline toggle) |
| Headless agent on relay | `session.connected` | `{ t: 'agent_focus' }` broadcast; all tabs render |
| In-browser WebMCP execute | No relay | Local-only focus (human on same tab sees it) |
| Play mode + agent mutates | `agentFocus` on | Show badge/outline on affected props (not player silhouettes) |
| `prefers-reduced-motion: reduce` | — | Pulse off (`pulseSpeed: 0`); badge enter/exit instant |

---

## Accessibility

- **Focus order (edit mode, Scene inspector path):**
  1. Scene accordion triggers (Display → … → **Selection** → Developer) — existing roving order
  2. Selection → **outline** (`scene-selection-outline`) — existing control
  3. Selection → **Agent focus highlights** (`scene-agent-focus`) — new `InspectorField` immediately below outline
  4. Remaining inspector fields / viewport orbit controls — unchanged; viewport badges are **not** in tab order
- **Focus order (mock demo controls):** platform `<select>` → **Simulate spawn_prop** → **Simulate TTL expire** → Scene toggles (DOM order in right panel)
- **Labels:** Switch `aria-label="Show agent focus highlights in viewport"`. Helper copy in inspector: *"Brief outline and badge when an agent edits via WebMCP tools."*
- **Live region:** `WorldViewport` hosts `role="status"` `aria-live="polite"` `aria-atomic="true"` (sr-only / visually hidden). On each agent focus track, announce `{displayName} updated {entityId}` (debounced 500ms if same agent). Suppress when `ui.chrome.agentFocus === false`.
- **Decorative overlays:** Projected badge pills remain `aria-hidden="true"` (visual duplicate of live region text) — same pattern as `PeerSelectionLabelOverlay`.
- **Motion:** Agent outline pulse uses `pulseSpeed: 1.2`. `@media (prefers-reduced-motion: reduce)` → `pulseSpeed: 0`, badge enter/exit `transition: none`, mock `.outline-ring.agent { animation: none }`.
- **Contrast:** White `#ffffff` text on saturated agent-color fill ≥ 4.5:1 for 12px bold badge pills.
- **Color-blind safety:** Agent identity never color-only — **kind prefix + platform name** always visible on badge and spoken in live region.

---

## Do's and Don'ts

**Do**

- Reuse `peerColor(agentId)`, `badgeAnchorForEntity()`, and `PeerSelectionLabelOverlay` CSS patterns.
- Pulse agent outlines only — keeps human peer selection calm.
- Show platform name humans recognize (ChatGPT, Cursor), not opaque client ids.
- Cap concurrent agent focus entries at **8** — drop oldest on overflow.

**Don't**

- Reuse `session.peerSelections` for agents — different semantics (ephemeral vs held selection).
- Block tool execution if overlay fails to mount.
- Show focus for read-only catalog/list tools.
- Delete peer selection code paths when adding agent focus.

---

## Open for Architect

- Extend `OutlineLayer` with optional `pulseSpeed?: number` (default 0); thread into `ViewportComposer` `OutlineEffect` creation.
- New `agentFocus.svelte.ts` reactive store + `{ t: 'agent_focus' }` on `NetMessage` (or document reuse of selection with `kind: 'agent'` discriminator).
- Wrap `executeWebMcpTool` / handlers to call `agentFocus.track({ agentId, displayName, entityIds })` — resolve identity via table above; browser WebMCP defaults to `agent:chrome` unless env/url overrides.
- Entity id extraction helper shared across tools (parse input + spawn return values).
- `ui.chrome.agentFocus` persisted in scene document chrome bag alongside `selectionOutline`.
- E2e: extend `webmcp-tools.spec.ts` — after `spawn_prop`, assert `[data-agent-focus-status]` live region text or visible badge.
- A11y: mount `[data-agent-focus-status]` on `WorldViewport`; wire `agentFocus` store → debounced `textContent` updates.
- Flag-off path: when `agentFocus` false, store no-ops; existing peer selection unchanged.

---

## Handoff checklist

- [x] `docs/artifacts/agent_focus_highlights_design.md` (this file)
- [x] `docs/artifacts/agent_focus_highlights_mockup.html`
- [ ] Design issue TRL-D on graph (CLI flake — paths in parent describe)
- [ ] Architect spec child under TRL-224
