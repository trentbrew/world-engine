# Authoring game worlds here — design first

Files in this directory are **games**, not config. Before writing or changing a
`.jsonld` world, design the play, then encode it:

1. **Say the sentence.** State the core loop in one line before touching JSON-LD
   ("collect the crates before the timer, but each sits over a gap"). If the
   sentence is boring, fix the sentence — polish won't rescue a dull concept.
2. **Name the risk and the reward.** Every good world is a repeatable choice under
   tension: what the player wants vs. what it might cost. No risk/reward → it's a
   diorama, not a game.
3. **Apply a game-design lens.** Before tuning anything, think feel,
   readability, fairness, tempo, and focus — and how each idea maps to this
   engine's components, behaviors, and formulas. Put per-frame juice in
   `derived` fields, not `realtime`.
4. **Before calling a world done, run a design pass** on the core loop: is the
   risk/reward legible at a glance, and does the tempo breathe?

Reference: [../../AGENTS.md](../../AGENTS.md) · [../../docs/ontology.md](../../docs/ontology.md).
