---
version: alpha
name: WebMCP Clarify-Then-Act
description: Design artifact for TRL-228 — ask_user questionnaire before ambiguous imperative page tool calls
source:
  tool: greenfield
  mock: docs/artifacts/webmcp_clarify_then_act_mockup.html
  codebase:
    - ~/TURTLE/Projects/Extensions/WEBMCP/webmcp/src/lib/components/chat/QuestionnaireDock.svelte
    - ~/TURTLE/Projects/Extensions/WEBMCP/webmcp/src/lib/ai/config.ts
    - museum-oss/src/lib/engine/agent/webmcp/manifest.ts
colors:
  primary: "#0f62fe"
  surface: "#0f0f10"
  surface-raised: "#17171a"
  surface-overlay: "#1e1e22"
  text: "#ececef"
  text-muted: "#8b8b96"
  border: "#2a2a32"
  border-focus: "#6b6b78"
  success: "#3dd68c"
  warning: "#f5a524"
  agent-purple: "#a56eff"
  thinking-muted: "#6b6b78"
  questionnaire-accent: "#0f62fe"
typography:
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 500
  questionnaire-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  dock-gap: 12px
motion:
  dock-enter: "transform 160ms ease-out, opacity 160ms ease-out"
  dock-exit: "opacity 120ms ease-in"
  thinking-pulse: "opacity 1.4s ease-in-out infinite (reduced-motion: off)"
  status-chip: "background 200ms ease"
components:
  questionnaire-dock:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: ui
    rounded: md
    padding: "{spacing.lg}"
    width: 48rem
  questionnaire-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: questionnaire-title
    rounded: md
    padding: "{spacing.md}"
  thinking-block:
    textColor: "{colors.thinking-muted}"
    typography: mono
  composer-disabled:
    textColor: "{colors.text-muted}"
    typography: ui
    padding: "{spacing.md}"
  tool-badge:
    backgroundColor: "{colors.agent-purple}"
    textColor: "{colors.text}"
    typography: mono
    rounded: sm
    padding: "{spacing.xs}"
  composer-status:
    textColor: "{colors.warning}"
    typography: mono
---

# Design: Clarify-Then-Act (imperative WebMCP)

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-228 (Proposal: ask_user before imperative WebMCP page tools)  
**Design issue:** TRL-229  
**Mock:** [webmcp_clarify_then_act_mockup.html](./webmcp_clarify_then_act_mockup.html)  
**Inherits:** Extension TRL-14/20 (`ask_user`, `QuestionnaireCard`, validation defaults); webmcp side-panel shell tokens (Geist / dark chrome)

**Design research refs (read):**

| Artifact | Borrowed pattern |
| -------- | ---------------- |
| [editor_shell_cards_design.md](./editor_shell_cards_design.md) | Docked flush pane above composer — same “instrument panel” family as side-panel chrome; grid sibling layout discipline |
| [save_entity_type_mockup.html](./save_entity_type_mockup.html) | Modal/dock `:root` token block (`--surface`, `--border`, `--rounded-sm`); disabled primary actions pattern |
| Extension `docs/issues/TRL-14/summary.md` | `ask_user` + `awaiting-input` status seam (canonical questionnaire flow) |
| Extension `QuestionnaireDock.svelte` | Dock hosts pending questionnaire; composer region stays separate |

---

## Overview

Imperative Playlab tools (`spawn_prop`, `set_entity_field`, …) fail when the local Ollama agent **guesses** parameters or **thinks** instead of asking. v1 makes **structured clarification** the default path: call builtin `ask_user` → user confirms in **QuestionnaireDock** → agent calls the page tool with structured answers.

**Audience:** builder using the WebMCP Chrome extension against Playlab (or any page with `document.modelContext` tools).

**Emotional tone:** *“quick confirm, then act”* — not an interrogation. Infer from the user message, pre-fill defaults, 1–2 steps typical.

**Primary repo:** `~/TURTLE/Projects/Extensions/WEBMCP/webmcp`  
**Cross-link:** `museum-oss/docs/webmcp-tools.md` (clarify-then-act policy paragraph)

