# docs

Public Mintlify source for [docs.bounceless.io](https://docs.bounceless.io).

This GitHub repository is **public** and connected to Mintlify. It contains the
four-route GA OpenAPI contract, guides for API/MCP/CLI use, and the installable
agent skill. No product or server code belongs here.

`package.json` includes `"private": true` only so this documentation tree is **not**
published to the npm registry. That flag is not GitHub visibility.

```bash
npm ci --include=dev --ignore-scripts
npm run check
npm run dev
```

Human-facing MCP documentation lives at `/guides/mcp`. The `/mcp` route is reserved for Mintlify's documentation MCP transport.

`skill.md` is the canonical agent skill. Run `npm run sync:skill` after changing it; `npm run check` rejects stale well-known copies or digests.

See [Feedback, contributions, and security](https://docs.bounceless.io/contributing) before opening a documentation pull request.

- License: Apache-2.0
- Default branch: `main`
- Org: [Bounceless-io](https://github.com/Bounceless-io)
