# TRL-224 — Spec: agent focus highlights for WebMCP

Parent: [[issue:TRL-224]] (proposal) · [[issue:TRL-217]] (WebMCP epic)

**Design:** [agent_focus_highlights_design.md](../../artifacts/agent_focus_highlights_design.md)  
**Mock:** [agent_focus_highlights_mockup.html](../../artifacts/agent_focus_highlights_mockup.html)

## Problem

WebMCP tool calls mutate the world invisibly — humans cannot see which agent touched which entity. Peer edit mode already renders selection outlines + name badges for human collaborators; agents need an **ephemeral** variant with platform identity (ChatGPT, Cursor, Chrome, headless Architect, …).

## Summary

Add an **agent focus** pipeline:

1. **Track** entity targets after mutating WebMCP tool calls (skip `readOnlyHint: true` tools).
2. **Render** pulsing outline + `AGENT · {name}` badge (reuse peer badge stack).
3. **Sync** focus events over the existing net session for relay/headless agents.
4. **Gate** behind `ui.chrome.agentFocus` (default on; subordinate to `selectionOutline`).
5. **Announce** focus changes via sr-only live region for screen readers.

## Architecture

See [visuals/agent-focus-flow.mmd](./visuals/agent-focus-flow.mmd).

### 1. Agent focus store (`src/lib/engine/agent/agentFocus.svelte.ts`)

```ts
export type AgentFocusEntry = {
  agentId: string;
  displayName: string;
  entityIds: string[];
  expiresAt: number;
};

export const AGENT_FOCUS_TTL_MS = 3500;
export const AGENT_FOCUS_MAX_ENTRIES = 8;

/** Record or refresh focus for an agent. No-op when ui.chrome.agentFocus is false. */
export function trackAgentFocus(opts: {
  agentId: string;
  displayName: string;
  entityIds: string[];
}): void;

/** Prune expired entries — call from useTask or session tick (~250ms). */
export function pruneAgentFocus(now?: number): void;

/** Active entries for outline/badge layers. */
export function activeAgentFocus(): AgentFocusEntry[];

/** Clear all entries (toggle off). */
export function clearAgentFocus(): void;
```

- Color: `peerColor(agentId)` (existing palette).
- Live region text: debounce 500ms per agentId — `{displayName} updated {entityId}`.
- Store updates `lastAnnouncement` for `[data-agent-focus-status]` binding.

### 2. Agent identity (`src/lib/engine/agent/agentIdentity.ts`)

Resolution order (first match wins):

| Priority | Source | Example |
| -------- | ------ | ------- |
| 1 | Explicit `displayName` in execute context (headless) | Architect |
| 2 | `displayNameForBot(clientId)` | Brave |
| 3 | `resolveActiveBot()` / `?agent=` | Brave |
| 4 | Platform slug from `agentId` | `agent:chatgpt` → ChatGPT |
| 5 | `import.meta.env.VITE_AGENT_LABEL` | Custom |
| 6 | Fallback | Agent |

Platform slug map (v1): `cursor`→Cursor, `chatgpt`→ChatGPT, `chrome`→Chrome, `openai`→ChatGPT.

Browser in-page WebMCP default context:

```ts
{ agentId: import.meta.env.VITE_AGENT_ID ?? 'agent:chrome', displayName: resolveAgentDisplayName(...) }
```

Headless (`headlessRoom.ts` / `mcpServer.ts`) passes `{ agentId: room.clientId, displayName: room.displayName ?? resolve… }`.

### 3. Tool wrapper (`src/lib/engine/agent/webmcp/focusWrap.ts`)

Single seam wrapping handler execution:

```ts
export async function executeWithAgentFocus(
  name: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; agent?: { agentId: string; displayName?: string } },
  handler: ToolExecute
): Promise<unknown>;
```

Behavior:

- Look up tool manifest entry; **skip** when `annotations.readOnlyHint === true`.
- Run handler; on success (non-`Error:` prefix string for write tools):
  - Extract entity ids via `extractFocusEntityIds(name, input, result)`.
  - If non-empty → `trackAgentFocus` + optional net broadcast.
- Never throw/block on focus failures.

**Entity extraction rules:**

| Pattern | ids |
| ------- | --- |
| `input.entityId` string | `[entityId]` |
| Spawn tools (`spawn_prop`, `spawn_character`, …) | Parse first `entity:…` token from result string |
| `select_entity` | selected id (including clear → no focus) |
| Tools with no entity | `[]` |

Wire into:

- `executeWebMcpTool()` — accepts optional agent context (defaults browser context in DOM).
- `registerWebMcpTools()` — wrap registered `execute` callbacks.
- Headless MCP stdio — pass headless client id/name.

### 4. Outline pass

**`outlineLayers.ts`**

- Extend `OutlineLayer`:

```ts
pulseSpeed?: number; // default 0
```

- Add `agentFocusLayers()` appended when:
  - `ui.chrome.agentFocus && ui.chrome.selectionOutline` (edit), **or**
  - `ui.chrome.agentFocus && ui.shellMode === 'play'` (agent mutated prop — not player silhouettes).
- Each active entry → layer `{ id: 'agent:${agentId}', color: peerColor(agentId), entityIds, emphasized: true, pulseSpeed: reducedMotion ? 0 : 1.2 }`.

**`outlineStateKey.ts`** — include `pulseSpeed` in layer key.

**`ViewportComposer.svelte`**

- Extend `PassSpec` with `pulseSpeed?: number`.
- Set `effect.pulseSpeed` in `createOutlineEffect` / `applyPassSpec` (postprocessing `OutlineEffect` supports this — already in defaults as `0`).

### 5. Badge overlay

