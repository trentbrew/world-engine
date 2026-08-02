# Craftpunk — content, not engine

Everything in this directory is **Craftpunk content**: worlds, entities, tuning,
narrative. It is data authored against the shared engine ontology. The game is a
*consumer* of the engine, never a fork of it.

Start here: **[MANIFESTO.md](MANIFESTO.md)** — the why. Then `commons.jsonld` — the
seed world (the civic hearth everything grows around).

## The one rule that keeps Craftpunk from overfitting the engine

> When Craftpunk wants something new, ask: **would a second, unrelated game want this
> exact primitive?**

- **Yes** → it's a reusable component / behavior / formula. It belongs in a
  **capability pack** (`/packs/`), or — once a real second world needs it — in the
  engine ontology. Not here.
- **No — it's a specific rule, value, personality, or relationship** → it's data.
  It lives here, in a `.jsonld` world.

If you can't answer "yes" without inventing a fake second game, you've found overfit.
Push it down into data.

## Red flag

If building a Craftpunk world makes you want to edit `src/lib/engine/**`, stop. That
urge is the signal to check the rule above. Either it's a pack primitive (declare it
in `/packs/`, opt-in) or it's a genuine kernel gap that *every* game benefits from
(fine — but name it as such, file a TRL, and keep it game-agnostic). Craftpunk-shaped
logic never lands in core.

## Layout

```
static/games/craftpunk/
  MANIFESTO.md      the vision — read first
  README.md         this file (the content boundary)
  commons.jsonld    seed world: the civic hearth
  <world>.jsonld    additional worlds as the shared world grows
```

Worlds here load via `?game=craftpunk/<world>` (the resolver already handles the
nested path). Register a world for the scene picker by adding a row to
`src/lib/engine/games.ts`.

Design discipline for the *play* (say the sentence, name the risk/reward, run
a design pass) still applies — see [../CLAUDE.md](../CLAUDE.md).
