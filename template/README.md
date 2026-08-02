# Your World

A starter project for the [world-engine](https://github.com/trentbrew/world-engine) — a data-first, realtime-multiplayer 3D world engine.

```sh
pnpm install
pnpm dev            # open http://localhost:9292/?game=hello
pnpm check          # type-check
pnpm build          # build (adapter-vercel)
```

Drop a `.jsonld` world file in `static/games/` and open `?game=<name>`.

Read **AGENTS.md** to author worlds; **docs/ontology.md** is the schema reference.
