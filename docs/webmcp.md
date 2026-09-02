# WebMCP — condensed reference

Distilled from [Chrome's WebMCP docs](https://developer.chrome.com/docs/ai/webmcp)
(pub. 2026-05-18, upd. 2026-08-20) and the
[W3C WebML spec draft](https://webmachinelearning.github.io/webmcp/).
Status: **origin trial from Chrome 149**, unshipped, subject to change.

## What it is

A page registers **tools** — JS functions with a natural-language description and a
JSON Schema — that an agent calls directly instead of scraping and click-simulating
the DOM ("actuation"). Per the spec:

> Web pages that use WebMCP can be thought of as MCP servers that implement tools in
> client-side script instead of on the backend.

Tools execute *visibly, on the page*, so the human sees what the agent did and the
site's own UI/validation stays authoritative.

## Enabling it

- **Local dev:** `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch.
- **Prod:** [origin trial registration](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241) (Chrome 149+). Set `VITE_WEBMCP_ORIGIN_TRIAL_TOKEN` at build time for `https://trellis-sync-3d-playground.vercel.app` — Vite injects the `<meta http-equiv="origin-trial">` into `app.html`.
- **Testing without an agent:** [Model Context Tool Inspector extension](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
  — lists registered tools, calls them manually, validates schemas, and gives a chat
  UI (defaults to `gemini-3-flash-preview`).
- **Types:** `npm i -D webmcp-types`.

## Hard requirements

| Constraint | Detail |
|---|---|
| Secure context | `[SecureContext]` — HTTPS or localhost |
| `Window` only | `[Exposed=Window]` — no workers |
| Origin-isolated document | Disabled if `document.domain` is enabled (`Origin-Agent-Cluster: ?0` kills it) |
| Permissions Policy | Gated by `tools`, defaults to `self`; cross-origin iframes need `allow="tools"` |

## Imperative API (the one that matters here)

Entry point is **`document.modelContext`** — *not* `navigator`.

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};

[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool,
                                  optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool,
                                 optional object inputObject = {},
                                 optional ModelContextExecuteToolOptions options = {});
  attribute EventHandler ontoolchange;
};

dictionary ModelContextTool {
  required DOMString name;          // unique; agents reference this
  USVString title;                  // display label for browser UI
  required DOMString description;
  object inputSchema;               // JSON Schema
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;
};

dictionary ToolAnnotations {
  boolean readOnlyHint = false;         // tool does not mutate state
  boolean untrustedContentHint = false; // output contains UGC / external data
};

callback ToolExecuteCallback =
  Promise<any> (object inputObject, ToolExecuteCallbackOptions options);
                                        // options.signal is a required AbortSignal

dictionary ModelContextRegisterToolOptions {
  sequence<USVString> exposedTo;    // secure origins allowed to see/run it
  AbortSignal signal;               // abort → unregister
};
dictionary ModelContextGetToolOptions    { sequence<USVString> fromOrigins; };
dictionary ModelContextExecuteToolOptions { AbortSignal signal; };

dictionary RegisteredTool {
  required DOMString name; DOMString title; required DOMString description;
  object inputSchema; required Window window; required USVString origin;
  ToolAnnotations annotations;
};
```

`registerTool` **rejects** if: the name is already registered, `name` or
`description` is empty, or `inputSchema` is invalid.

### Register

```js
await document.modelContext.registerTool({
  name: 'toggle_layer',
  description: 'Control pizza layers (sauce, cheese). Use "add", "remove", or "toggle".',
  inputSchema: {
    type: 'object',
    properties: {
      layer:  { type: 'string', enum: ['sauce-layer', 'cheese-layer'] },
      action: { type: 'string', enum: ['add', 'remove', 'toggle'] },
    },
    required: ['layer'],
  },
  execute: async ({ layer, action }) => {
    await toggleLayer(layer, action);
    return `Performed ${action || 'toggle'} on layer: ${layer}`;
  },
});
```

### Unregister — `AbortSignal`

```js
const controller = new AbortController();
await document.modelContext.registerTool(tool, { signal: controller.signal });
controller.abort();
```

Chrome 153+ unregisters without cancelling in-flight executions (matters for
component-lifecycle registration — i.e. Svelte `$effect` teardown).

### Cancellation inside `execute`

Second arg is `{ signal }`; forward it to `fetch` and long-running work.

```js
execute: async ({ url }, { signal }) => {
  const response = await fetch(url, { signal });
  // ...
}
```

### Discover / execute (in-page agents)

```js
const tools = await document.modelContext.getTools();          // same-origin only
const all   = await document.modelContext.getTools({ fromOrigins: ['https://partner.org'] });
const result = await document.modelContext.executeTool(tool, '{"text": "Buy milk"}');
```

`executeTool` resolves to the **stringified** result, or `null` if the tool
triggered a navigation. The browser's own agent uses a separate internal channel —
`getTools()` is for JS agents living in the page.

### Events

```js
document.modelContext.addEventListener('toolchange', () => { /* tool list changed */ });
```

## Declarative API (not relevant to a canvas app — noted for completeness)

Annotate a `<form>` with `toolname` / `tooldescription`; per-field
`toolparamdescription`; `toolautosubmit` to submit on invoke. Removing either
attribute unregisters. `SubmitEvent` gains `agentInvoked` (boolean) and
`respondWith(Promise)` (after `preventDefault()`) to return a tool result.
`window` fires `toolactivated` / `toolcancel` with a `toolName`. CSS gets
`:tool-form-active`.

## Authoring rules worth obeying

**Tool design**
- One tool = one function. Overlapping tools make the agent pick wrong.
- Prefer *static* registration; register/unregister dynamically only when a tool is
  genuinely unusable in the current page state.
- Names distinguish execution from initiation: `create_event` (does it) vs
  `start_event_creation_process` (opens the form).
- Positive descriptions. "This tool creates a calendar event at a date and time,"
  not "Don't use this for weather." Limitations should be implicit.
- Every tool costs context window and latency. More tools ≠ better.

**Minimize model work**
- Accept raw user input; don't ask the agent to do math or reformat strings.
- Declare concrete types / enums.
- Say *why*: `shipping="Express"`, never `shipping_id=1`.

**Reliability**
- Validate strictly in code, loosely in schema — schema constraints aren't
  guaranteed. Return descriptive errors so the agent can self-correct and retry.
- Update the UI after the tool completes; agents read the interface to plan.
- Degrade gracefully on rate limits with a meaningful error.

**Security**
- `readOnlyHint: true` on non-mutating tools → agent can skip confirmations.
- `untrustedContentHint: true` on anything returning UGC or external data.
- `exposedTo` only for origins you'd hand the same data/authority to directly.
- Sensitive actions (purchases etc.) should request explicit user confirmation.

**Character budgets** (guidance, not enforced — yet)

| Field | Limit |
|---|---|
| Tool description | 500 |
| Parameter description | 150 |
| Tool name / param name | 30 |
| Individual tool output | 1.5K |

## Site tools pairing (ChatGPT desktop)

You cannot force page tools into every agent session — discovery depends on the
**browser-to-task bridge**. Use this checklist when `spawn_prop` (or other tools)
do not appear in the agent's callable tools:

1. **Client:** latest ChatGPT desktop app with **GPT-5.6 Sol** or **Terra** (Luna,
   Enterprise, and Edu are not currently supported).
2. **Permission:** **Settings → Browser → Permissions → Enable site tools** on.
3. **Page:** Playlab open at the top level (not an iframe). DocBar chip should read
   `WebMCP · 12` when registration succeeded.
4. **Reload** the page after deploy or HMR — tools re-register on each world-ready
   pass (`ensureWebMcpRegistered()`).
5. **Verify registration:** **Site tools → Available site tools** must list
   `spawn_prop`. The WebMCP badge alone does not prove tools were attached to the
   current agent task.
6. **Pair the tab:** start or send the agent request from the task **paired with**
   that built-in browser tab. Navigating away or closing the tab removes its tools.

If tools appear under Available site tools but not in the agent task, the gap is
the Multiplex discovery bridge (see [[issue:TRL-217]]) — not faulty page handlers.
Use `pnpm agent:room` (MCP stdio) or the Model Context Tool Inspector extension
as fallbacks.

Official reference: [ChatGPT Site tools / WebMCP](https://learn.chatgpt.com/docs/webmcp).

## Known limitations

- Designed for **local browser workflows with a human in the loop**; headless is
  possible but not the target.
- Complex apps generally need refactoring to expose coherent state.
- **No discovery mechanism** — a client must already be on the page to learn it has
  tools.

## Framework support

- React: `usewebmcp` (`useWebMCP` hook, mount/unmount-tied, schema type inference).
- Angular: experimental, native.
- Svelte: nothing official — register in an `$effect` and abort on teardown.

## Mapping to this repo

The engine's mutation vocabulary is already a tool schema. See
`src/lib/engine/ontology/durablePatch.ts`:

| `DurablePatch` kind | Candidate tool | `readOnlyHint` |
|---|---|---|
| — (`exportWorldGraph`) | `read_world` | ✅ |
| `defineComponent` | `define_component` | ❌ |
| `defineType` | `define_type` | ❌ |
| `setEntity` | `spawn_entity` | ❌ |
| `setComponent` / `setField` | `set_entity_field` | ❌ |
| `removeEntity` | `remove_entity` | ❌ |
| `setEvents` | `set_entity_events` | ❌ |

`AgentAction` in `src/lib/engine/agent/runtime.ts` already declares
`{ kind: 'patch'; patches: DurablePatch[] }`, and
`src/lib/engine/agent/worldEnvAdapter.ts:38` leaves `case 'patch':` as a bare
`break` — that stub is the integration point.

Note the origin-isolation requirement against the Vercel deployment, and that
`/api/agent/chat` (Ollama) is orthogonal: WebMCP means an *external* agent drives
the page, so no in-repo model is on the critical path.
