# TRL-226 — Spec: Sketchfab acquisition harden

See [sketchfab-harden/summary.md](../sketchfab-harden/summary.md) for full spec (created before TRL issue filed).

## Acceptance criteria

```text
test:bash -lc "nvm use 22 && cd Projects/Sandbox/museum-oss && pnpm check"
test:bash -lc "nvm use 22 && cd Projects/Sandbox/museum-oss && pnpm webmcp:budget"
test:bash -lc "nvm use 22 && cd Projects/Sandbox/museum-oss && pnpm test:sketchfab"
test:bash -lc "nvm use 22 && cd Projects/Sandbox/museum-oss && pnpm test:webmcp-surface"
test:PW_REUSE=1 pnpm test:e2e e2e/webmcp-tools.spec.ts  # reviewer
```
