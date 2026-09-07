import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const requestId = '00000000-0000-4000-8000-000000000881';
const batchId = '00000000-0000-4000-8000-000000000814';
const shellScenarioIds = {
  normal: '00000000-0000-4000-8000-000000000810',
  transient429: '00000000-0000-4000-8000-000000000811',
  persistent429: '00000000-0000-4000-8000-000000000812',
  invalidJson: '00000000-0000-4000-8000-000000000813',
  definitiveHttp: '00000000-0000-4000-8000-000000000816',
};
const shellScenarioById = new Map(Object.entries(shellScenarioIds).map(([name, id]) => [id, name]));
const shellScenarioReads = new Map();
const results = Array.from({ length: 201 }, (_, index) => ({
  email: `fixture-${String(index + 1).padStart(3, '0')}@example.test`,
  state: 'valid',
  subStatus: 'DELIVERABLE',
  reasonCodes: ['mailbox_confirmed'],
  presend: {
    contract_version: 1,
    status: 'completed',
    outcome: 'actionable_verdict',
    decision: 'send',
    verdict: 'DELIVERABLE',
    provider_family: 'fixture',
    confidence: 0.95,
    reasons: ['mailbox_confirmed'],
    evidence_class: null,
    retry: null,
    billing: { disposition: 'debited', credits: 1 },
    history: null,
  },
}));

let statusReads = 0;
const seen = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  seen.push({ method: req.method, path: url.pathname, headers: req.headers });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
  let status = 200;
  let response;
  let rawResponse;
  const responseHeaders = {};

  if (req.method === 'POST' && url.pathname === '/v1/verify') {
    if (body.email === 'accepted@example.test') {
      status = 202;
      response = {
        status: 'running',
        presend: { contract_version: 1, status: 'running', outcome: 'pending', decision: null, verdict: null, provider_family: null, confidence: null, reasons: [], evidence_class: null, retry: null, billing: { disposition: 'released', credits: 0 }, history: null },
        engineJobId: '00000000-0000-4000-8000-000000000202',
        requestId,
      };
    } else {
      response = {
        status: 'completed',
        presend: results[0].presend,
        engine: { verifiedAt: '2026-09-05T00:00:00.000Z', attempts: 1, providerFamily: 'fixture' },
        requestId,
      };
    }
  } else if (req.method === 'POST' && url.pathname === '/v1/requests') {
    status = 202;
    response = {
      request: { id: batchId, mode: 'bulk', state: 'queued', createdAt: '2026-09-05T00:00:00.000Z', partial: true, finalized: false, countsMayChange: true },
      counters: { submitted: Array.isArray(body.emails) ? body.emails.length : 201 },
      replayed: false,
      requestId,
    };
  } else if (req.method === 'GET' && url.pathname === `/v1/requests/${batchId}`) {
    statusReads += 1;
    const finalized = statusReads > 1;
    response = { request: { id: batchId, mode: 'bulk', state: finalized ? 'finalized' : 'running', createdAt: '2026-09-05T00:00:00.000Z', partial: !finalized, finalized, countsMayChange: !finalized }, counters: { submitted: 201, completed: finalized ? 201 : 80 }, requestId };
  } else if (req.method === 'GET' && /^\/v1\/requests\/[^/]+\/results$/.test(url.pathname)) {
    const resultRequestId = url.pathname.split('/')[3];
    const scenario = shellScenarioById.get(resultRequestId);
    const second = url.searchParams.get('cursor') === 'cursor-200';
    const reads = (shellScenarioReads.get(resultRequestId) ?? 0) + 1;
    shellScenarioReads.set(resultRequestId, reads);

    if (scenario === 'persistent429' && second) {
      status = 429;
      responseHeaders['Retry-After'] = '0';
      response = { error: { code: 'rate_limited', message: 'Synthetic rate limit.', requestId } };
    } else if (scenario === 'transient429' && second && reads === 2) {
      status = 429;
      responseHeaders['Retry-After'] = '0';
      response = { error: { code: 'rate_limited', message: 'Synthetic rate limit.', requestId } };
    } else if (scenario === 'invalidJson') {
      rawResponse = '{invalid-json';
    } else if (scenario === 'definitiveHttp') {
      status = 422;
      response = { error: { code: 'invalid_request', message: 'Synthetic permanent error.', requestId } };
    } else {
      response = {
        jobId: resultRequestId,
        results: second ? results.slice(200) : results.slice(0, 200),
        limit: 200,
        offset: 0,
        nextCursor: second ? null : 'cursor-200',
        partial: false,
        finalized: true,
        countsMayChange: false,
        requestId,
      };
    }
  } else {
    status = 404;
    response = { error: { code: 'not_found', message: 'Fixture route not found.', requestId } };
  }

  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Request-Id': requestId, ...responseHeaders });
  res.end(rawResponse ?? JSON.stringify(response));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
const apiKey = 'blc.fixture.redacted';
const call = async (path, init = {}) => {
  const response = await fetch(base + path, { ...init, headers: { 'X-Api-Key': apiKey, ...(init.headers ?? {}) } });
  return { status: response.status, body: await response.json() };
};

const verifyBatch = await readFile(new URL('../verify-batch.mdx', import.meta.url), 'utf8');
const publishedBlock = verifyBatch.match(/\{\/\* batch-results-script:start \*\/\}\s*```bash\n([\s\S]*?)\n```\s*\{\/\* batch-results-script:end \*\/\}/);
assert.ok(publishedBlock, 'verify-batch.mdx must contain the marked published export script');
const publishedScript = publishedBlock[1];
const fixtureRoot = await mkdtemp(join(tmpdir(), 'bounceless-docs-examples-'));
const scriptPath = join(fixtureRoot, 'published-batch-export.sh');
await writeFile(scriptPath, publishedScript, { mode: 0o700 });