**Explicit non-goals (v1):** changing Playlab handlers; Multiplex bridge (TRL-221); approval gates; auto-run every write tool.

---

## Problem → principle

| Failure today | Design response |
| ------------- | --------------- |
| Long **ThinkingBlock** with no tool call | Policy: thinking ≠ substitute for `ask_user` when write params ambiguous |
| **Assumed** mesh / position → tool error / wrong spawn | Infer → `default` on questionnaire items → user confirms |
| **MAX_TOOL_ITERATIONS** (6) stall | Runtime nudge: after 2 failed write calls or missing required field → force `ask_user` suggestion in tool result |
| Prose “what mesh?” in chat | Always **`ask_user`** — dock renders structured UI |

---

## Clarify vs act decision tree

```
User message
    │
    ├─ Read-only tool (readOnlyHint) ──────────────► ACT (list_entities, describe_entity, …)
    │
    ├─ Write tool + all required params inferred with high confidence
    │       AND enums validated ───────────────────► ACT (optional single-item confirm if high impact)
    │
    ├─ Write tool + missing / ambiguous required field ► CLARIFY (ask_user, 1–4 items)
    │
    ├─ Write tool + prior call returned Error: ───► CLARIFY (ask_user on the field that failed)
    │
    └─ User said “surprise me” / explicit deferral ──► ACT with safe defaults (document in prompt)
```

**High-confidence inference (act without questionnaire):**

- User gave literal values matching schema (`box at 0,1,0` → mesh=`primitive:box`, position=`[0,1,0]`)
- Single unambiguous enum (`anchor: bottom` when only anchor was missing)
- Read tool chained immediately before write with ids taken from result (`entityId` from `list_entities`)

**Must clarify (ask_user):**

- `mesh` not stated and not `primitive:*` default for the request
- `position` absent or vague (“near the spawn”, “over there”)
- `entityId` when multiple matches or none cited
- `set_entity_field` when field name or value type unclear
- Any required param after a tool `Error:` self-correction hint

---

## Playlab reference flows

### Flow A — spawn_prop (happy clarify path)

1. User: *“Add a red box near the center”*
2. Agent: `list_assets` (read, optional) — **no questionnaire**
3. Agent: `ask_user` with items:
   - `mesh` — choices: Box / Sphere / … + default `primitive:box`
   - `position` — input `[x,y,z]` default `[0, 1, 0]` inferred “center”
   - `color` — default `#ff0000` inferred “red”
4. User submits dock → agent: `spawn_prop({ mesh, position, color })`
5. Playlab viewport updates; optional agent focus highlight (TRL-224)

### Flow B — set_entity_field (error recovery)

1. Agent calls `set_entity_field` with typo field → `Error: … did you mean position?`
2. Agent: `ask_user` single item — confirm field + value (default from error hint)
3. Retry `set_entity_field` with answers

### Flow C — act without questionnaire

1. User: *“Spawn primitive:box at 0,2,0 labeled podium”*
2. Agent: `spawn_prop` directly — all required fields explicit

---

## Session states & layout

| Status | Composer | Transcript | QuestionnaireDock |
| ------ | -------- | ---------- | ----------------- |
| `ready` | enabled | idle | hidden |
| `submitted` / `streaming` | disabled | assistant streaming | hidden |
| `awaiting-input` | **disabled** | assistant message with questionnaire part | **visible, focused** |
| `error` | enabled | error banner | hidden |

**Dock placement:** above composer, below transcript scroll region — existing `QuestionnaireDock` in `App.svelte`. Do not inline questionnaire inside message bubble for v1 (dock is canonical).

**Composer during await:** show status chip *“Waiting for your answers…”* (`ChatStatus` copy already exists). Send button disabled; stop still cancels turn.

**ThinkingBlock during await:** collapsed; if model emitted thinking before `ask_user`, do not expand automatically — questionnaire takes focus.

---

## Questionnaire content rules

| Rule | Detail |
| ---- | ------ |
| Length | 1–4 items; **1–2 typical** for Playlab spawns |
| Defaults | Always infer from user message → `default` on item |
| Choices | Use `choices` for enums (`anchor`, asset pick list truncated to top 6 + “Other…”) |
| Validation | Reuse TRL-20 zod + per-step Next blocking |
| Skip | Allow skip only on optional items (`required: false`) |
| Tool context | Optional subtitle: *“Before spawn_prop”* in questionnaire header (Architect: `prompt` prefix or `description` on first item) |

