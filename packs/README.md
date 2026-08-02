# Capability packs

A **capability pack** is a named, opt-in bundle of *reusable* engine primitives —
components, entity types, behaviors, formulas — motivated by a game but designed so a
*second, unrelated* game could adopt it.

Packs are the release valve that keeps the engine kernel game-agnostic. When a game
(say Craftpunk) wants something new, it lands in one of three tiers:

```
engine/ core        the kernel — knows no game exists
  ↑ promote only when a SECOND world needs it, and only if game-agnostic
packs/ <name>/       reusable, opt-in bundles — this directory
  ↑ promote from a world when a second world would reuse the primitive
static/games/<game>/ content: worlds, tuning, narrative — 100% data
```

The gate between "content" and "pack" is one question:

> **Would a second, unrelated game want this exact primitive?**
>
> Yes → pack (or, once a second consumer exists, core). No → it's data in a world.

## What's in a pack

```
packs/<name>/
  pack.json          the manifest — what this pack provides, and why it's reusable
  components.jsonld   (optional) data-only ComponentSchema / EntityType fragments,
                      authored so a world can copy or (later) import them
  README.md          (optional) longer notes
```

- **Data-first.** Prefer expressing a pack primitive as data — a `ComponentSchema`
  with `derived`/`durable` fields and formula defaults (the `components.jsonld` tier).
  Much of what feels like "new engine features" is really new *data* against the
  existing ontology. That tier ships with zero kernel changes.
- **Code-backed behaviors** (a real system in `engine/systems/behaviors/`) are a
  heavier commitment. A pack may *declare* one as `proposed`, but it only gets written
  into the engine when a real second consumer earns it. Until then the manifest holds
  the intent so the boundary is visible in the repo.

## Honest status of the mechanism

There is **no pack auto-import / composition loader yet** — worlds load as a single
`.jsonld` file. Today a pack is two real things:

1. **A named boundary.** It makes "this is a reusable primitive, not Craftpunk content"
   explicit in the repo, before the temptation to bury it in the kernel.
2. **An authoring source.** Worlds copy the pack's `components.jsonld` fragments inline
   (the ontology already supports inline `ComponentSchema` — see
   `static/games/playground.jsonld`).

Build the composition loader when a **second world** needs the same pack — not before.
That's the same discipline the packs enforce: don't abstract until a second consumer
asks. File it as a TRL when it happens.

## Manifest shape (`pack.json`)

```jsonc
{
  "id": "kebab-id",
  "title": "Human title",
  "status": "proposed | data-only | code-backed",
  "motivatedBy": "which game surfaced the need",
  "description": "one line",
  "provides": {
    "components": [
      {
        "name": "Commons",
        "status": "proposed",
        "why": "what it models",
        "reusableBy": ["a second game that'd want it", "and another"]  // enforces the gate
      }
    ],
    "types": [ /* same shape */ ],
    "behaviors": [ /* same shape; note engine path if/when code-backed */ ]
  },
  "authoringSource": "./components.jsonld"  // optional
}
```

Every `provides` entry carries `reusableBy`. If you can't name two believable, unrelated
consumers, it isn't a pack primitive — it's content. Put it back in the world.

## Packs

- **[craftpunk-society](craftpunk-society/)** — commons, cultivation, AI-neighbor, and
  reputation primitives surfaced by Craftpunk. All `proposed`; none wired into core.
- **[powder-riding](powder-riding/)** — board-carve locomotion, air-trick scoring, and
  rideable terrain surfaced by POWDER (the standing second consumer). All `proposed`;
  see [PORTING.md](powder-riding/PORTING.md) for the tier-1 substrate gaps.
