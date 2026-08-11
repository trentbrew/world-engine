---
created: 2026-08-02
updated: 2026-08-02
title: ADR 0001: Embedded authoring copilot
description: An LLM agent embedded in the app that reads and edits the current world by emitting DurablePatch[].
status: proposed
---
# ADR 0001: Embedded authoring copilot

> **Terminology:** **Copilot** = an LLM agent surfaced as an in-app chat panel
> that can *read* and *edit* the current world (game). **Patch** = a
> `DurablePatch` (`src/lib/engine/ontology/durablePatch.ts`) — the same JSON
> primitive human edits already serialize to.

**Status:** Proposed
**Date:** 2026-08-02
**Issue:** (proposed — embedded authoring copilot)
**Depends on:** `durablePatch.ts` · `worldFileAuthor.ts` / `worldFileStore.ts` ·
`/api/world/*` read + write endpoints · `worldSchemaApi.ts` ·
[world-author MCP spec](../artifacts/world_author_mcp_spec.md) · TRL-40 (hosted
Trellis durable writes, prod only)
**Supersedes:** nothing

## Context

The engine's core promise is that agents author games as data. Today that holds
for **file-level** authoring (`static/games/*.jsonld`, AGENTS.md) and, spec'd but
unbuilt, for external agents via a world-author MCP server. There is **no
in-app, conversational authoring surface**, and there is **zero LLM plumbing**
anywhere in the app (no provider SDK, no chat route, no key handling — the only
chat today is player↔player `roomChat`).

The good news is that the write path is already agent-shaped:

- A world edit is a `DurablePatch` — pure JSON (`durablePatch.ts:59`).
- It is applied by a pure function and persisted to the world file
  (`worldFileStore.ts:22` → `applyPatchToWorldFile`).
- The client edit loop already does **live-apply + undo + persist together**
  (`world.svelte.ts:735,807` → `editHistory` + `queueWorldFilePatch`).
- Reads are prod-safe: `GET /api/world/[game]`, `/schema?game=`, `/entity?id=`.
- Every mutation endpoint is **dev-gated** today (`devOnly.ts:5` →
  `assertWorldAuthorDev`); prod writes await TRL-40 (hosted Trellis backend).

So the copilot's *authoring infrastructure already exists*. What's missing is the
conversational layer on top of it, and a production persistence path.

## Decision

Build an **embedded authoring copilot** whose model of the world is
`DurablePatch[]`. Concretely, seven decisions:

### 1. Shape: an in-app chat panel that can read + edit the current game

The copilot is a docked chat panel (modeled on `RoomChat.svelte` chrome) bound to
the game loaded via `?game=`. It can *read* the world (schema, entity index,
entity detail, plaques/scripts/rooms) and *propose edits*. It never writes files
directly; it produces patches.

### 2. Patch-return, client-applies — the load-bearing decision

The copilot **returns `DurablePatch[]` to the client**, and the client applies
them through the **existing** edit loop: live-apply + `editHistory` undo +
`queueWorldFilePatch` persistence. This is what human edits do today.

- The server (LLM route) stays stateless w.r.t. game state — it reads the world,
  emits patches, and does not touch the world file.
- Every patch rides the same validation, undo stack, and multiplayer-safety the
  human editor gets, for free.
- The durable write backend can swap (file → Trellis op-log at TRL-40) without
  touching the copilot: `DurablePatch` is transport-agnostic.

### 3. One shared tool library; two surfaces

The function-calling surface is a **single set of tool implementations** built on
`worldFileAuthor.ts` / `worldFileStore.ts` / `worldSchemaApi.ts` and the
`/api/world/*` read endpoints:

- **Embedded copilot** — `/api/copilot/*` SvelteKit routes host the tools
  in-process.
- **External agents** — the spec'd `scripts/world-author-mcp.mjs` (world-author
  MCP, `docs/artifacts/world_author_mcp_spec.md`; SDK already installed) exposes
  the *same* tool functions over stdio for Cursor/opencode.

Do not fork implementations. The MCP server and the copilot route are two thin
adapters over one library.

### 4. Dev/local now; prod blocked on TRL-40 — record the seam

The copilot works end-to-end **today against the dev write path** (static
JSON-LD files, exactly like the human editor). A **production-embedded**
copilot (public product where end-users chat and worlds persist) is **blocked on
TRL-40** — hosted Trellis as the durable write backend. The patch format and tool
layer do not change; only the write backend behind `worldFileStore` swaps.

### 5. LLM plumbing is the one greenfield piece

- Add `@ai-sdk/openai` (provider-agnostic `ai` SDK) + a `/api/copilot/chat`
  SSE route.
- API key lives in **server-side env** (`COPILOT_API_KEY`), never shipped to the
  client.
- If exposed beyond localhost: rate limit + cost guardrail on the route.

### 6. Context grounding rides the data-first engine

A small prompt packer serializes the world for the system prompt: schema via
`worldSchemaApi`, entity index, plaques/scripts/rooms. Tools (list/read/apply)
do the rest. Cheap because the engine is data — no bespoke world introspection.

### 7. Trust: patches are previewed, undoable, validated

- The copilot returns patches to the client; the chat shows a **diff/preview**,
  and the user confirms apply — human-in-the-loop, not autonomous writes.
- Apply reuses `editHistory` undo.
- Validation via `worldSchemaApi` (unknown fields warn-and-skip) on apply, same
  as authored data.

## Consequences

- **Positive:** the whole authoring surface (undo, multiplayer safety, live
  apply, dev/prod persistence seam) transfers to the copilot at zero extra cost;
  the MCP server build is shared with the external-agent story, so it's one
  investment serving both.
- **Positive:** a working dev/local copilot is buildable immediately; it's the
  demo of "agents author as data" inside the product, not just via files.
- **Negative:** production embedding is gated on TRL-40; until then the copilot
  is a local-authoring tool, not a public product feature.
- **Negative:** LLM cost + latency on step-heavy tool loops; mitigable by the
  patch-return model (one round-trip for edits) and rate limiting.
- **Risk:** a multi-turn agent loop can wander; the human-in-the-loop apply
  (decision 7) bounds the blast radius of any individual patch sequence.

## Alternatives considered

- **Copilot writes the file directly server-side.** Rejected: bypasses undo,
  validation, and multiplayer-safe apply; duplicates the human edit loop.
- **Build the MCP server first and make the copilot a thin chat wrapper around
  it.** Rejected for v1: an in-process `/api/copilot/*` route is simpler and
  lower-latency than a stdio subprocess; the tool *library* is shared regardless.
- **Autonomous agent (tool-calls until done, no per-patch confirm).** Deferred:
  needs stronger safety + cost guardrails; patch-return with confirm is the v1
  trust model. Revisit post-TRL-40.
- **Ship no copilot until prod durable writes land.** Rejected: the dev/local
  copilot is independently valuable and de-risks the TRL-40 integration.

## Open questions (resolve before implementation spec)

1. **Turn model:** single-turn "patch suggestions" vs multi-turn tool-calling
   loop. Default: multi-turn with per-patch confirm.
2. **Provider + key provisioning:** which provider/SDK; how the key is set in
   dev vs CI vs Vercel.
3. **Panel chrome:** separate copilot dock vs shared `RoomChat` panel vs a tab.
4. **Edit/play gating:** copilot authoring should require edit mode
   (`shouldAuthorToWorldFile` already gates on `readShellModeFromUrl() !== 'play'`).
5. **Multiplayer + copilot:** multiple authors in a room editing concurrently —
   patches already go through owner/host-safe apply; confirm UX for live
   application to peers.