### Schema-assist (v1.5 — architect scope)

When page tool `inputSchema` exposes `enum` or `required`, extension may **suggest** questionnaire items (TRL-14 v2). Designer constraint: suggested items must be **editable** by model — never auto-submit without dock.

---

## Interaction matrix

| # | Trigger | Agent action | UI state | User action | System output | Error / recovery |
| - | ------- | ------------ | -------- | ----------- | ------------- | ---------------- |
| 1 | Ambiguous spawn (“red box near center”) | `list_assets` (optional) then `ask_user` | `awaiting-input`; dock step 1 | Pick mesh + Next | JSON `{ mesh, … }` | Cancel → abort turn; dock closes |
| 2 | Explicit spawn (“primitive:box at 0,2,0”) | `spawn_prop` directly | `streaming` → `ready` | None | `"Placed entity:prop/…"` | Tool `Error:` → row 5 |
| 3 | Read query (“what’s in the scene?”) | `list_entities` | `streaming`; no dock | None | Paginated entity list string | N/A — read-only |
| 4 | Inspect entity (“describe the orbiter”) | `describe_entity` | `streaming`; no dock | None | Component bag text | Missing id → `Error:` suggests `list_entities` |
| 5 | Write with bad field name | `set_entity_field` → error | `streaming` then `ask_user` (1 item) | Confirm field + value | Corrected write succeeds | Repeat error → row 6 |
| 6 | 2+ failed writes or iteration 6 | Loop guard fires | `error` banner + toast | Edit composer / retry | Session error message | User clears chat or new message |
| 7 | User clicks Stop during questionnaire | abort `waitForQuestionnaireAnswers` | dock hidden; `ready` | Send new message | Turn cancelled | Questionnaire marked cancelled |
| 8 | Optional questionnaire item | `ask_user` with `required: false` | dock shows Skip | Skip or answer | Partial JSON merged | Skip omits key; agent must not assume default |
| 9 | Invalid value on Next (past date) | `ask_user` (validation) | dock inline error | Fix value + Next | Step advances | Submit blocked until valid |
| 10 | Multi-step spawn (mesh then position) | single `ask_user` multi-item | dock step 2 of 2 | Submit | Full answers object | Back navigates prior step |
| 11 | “Surprise me” / deferral | `spawn_prop` with safe defaults | `streaming`; no dock | None | Spawn at default pose | Log defaults in assistant summary |
| 12 | Model asks in prose (anti-pattern) | Prompt policy: must call `ask_user` | Should not stay in prose-only | Answer in dock if shown | Structured JSON only | Runtime: nudge in tool-result if prose detected |

---

## Component anatomy

| Existing component | Role in this wedge |
| ------------------ | ------------------ |
| `QuestionnaireDock.svelte` | Host pending questionnaire; max-width 48rem centered |
| `QuestionnaireCard.svelte` | Step UI, validation, submit |
| `ChatComposer.svelte` | Disabled when `awaiting-input`; tools menu still view-only |
| `ThinkingBlock.svelte` | Collapsed by default; never blocks dock |
| `ChatEmptyState.svelte` | Suggestion chip: *“Spawn a prop — I’ll confirm mesh and position”* |
| `toOllamaTools.ts` | `ask_user` description + page tool descriptions reference clarify policy |
| `chat.svelte.ts` | `runAskUserTool`, `MAX_TOOL_ITERATIONS`, future clarify guard |

**New (architect/executor — minimal):**

- `ClarifyPolicy` helper or prompt section builder (no new visual component required for v1)
- Optional header line on dock: target tool name badge (`spawn_prop`)

---

## A11y

### Focus order (awaiting-input)

1. First focusable choice button **or** text input in `QuestionnaireCard`
2. Skip (if optional items exist)
3. Back (step &gt; 0)
4. Next / Submit
5. Composer remains **out of tab order** (`tabindex=-1` or disabled) until submit

### Motion

