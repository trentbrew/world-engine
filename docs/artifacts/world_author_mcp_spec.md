# Spec: World Author MCP (wedge 1)

**Goal:** Let agents make fine-grained world edits without engine source access.

## Architecture

```
Agent (Cursor MCP)
  → world-author-mcp (stdio)
    → GET/POST /api/world/* (SvelteKit, dev-only mutations)
      → static/games/*.jsonld via applyDurablePatchToGraph
```

Reads use built-in registry + optional world-file schema merge. Writes reuse `DurablePatch` types from `durablePatch.ts`.

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/world` | Game catalog |
| GET | `/api/world/schema?game=` | Components + types |
| GET | `/api/world/[game]` | Entity index (`default` → `/world.jsonld`) |
| GET | `/api/world/[game]/entity?id=` | Single entity |
| POST | `/api/world/[game]/patch` | `DurablePatch` body |
| POST | `/api/world/[game]/spawn` | `{ type, position, overrides? }` |
| DELETE | `/api/world/[game]/entity?id=` | Remove entity node |

Mutations gated by `dev` — prod returns 404 until Trellis-backed API.

## MCP tools

Eight tools mirroring the API (`world_set_field` wraps `setField` patch).

## Out of scope (wedge 2+)

- Live browser apply without reload (SSE patch queue)
- Trellis durable tier as write backend in prod
- Play-mode / realtime field writes
- Auth token for shared dev servers

## Verification

`pnpm test:world-api` with dev server running.
