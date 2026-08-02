# Craftpunk

*A shared world where humans, AI, and nature keep house together — and a working
model of the sovereign society it depicts.*

---

## The sentence

**Craftpunk is a persistent, co-authored world you don't win — you tend.** Its one
recurring choice: *spend your attention on yourself, or on the commons.* Everything
in the world is legible, forkable data; nobody owns the ground; and the future it
shows is optimistic not because conflict is gone, but because coexistence is a craft
people practice on purpose.

If that sentence stops being true, the game has drifted. Come back here.

---

## What it is

Not a utopia diorama. Not a dystopia to escape. Craftpunk is a **meditation on
designing a sovereign society** — rendered as a place you can stand in, change, and
hand to someone else. It takes the thesis behind Trellis / TurtleOS —
*local-first, data-as-truth, no central owner* — and asks the obvious next question:
**if a society were built the way we build the software, what would it feel like to
live there?**

Three constituencies share the world, and none is subordinate:

- **Humans** bring intention, taste, and the willingness to care about things that
  don't scale.
- **AI** brings tending at scale — memory, patience, the upkeep humans forget — as
  *citizens and stewards*, never as tools or as threat.
- **Nature** brings the clock nobody set and the limits nobody voted for. It is a
  party to the world, not scenery. It can be neglected, and it answers.

Harmony here is **not stasis**. It's the ongoing, visible negotiation between those
three. A world in perfect balance with nothing at stake is a screensaver. Craftpunk's
optimism is that the negotiation is *winnable, repeatedly, together* — not that it's
already over.

---

## Convictions

1. **The medium is the message.** Craftpunk is authored as data against a shared
   ontology, syncs local-first, and belongs to no server. That is not an
   implementation detail — it *is* the political claim the game makes. A sovereign
   society is one where the state is legible to its members and owned by none of them.
   We prove it by building the game that way. Fork the world and it's still the world.

2. **Sovereignty is legibility plus exit.** You can see how everything works, and you
   can leave with your piece intact. No black boxes, no lock-in — in the fiction *or*
   the file format. Every rule is inspectable; every world is forkable.

3. **Tending over conquest.** The verbs are grow, repair, host, compost, invite,
   witness — not extract, defeat, capture, grind. Reward should flow from making the
   commons more alive, and the tension should come from the fact that your attention
   is finite and the commons is not the only thing asking for it.

4. **AI as neighbor.** Craftpunk's AI citizens have standing, memory, and their own
   upkeep. The interesting drama is *cohabitation* — trust, delegation, disagreement,
   repair — not alignment-as-obedience and not robots-rise. If an AI character is only
   ever a vending machine or a villain, we've failed the premise.

5. **Nature keeps its own time.** Some loops are seasonal, slow, or irreversible.
   The world should have rhythms the player doesn't control and can only learn to
   move *with*. Limits are a design feature, not a difficulty setting.

6. **Optimism with stakes.** We refuse both grimdark and frictionless. Things can
   decay, be neglected, be lost — that's what makes tending them mean something. The
   claim isn't "nothing goes wrong"; it's "when it does, we have the tools and each
   other to set it right."

7. **Craftpunk, the posture.** Handmade over generated-slop, legible over slick,
   warm over cold-futurist. The aesthetic of a future that kept the craft: visible
   seams, honest materials, tools you can open. High-tech and hand-tended at once.

8. **A commons, genuinely shared.** It's multiplayer and persistent because
   sovereignty is a *group* project. What one person tends, another inherits. The
   world remembers. Presence should feel like arriving somewhere that was lived in
   before you got there.

---

## What you actually do (open — this is where we rally)

The convictions are settled enough to build against. The **core loop is not**, and I'd
rather find it with you than pin it prematurely. Candidate loops, each a different bet:

- **The Steward's loop.** Attention is the scarce resource. Each session you have
  finite care to spend; the commons, your own plot, and your AI neighbors all want it.
  Risk/reward = personal comfort now vs. commons resilience later. (Closest to the
  sentence. My lean.)
- **The Gardener's loop.** Nature runs on seasonal, semi-irreversible cycles; you
  read the world's rhythm and plant/repair/harvest *with* it. Risk = acting against
  the clock; reward = a commons that compounds across sessions and players.
- **The Host's loop.** The unit of play is invitation and hospitality — you make
  places others want to inhabit, and the world scores *liveliness*, not accumulation.
  Risk = spending yourself on others; reward = a commons that outlives your session.

These aren't exclusive; the real game may braid two. But we should **say one sentence
per loop and kill the boring ones** before encoding anything (per
[../CLAUDE.md](../CLAUDE.md)), then take the survivor through a design pass for
feel, fairness, and tempo.

**Open seams I want your take on:**

- What is the **irreversible thing**? A society with no possibility of real loss has
  no real stakes. What can genuinely be lost — and can it be collectively rebuilt?
- How do **AI citizens** express standing in *mechanics*, not just dialogue? What can
  they do that makes them read as neighbors, not systems?
- What does a player **carry between sessions and between worlds** — and what stays
  with the commons? (This is where the Trellis durable/realtime split becomes fiction.)
- What's the **first five minutes**? What does arriving at the hearth for the first
  time teach you, wordlessly, about how this world works?

---

## What Craftpunk is *not*

- Not a fork of the engine. (See [README.md](README.md). If a feature is generic, it's
  a pack; if it's specific, it's data. It is never a reason to bend the kernel.)
- Not a resource-extraction / infinite-growth game wearing a green coat.
- Not AI-doom and not AI-magic-wand. Neighbors, with all that implies.
- Not solved. The world is optimistic *because* it's still being negotiated, not
  because the credits rolled.

---

## How I imagine it coming together

Thinnest honest slice first: **the Commons** (`commons.jsonld`, seeded) becomes a real
place — a hearth, one AI citizen with genuine upkeep, one patch of nature on its own
clock, and *one* verb that visibly makes the commons more alive. Ship that as a
standing-in-a-living-place feeling before any scoring exists. Prove the *feeling*, then
find the loop, then find the stakes.

Everything Craftpunk-specific stays here as data. Anything a second world would reuse
graduates to a **capability pack** in `/packs/` — starting with `craftpunk-society`,
already stubbed with the primitives this world is reaching for (Commons, Cultivable,
Conversant, Reputation), none wired into core until a second consumer earns them.

The whole thing is a bet that the most convincing argument for a sovereign,
local-first society is to let people *live in a small one for an afternoon* and not
want to leave.

Let's rally.
