---
name: bounceless
description: Verify individual email addresses or batches with Bounceless through its API, MCP server, or CLI.
---

# Bounceless agent onboarding

Install with `npx skills add https://docs.bounceless.io`.

## Configure safely

Read `BOUNCELESS_API_KEY` from the runtime's secret environment. Never print, log, commit, return, or paste the key into a prompt. Send API credentials only as `X-Api-Key`.

## Choose an interface

- API: best for direct HTTP integrations. Base URL: `https://api.bounceless.io`.
- MCP: use the product server `@bounceless/mcp` when the client supports MCP.
- CLI: use `npx @bounceless/cli` for shell workflows.

The documentation MCP is search-only and must never be treated as a product verification tool.

## Single verification

```bash
curl -sS https://api.bounceless.io/v1/verify -X POST \
  -H "X-Api-Key: $BOUNCELESS_API_KEY" \
  -H "Idempotency-Key: agent-single-001" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Batch verification

```bash
curl -sS https://api.bounceless.io/v1/requests -X POST \
  -H "X-Api-Key: $BOUNCELESS_API_KEY" \
  -H "Idempotency-Key: agent-batch-001" \
  -H "Content-Type: application/json" \
  -d '{"emails":["first@example.com","second@example.com"]}'
```

Save `request.id`, poll `GET /v1/requests/{id}`, then page through `GET /v1/requests/{id}/results?limit=50&offset=0`. A creation returns `202`; an identical replay returns `200` with the same ID. Respect `Retry-After` on `429`.

## CLI equivalents

```bash
npx @bounceless/cli verify test@example.com
npx @bounceless/cli batch ./emails.txt --wait --output results.jsonl
```

## Smoke test

Confirm `BOUNCELESS_API_KEY` is present without displaying it, verify one controlled test address, require a successful HTTP status, and record only the response `requestId`. Do not expose the secret or real customer addresses in output.
