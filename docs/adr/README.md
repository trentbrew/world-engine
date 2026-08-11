---
created: 2026-08-02
updated: 2026-08-02
title: Architecture Decision Records — world-engine
description: Decisions for the world-engine (museum-oss) — data-first multiplayer engine.
status: draft
---
# Architecture Decision Records — world-engine

Architecture decisions for **world-engine** (museum-oss). Numbered sequentially;
one decision per ADR. Follows the `trellis-node/docs/adr` convention.

| ADR | Title | Decision |
| --- | --- | --- |
| [0001](./0001-embedded-authoring-copilot.md) | Embedded authoring copilot | Copilot returns `DurablePatch[]`; client applies via the existing live-apply + undo + persist loop; shared tool library behind both `/api/copilot/*` routes and the world-author MCP server (**proposed**) |

## Relationship to this repo's other docs

- `docs/plans/` — proposals (roadmap-scale).
- `docs/artifacts/` — per-feature spec / design / mockup. A feature with an ADR
  still gets its implementation spec here; the ADR records *why* the shape was
  chosen.
- `docs/adr/` — decision records (this directory). Additive to the above.

## Statuses

`proposed` → `accepted` → (later) `superseded`. Update the row above and the
ADR's own Status block when a decision changes.
