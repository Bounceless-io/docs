# Bounceless Documentation

Developer documentation for integrating Bounceless email verification through the GA API, CLI, local MCP server, or agent skill.

## Start here

- [Quickstart](https://docs.bounceless.io/quickstart) — create an API key and make a first controlled request.
- [API reference](https://docs.bounceless.io/api-reference/verify-single) — inspect the four-route HTTP contract and response shapes.
- [CLI guide](https://docs.bounceless.io/cli) — submit, inspect, and export verifications from a shell.
- [MCP guide](https://docs.bounceless.io/guides/mcp) — configure the local product MCP server without confusing it with Mintlify's documentation transport.
- [Agent skill](https://docs.bounceless.io/skill.md) — install the same public workflow guidance as raw Markdown.
- [Feedback, contributions, and security](https://docs.bounceless.io/contributing) — propose a correction or report a sensitive issue through the appropriate channel.

## Work on the documentation

This repository is the public Mintlify source for [docs.bounceless.io](https://docs.bounceless.io). It contains documentation and the four-route GA OpenAPI contract; no product or server code belongs here.

`package.json` includes `"private": true` only to prevent accidental npm publication. It does not describe GitHub visibility.

```bash
npm ci --include=dev --ignore-scripts
npm run check
npm run dev
```

Human-facing MCP documentation lives at `/guides/mcp`. The `/mcp` route is reserved for Mintlify's documentation MCP transport.

`skill.md` is the canonical agent skill. Run `npm run sync:skill` after changing it; `npm run check` rejects stale well-known copies or digests.

- License: Apache-2.0
- Default branch: `main`
- Org: [Bounceless-io](https://github.com/Bounceless-io)
