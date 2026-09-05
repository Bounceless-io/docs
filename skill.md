---
name: bounceless
description: Verify individual email addresses or batches with Bounceless through its GA API, local MCP server, or CLI.
---

# Bounceless agent onboarding

Install with `npx skills add https://docs.bounceless.io --yes`.

## Configure safely

Read `BOUNCELESS_API_KEY` from the runtime's secret environment. Never print, log, commit, return, or paste the key into a prompt. Send API credentials only as `X-Api-Key`.

## Choose an interface

- API: best for direct HTTP integrations. Base URL: `https://api.bounceless.io`.
- MCP: use the local stdio product server `@bounceless/mcp@1.0.0` when the client supports MCP.
- CLI: use `npx @bounceless/cli@1.0.0` for shell workflows.

The human MCP guide is `https://docs.bounceless.io/guides/mcp`. The `/mcp` route is the Mintlify documentation transport. It is search/read-only and must never be treated as a product verification tool or receive `BOUNCELESS_API_KEY`.

## Single verification

```bash
curl -sS https://api.bounceless.io/v1/verify -X POST \
  -H "X-Api-Key: $BOUNCELESS_API_KEY" \
  -H "Idempotency-Key: agent-single-001" \
  -H "Content-Type: application/json" \
  -d '{"email":"controlled@example.com"}'
```

HTTP `200` contains the decision in `presend`. HTTP `202` contains `engineJobId`, `requestId`, a null decision, and zero billed credits. There is no public single-result polling route in the four-route GA API. Record the IDs and do not resubmit automatically. Use batch when a retrievable asynchronous result is required.

## Batch verification

```bash
curl -sS https://api.bounceless.io/v1/requests -X POST \
  -H "X-Api-Key: $BOUNCELESS_API_KEY" \
  -H "Idempotency-Key: agent-batch-001" \
  -H "Content-Type: application/json" \
  -d '{"emails":["first@example.com","second@example.com"]}'
```

Save `request.id`, poll `GET /v1/requests/{id}` with a time/attempt bound until `request.finalized` is true, then page through `GET /v1/requests/{id}/results?limit=200`. Pass each opaque `nextCursor` back as `cursor` until it is null. `offset` remains compatible but cursor pagination is canonical. A creation returns `202`; an identical replay returns `200` with the same ID. Respect `Retry-After` on `429`.

## CLI equivalents

```bash
npx @bounceless/cli@1.0.0 verify controlled@example.com
npx @bounceless/cli@1.0.0 batch submit ./emails.csv > batch-submit.json
npx @bounceless/cli@1.0.0 batch status "$REQUEST_ID" > batch-status.json
npx @bounceless/cli@1.0.0 batch results "$REQUEST_ID" --output json > batch-results.json
npx @bounceless/cli@1.0.0 batch results "$REQUEST_ID" --output csv > batch-results.csv
```

The CLI has no wait flag. Product MCP 1.0 exposes exactly `verify_email`, `verify_batch`, `get_job`, and `get_results`.

## Interpret safely

Read the additive `presend` envelope. A null decision is not permission to send. Unknown and other non-verdict outcomes are inconclusive and never billed; credits do not expire. Verification does not guarantee inbox placement or sender-reputation outcomes.

MCP inputs/results and CLI output may enter third-party transcripts or files. Use controlled addresses, review client retention, and store outputs in access-controlled locations.

## Smoke test

Confirm `BOUNCELESS_API_KEY` is present without displaying it, verify one controlled test address, accept only documented HTTP statuses, and record only redacted correlation IDs. Do not expose the secret or real customer addresses in output.