Mirror peer selection pattern:

| New file | Role |
| -------- | ---- |
| `src/lib/engine/render/agentFocusLabels.svelte.ts` | Projected badge state store |
| `src/lib/scene/AgentFocusLabelProjector.svelte` | Threlte useTask projector (mount alongside `PeerSelectionLabelProjector`) |
| `src/lib/ui/AgentFocusLabelOverlay.svelte` | DOM pills — label format `AGENT · {displayName}` with kind span |

Stack agent badges **above** peer badges on same entity (`stack * 22px` / `stack * 0.18m`).

CSS: copy `PeerSelectionLabelOverlay` pill styles; add `.agent-badge-kind` mono uppercase.

### 6. Net sync

**`transport.ts`**

```ts
export type AgentFocusWire = {
  agentId: string;
  displayName: string;
  entityIds: string[];
  expiresAt: number;
};

// NetMessage union:
| { t: 'agent_focus'; id: string; focus: AgentFocusWire }
```

**`session.svelte.ts`**

- `#sendAgentFocus(focus)` when local `trackAgentFocus` runs and `connected`.
- `#applyAgentFocus(senderId, focus)` merges into store (ignore self-echo).
- Do **not** reuse `{ t: 'selection' }` — different TTL semantics.

**`headlessSession.ts`**

- Export `#sendAgentFocus` or call transport directly after headless tool mutations (same wire shape).

### 7. Chrome toggle + persistence

**`ui.svelte.ts`**

```ts
export type ChromeToggles = {
  // …existing
  agentFocus: boolean;
};
// default: agentFocus: true
```

**`sceneDocument.ts`** — serialize/deserialize `chrome.agentFocus` (default true when missing).

**`SceneInspector.svelte`** — Selection accordion, below outline:

```svelte
<InspectorField
  id="scene-agent-focus"
  label="Agent focus highlights"
  kind="select"
  …
/>
```

Helper via `inspectorFieldHelp` entry `scene-agent-focus`.

### 8. Viewport a11y

**`WorldViewport.svelte`**

```svelte
<div
  class="sr-only"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  data-agent-focus-status
>
  {agentFocus.lastAnnouncement}
</div>
<AgentFocusLabelOverlay />
```

Mount `AgentFocusLabelProjector` inside `WorldScene.svelte` next to `PeerSelectionLabelProjector`.

### 9. Files touched

| File | Change |
| ---- | ------ |
| `src/lib/engine/agent/agentFocus.svelte.ts` | **new** store |
| `src/lib/engine/agent/agentIdentity.ts` | **new** display name resolver |
| `src/lib/engine/agent/webmcp/focusWrap.ts` | **new** wrapper + entity extraction |
| `src/lib/engine/agent/webmcp/execute.ts` | call wrapper |
| `src/lib/engine/agent/webmcp/register.ts` | browser agent context |
| `src/lib/engine/agent/mcpServer.ts` | headless agent context |
| `src/lib/engine/render/outlineLayers.ts` | agent layers + pulseSpeed |
| `src/lib/engine/render/outlineStateKey.ts` | pulse in key |
| `src/lib/scene/ViewportComposer.svelte` | pulseSpeed on OutlineEffect |
| `src/lib/engine/net/transport.ts` | AgentFocusWire message |
| `src/lib/engine/net/session.svelte.ts` | send/apply agent_focus |
| `src/lib/engine/net/headlessSession.ts` | broadcast agent_focus |
| `src/lib/engine/render/agentFocusLabels.svelte.ts` | **new** |
| `src/lib/scene/AgentFocusLabelProjector.svelte` | **new** |
| `src/lib/ui/AgentFocusLabelOverlay.svelte` | **new** |
| `src/lib/scene/WorldScene.svelte` | mount projector |
| `src/lib/scene/WorldViewport.svelte` | overlay + live region |
| `src/lib/ui/ui.svelte.ts` | chrome.agentFocus |
| `src/lib/ui/SceneInspector.svelte` | toggle |
| `src/lib/ui/inspectorFieldHelp.ts` | help string |
| `src/lib/engine/scene/sceneDocument.ts` | persist toggle |
| `e2e/webmcp-tools.spec.ts` | focus assertion after spawn_prop |

### 10. Non-goals (v1)

- Agent cursor overlay
- Multiplex bridge changes (TRL-221)
- Tool output format changes
- Reusing `session.peerSelections` for agents

## Acceptance criteria

```
test:pnpm check
test:pnpm test:e2e e2e/webmcp-tools.spec.ts
Mutating WebMCP call (spawn_prop) sets data-agent-focus-status live region within 500ms
Agent focus outline visible when ui.chrome.agentFocus true; cleared when toggle off
Agent badge shows AGENT · prefix + resolved display name (browser default Chrome or VITE_AGENT_LABEL)
readOnlyHint tools (list_entities) do not set agent focus
Relay: headless agent_focus wire updates peer browser store (manual or unit seam test acceptable if e2e relay deferred)
prefers-reduced-motion: agent outline pulseSpeed 0 (matchMedia guard)
ui.chrome.agentFocus persisted in scene document; defaults true
Peer selection paths unchanged when agentFocus false
```

## Executor notes

- Flag-off: `trackAgentFocus` early-returns; do not delete peer selection code.
- Cap entries at 8 — drop oldest.
- `selectionOutline: false` hides agent outlines too (design subordination rule).
- Prefer wrapping at `executeWebMcpTool` over editing every handler body.
- E2e: after `spawn_prop`, poll `[data-agent-focus-status]` for `/updated entity:/` or badge text containing `AGENT`.

## Verification (architect)

```bash
trellis issue check TRL-225
```