| Element | Default | `prefers-reduced-motion: reduce` |
| ------- | ------- | -------------------------------- |
| QuestionnaireDock enter | `{motion.dock-enter}` | opacity only, no transform |
| ThinkingBlock pulse | `{motion.thinking-pulse}` | static opacity |
| Composer status chip | `{motion.status-chip}` | instant |

| Requirement | Implementation |
| ----------- | -------------- |
| Focus | On dock open, focus first interactive choice or input |
| Trap | Focus cycles within dock until submit/cancel (composer inert) |
| Announce | `aria-live="polite"` on dock — “Questionnaire: 1 of 2 — Choose a mesh” |
| Progress | `questionnaire__progress` includes step index |
| Keyboard | Choice shortcuts A/B/C (shipped TRL-14) |

---

## Anti-patterns (document in Help + prompt)

1. **Thinking loop** — multiple reasoning chunks without `ask_user` or page tool → violation
2. **Prose clarify** — “What position did you want?” in markdown → use `ask_user`
3. **Shotgun write** — `spawn_prop` with placeholder mesh `box` when user said “something cool” → clarify first
4. **Read spam** — repeated `list_entities` without progressing → clarify or act

---

## Open for Architect

1. **Runtime guard shape:** inject synthetic tool-result after N failed writes vs hard block in `runTurn`?
2. **Prompt-only vs code policy:** minimum — extend `CHAT_SYSTEM_PROMPT` + per-category page-tool preamble; recommend lightweight `shouldClarify(toolName, args, userText)` heuristic
3. **Schema-assist scope for v1:** defer full JSON Schema → questionnaire generator; ship decision tree + Playlab spawn eval first
4. **E2e:** extend extension `e2e/` with Playlab fixture or mock page registering `spawn_prop`; assert dock appears before spawn
5. **Cross-doc:** add § to `museum-oss/docs/webmcp-tools.md` linking extension Help

---

## Design verification

- refs: `editor_shell_cards_design.md`, `save_entity_type_mockup.html`, extension TRL-14 summary (read)
- interaction matrix: **12 rows**, 0 empty cells (6 columns each)
- a11y: focus order (5 steps) + `prefers-reduced-motion` table documented
- token parity: YAML ↔ mock `:root` verified (see table below)
- design.md lint: **exit 0** (0 errors, warnings only)
- design critique: **1 round**, 0 blockers remaining

### Token parity (YAML ↔ mock `:root`)

| Token | YAML | Mock CSS var | Match |
| ----- | ---- | ------------ | ----- |
| primary / questionnaire-accent | `#0f62fe` | `--questionnaire-accent`, `--primary` | ✓ |
| surface | `#0f0f10` | `--surface` | ✓ |
| surface-raised | `#17171a` | `--surface-raised` | ✓ |
| surface-overlay | `#1e1e22` | `--surface-overlay` | ✓ |
| text | `#ececef` | `--text` | ✓ |
| text-muted | `#8b8b96` | `--text-muted` | ✓ |
| border | `#2a2a32` | `--border` | ✓ |
| border-focus | `#6b6b78` | `--border-focus` | ✓ |
| success | `#3dd68c` | `--success` | ✓ |
| warning | `#f5a524` | `--warning` | ✓ |
| agent-purple | `#a56eff` | `--agent-purple` | ✓ |
| thinking-muted | `#6b6b78` | `--thinking-muted` | ✓ |
| rounded sm/md/lg | 6/10/14px | `--rounded-sm/md/lg` | ✓ |
| spacing xs–lg | 4/8/12/16px | `--spacing-xs` … `--spacing-lg` | ✓ |

### Design critique (round 1)

| Sev | Finding | Resolution |
| --- | ------- | ---------- |
| major | Interaction matrix only 6 rows | Expanded to 12 rows — **fixed** |
| major | Token parity incomplete (`thinking-muted`, spacing missing in mock) | Mock `:root` updated — **fixed** |
| minor | Tool badge in dock header | Kept optional; architect decides |
| minor | Schema-assist v1.5 scope | Deferred to architect |
| — | Dock vs inline questionnaire | Dock canonical (TRL-14) — no change |

**Blockers remaining:** 0
