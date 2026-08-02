---
version: 1
name: Vercel Demo Deploy
parent: strategist-decision (ship-ready demo)
status: queue-ready
---

# Spec: Vercel Demo Deploy

**Context:** Authoring shell + static JSON-LD worlds are client-side. User is ready to ship a public demo. Full local stack (`just run` = Vite + PartyKit + Trellis) is **not** one Vercel deployment.

---

## Summary

Deploy the SvelteKit app to **Vercel** as a **static-world demo**: load `static/games/*.jsonld`, edit/play in browser, multi-tab multiplayer via BroadcastChannel. Optional PartyKit host via build-time env. **Durable Trellis tier stays dev-only** until TRL-40 + hosted Trellis (document clearly).

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Adapter | **`@sveltejs/adapter-vercel`** (replace `adapter-auto`) | Explicit Vercel target; Node runtime for `/api/assets` |
| `/api/assets` runtime | **Node.js** (default serverless) | Uses `node:fs` — not Edge-compatible |
| Durable in prod | **Not in v1 deploy** | No Trellis on Vercel; `?durable=trellis` needs external host + proxy (TRL-40/41) |
| PartyKit | **Optional second deploy** | `pnpm deploy:party`; `VITE_PARTYKIT_HOST` at build time |
| Default MP on demo | **BroadcastChannel** | Zero backend; two tabs same browser |
| Build command | `pnpm build` | Existing; verify on Vercel |
| Install | `pnpm install` | Lockfile committed |
| Node version | **20.x** | Match local; set in `package.json` engines or Vercel project setting |

---

## Scope

### In scope

1. Switch to `adapter-vercel`
2. `vercel.json` minimal (if needed for Node route config)
3. `README.md` + `AGENTS.md` **Deploy** section: what works on Vercel vs local
4. Env var docs: `VITE_PARTYKIT_HOST` (optional)
5. Smoke: production build loads `?game=orbit`, editor shell visible, play mode works

### Out of scope

- Hosted Trellis / durable tier on Vercel
- PartyKit deploy automation in CI (document manual `pnpm deploy:party` only)
- Custom domain, analytics, preview env secrets
- E2E against live Vercel URL

---

## Component / file map

| File | Action |
| ---- | ------ |
| `package.json` | Add `@sveltejs/adapter-vercel` devDep; optional `"engines": { "node": ">=20" }` |
| `svelte.config.js` | `import adapter from '@sveltejs/adapter-vercel'` |
| `vercel.json` | Optional: `{ "buildCommand": "pnpm build" }` — only if defaults fail |
| `src/routes/api/assets/+server.ts` | No change; confirm Node runtime (adapter-vercel default) |
| `README.md` | Add **Deploy to Vercel** section |
| `AGENTS.md` | Note prod URL params; durable requires local/external Trellis |

---

## Production behavior matrix

| Feature | Vercel demo | Local `just run` |
| ------- | ----------- | ---------------- |
| Load `?game=` worlds | ✅ static assets | ✅ |
| Edit mode / play mode | ✅ | ✅ |
| Multi-tab MP | ✅ BroadcastChannel | ✅ |
| Cross-machine MP | ⚠️ needs PartyKit deploy + `VITE_PARTYKIT_HOST` | ✅ `?net=partykit` |
| `?durable=trellis` | ❌ no Trellis server | ✅ `:8230` + Vite proxy |
| Assets panel API | ✅ `/api/assets` | ✅ |

---

## Env vars (Vercel project settings)

| Var | Required | Purpose |
| --- | -------- | ------- |
| `VITE_PARTYKIT_HOST` | No | Hostname for PartyKit (e.g. `threlte-world.username.partykit.dev`) when using `?net=partykit` |

No secrets required for static demo.

---

## Deploy steps (manual AC)

1. Connect Git repo to Vercel
2. Framework preset: **SvelteKit**
3. Build: `pnpm build` · Output: adapter default · Install: `pnpm install`
4. Deploy → open `https://<project>.vercel.app/?game=orbit`
5. Confirm: doc bar, tool pill, left/right panels, play toggle
6. Open second tab same URL → both tabs see session (BroadcastChannel)

---

## Acceptance criteria (issue)

1. `pnpm check` passes
2. `pnpm build` succeeds with `adapter-vercel`
3. `README.md` documents Vercel deploy + capability matrix above
4. No runtime import of Trellis server in static path (existing dynamic import preserved)
5. `/api/assets` returns JSON on production build (`vite preview` smoke)

---

## Test plan

```bash
pnpm check
pnpm build
pnpm preview   # → ?game=orbit
curl -s localhost:4173/api/assets | head   # assets JSON
```

---

## Follow-ups (separate issues)

- TRL-40: durable push + per-field EAV (blocked trellis-node)
- TRL-41: trellis-node CORS header
- Hosted Trellis + Vercel rewrite proxy for `?durable=trellis` in prod