const runPublishedExport = async (scenario, { previous = null } = {}) => {
  const caseDirectory = await mkdtemp(join(fixtureRoot, `${scenario}-`));
  const resultsFile = join(caseDirectory, 'results.jsonl');
  if (previous !== null) await writeFile(resultsFile, previous);

  const child = spawn('bash', [scriptPath], {
    env: {
      ...process.env,
      BOUNCELESS_API_BASE: base,
      BOUNCELESS_API_KEY: 'blc.fixture.redacted',
      REQUEST_ID: shellScenarioIds[scenario],
      BATCH_RESULTS_FILE: resultsFile,
      BATCH_EXPORT_MAX_RETRIES: '3',
      BATCH_EXPORT_RETRY_DELAY_SECONDS: '9',
      BATCH_EXPORT_MAX_RETRY_DELAY_SECONDS: '9',
      BATCH_EXPORT_MAX_JITTER_SECONDS: '0',
      BATCH_EXPORT_MAX_PAGES: '10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const files = await readdir(caseDirectory);
  return { code, stdout, stderr, resultsFile, files };
};

const assertCompleteExport = async (run) => {
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /Export complete:/);
  const lines = (await readFile(run.resultsFile, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 201);
  const emails = lines.map((line) => JSON.parse(line).email);
  assert.equal(new Set(emails).size, 201, 'published export must not lose or duplicate results');
  assert.equal(run.files.filter((file) => file.includes('.partial.')).length, 0);
};

try {
  const completed = await call('/v1/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-single-200' }, body: JSON.stringify({ email: 'completed@example.test' }) });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.presend.decision, 'send');
  assert.equal(completed.body.engine.attempts, 1);

  const accepted = await call('/v1/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-single-202' }, body: JSON.stringify({ email: 'accepted@example.test' }) });
  assert.equal(accepted.status, 202);
  assert.equal(accepted.body.presend.decision, null);
  assert.equal(accepted.body.presend.billing.credits, 0);

  const submitted = await call('/v1/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-batch' }, body: JSON.stringify({ emails: results.map((item) => item.email) }) });
  assert.equal(submitted.status, 202);
  assert.equal(submitted.body.request.id, batchId);

  const submittedList = await call('/v1/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-batch-list' }, body: JSON.stringify({ listId: '00000000-0000-4000-8000-000000000815' }) });
  assert.equal(submittedList.status, 202);
  assert.equal(submittedList.body.counters.submitted, 201);

  const partial = await call(`/v1/requests/${batchId}`);
  const final = await call(`/v1/requests/${batchId}`);
  assert.equal(partial.body.request.partial, true);
  assert.equal(partial.body.request.countsMayChange, true);
  assert.equal(final.body.request.finalized, true);
  assert.equal(final.body.request.countsMayChange, false);

  const collected = [];
  let cursor = null;
  do {
    const page = await call(`/v1/requests/${batchId}/results?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    collected.push(...page.body.results);
    assert.equal(page.body.countsMayChange, false);
    cursor = page.body.nextCursor;
  } while (cursor);
  assert.equal(collected.length, 201);
  assert.equal(new Set(collected.map((item) => item.email)).size, 201);

  const jsonl = collected.map((item) => JSON.stringify(item)).join('\n');
  const csv = ['email,decision', ...collected.map((item) => `${item.email},${item.presend.decision}`)].join('\n');
  assert.equal(jsonl.split('\n').length, 201);
  assert.equal(csv.split('\n').length, 202);
  assert.ok(seen.every((request) => request.headers['x-api-key'] === apiKey));
  assert.ok(seen.every((request) => request.headers.authorization === undefined));
  assert.ok(seen.filter((request) => request.method === 'POST').every((request) => request.headers['idempotency-key']));

  const normal = await runPublishedExport('normal');
  await assertCompleteExport(normal);
  const transient429 = await runPublishedExport('transient429');
  assert.match(transient429.stderr, /HTTP 429; retrying in 0s/, 'numeric Retry-After must override the fallback delay');
  await assertCompleteExport(transient429);

  const previous = '{"previous":"complete"}\n';
  const persistent429 = await runPublishedExport('persistent429', { previous });
  assert.equal(persistent429.code, 1);
  assert.doesNotMatch(persistent429.stdout, /Export complete:/);
  assert.match(persistent429.stderr, /HTTP 429 after 3 attempts/);
  assert.equal(await readFile(persistent429.resultsFile, 'utf8'), previous, 'a failed retry budget must preserve the previous final export');
  assert.equal(persistent429.files.filter((file) => file.includes('.partial.')).length, 0);

  const invalidJson = await runPublishedExport('invalidJson');
  assert.equal(invalidJson.code, 1);
  assert.match(invalidJson.stderr, /not valid results JSON/);
  assert.ok(!invalidJson.files.includes('results.jsonl'));

  const definitiveHttp = await runPublishedExport('definitiveHttp');
  assert.equal(definitiveHttp.code, 1);
  assert.match(definitiveHttp.stderr, /HTTP 422 \(invalid_request\)/);
  assert.ok(!definitiveHttp.files.includes('results.jsonl'));

  console.log('fixture examples ok: single 200+engine, single 202, inline/list batch requestId, partial→final+countsMayChange, 201 cursor results, JSONL/CSV export');
  console.log(`published MDX shell ok: normal=exit${normal.code}/201; transient429=exit${transient429.code}/201/Retry-After; persistent429=exit${persistent429.code}/prior-preserved; invalidJSON=exit${invalidJson.code}/no-final; permanentHTTP=exit${definitiveHttp.code}/no-final`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(fixtureRoot, { recursive: true, force: true });
}
