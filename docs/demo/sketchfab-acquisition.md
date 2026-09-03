# Sketchfab acquisition demo script

**Narrative:** an agent (or you) searches Sketchfab for a licensed downloadable model,
imports it into `static/models/`, confirms it in the asset catalog, and spawns it in
the world via WebMCP.

**Prereqs**

1. `SKETCHFAB_API_KEY` in root `.env` (free token: sketchfab.com → Settings → API)
2. Dev server: `pnpm dev` or `just run` — both load `.env` into the Vite process
3. WebMCP enabled (Chrome flag `#enable-webmcp-testing` or origin trial)

After pulling Sketchfab/WebMCP changes, **restart** the dev server and hard-reload
the browser tab so new tools register and `/api/sketchfab` sees the API key.

---

## Path A — CLI (fastest smoke test)

```bash
# Search only (lists UIDs — does NOT download)
pnpm import:sketchfab -- --search "low poly tree" --limit 5

# Search + import the first hit in one step
pnpm import:sketchfab -- --search "low poly tree" --import-first

# Import a specific UID
pnpm import:sketchfab -- --uid <UID> --name demo-tree
```

After import, open **Assets → Models** in the editor (or `list_assets` via WebMCP).
The new `.glb` appears immediately — no restart.

**Spawn manually:** drag the model into the viewport, or use WebMCP:

```
spawn_prop mesh=/models/demo-tree.glb position=[2,0,2]
```

Rigged models land in `/models/characters/` — use `spawn_character` instead.

---

## Path B — WebMCP agent (submission demo)

With the dev server running and WebMCP connected:

1. `search_sketchfab` query=`"park bench"` limit=`5`
2. Pick a uid from the results (note the license slug)
3. `import_sketchfab_model` uid=`<UID>`
4. `list_assets` kind=`models` search=`bench`
5. `spawn_prop` mesh=`<url from step 4>` position=`[0,0,0]`

Optional polish:

- `get_player` → spawn near the visitor
- `focus_entity` on the new prop
- `set_entity_field` for color/scale tweaks

---

## Path C — silicon-city showcase

For the hackathon world:

```bash
pnpm import:sketchfab -- --search "cyberpunk prop" --import-first --name neon-prop
```

Then in play mode or edit mode, place via inspector or WebMCP into `?game=silicon-city`.

---

## Troubleshooting

| Symptom | Fix |
| -------- | --- |
| Search works, nothing on disk | `--search` is list-only; add `--import-first` or `--uid` |
| `SKETCHFAB_API_KEY not set` | Add key to `.env`, **restart** `pnpm dev` / `just run` |
| `/api/sketchfab` returns 503 | Stale dev server started before `.env` existed — restart dev |
| WebMCP missing sketchfab tools | Hard-reload after dev restart (tools register on page load) |
| WebMCP tools say dev-only | Run `pnpm dev` locally; production has no filesystem import |
| `gltf→glb packing failed` | Needs network for `pnpm dlx @gltf-transform/cli` once |
| Rigged model is T-pose | Expected until Mesh2Motion retarget — see `docs/artifacts/m2m_character_import_spec.md` |
| CI / smoke | `pnpm test:sketchfab` (no network); `pnpm test:webmcp-surface` exercises tool error paths |

---

## What not to demo (scope)

**Mesh2Motion** is the animation retarget pipeline — show as “next step”, not a
blocker for asset acquisition. Sketchfab gets licensed meshes in; WebMCP places
them; M2M animates rigged characters later.
