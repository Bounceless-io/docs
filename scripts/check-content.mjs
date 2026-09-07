import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const docs = JSON.parse(await read('docs.json'));
const openapi = YAML.parse(await read('openapi.yaml'));

assert.deepEqual(Object.keys(openapi.paths).sort(), [
  '/v1/requests',
  '/v1/requests/{id}',
  '/v1/requests/{id}/results',
  '/v1/verify',
]);
assert.equal(openapi.components.securitySchemes.apiKey.name, 'X-Api-Key');
assert.deepEqual(openapi.security, [{ apiKey: [] }, { bearerAuth: [] }]);
assert.equal(openapi.components.securitySchemes.bearerAuth.type, 'http');
assert.equal(openapi.components.securitySchemes.bearerAuth.scheme, 'bearer');
assert.equal(openapi.components.parameters.Cursor.name, 'cursor');
assert.ok(openapi.components.schemas.ResultsPage.properties.nextCursor);
assert.ok(openapi.components.schemas.ResultsPage.properties.countsMayChange);
assert.ok(openapi.components.schemas.RequestDescriptor.properties.countsMayChange);
assert.ok(openapi.components.schemas.VerifyResult.properties.presend);
assert.ok(openapi.components.schemas.VerifyResult.properties.engine);
assert.deepEqual(openapi.components.schemas.BatchInput.oneOf, [
  { required: ['emails'] },
  { required: ['listId'] },
]);

const navigated = docs.navigation.groups.flatMap((group) => group.pages);
assert.equal(navigated.length, new Set(navigated).size, 'navigation entries must be unique');
for (const required of [
  'index', 'quickstart', 'authentication', 'integration-options', 'verify-single',
  'verify-batch', 'decisions-and-reason-codes', 'errors', 'guides/mcp', 'cli',
  'agent-guide', 'migration', 'changelog', 'contributing',
]) assert.ok(navigated.includes(required), `${required} must be navigated`);

const prose = await Promise.all(navigated.map((slug) => read(`${slug}.mdx`)));
assert.ok(prose.every((page) => {
  const frontmatter = page.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return /^title: ["'][^"']+["']$/m.test(frontmatter) && /^description: ["'][^"']+["']$/m.test(frontmatter);
}), 'every navigated page must have title and description frontmatter');
const unsupportedWaitFlag = `--${'wait'}`;
assert.ok(prose.every((page) => !page.includes(unsupportedWaitFlag)), 'unsupported wait flag must not appear');
assert.ok(!navigated.includes('mcp'), '/mcp is reserved for the docs transport');

const quickstart = await read('quickstart.mdx');
assert.match(quickstart, /A final result that can be retrieved asynchronously[\s\S]*?\/verify-batch/);
assert.doesNotMatch(quickstart, /never (?:pre-fills or )?persists/i, 'playground persistence requires browser proof');
const apiSingle = await read('api-reference/verify-single.mdx');
assert.doesNotMatch(apiSingle, /does not (?:prefill or )?persist/i, 'API reference must not infer playground persistence');

const batchGuide = await read('verify-batch.mdx');
assert.match(batchGuide, /\{\/\* batch-results-script:start \*\/\}[\s\S]*\{\/\* batch-results-script:end \*\/\}/);
assert.match(batchGuide, /Batch result page failed with HTTP/);
assert.match(batchGuide, /\.partial\.XXXXXX/);

const readme = await read('README.md');
assert.ok(readme.startsWith('# Bounceless Documentation\n'));
for (const href of [
  'https://docs.bounceless.io/quickstart',
  'https://docs.bounceless.io/api-reference/verify-single',
  'https://docs.bounceless.io/cli',
  'https://docs.bounceless.io/guides/mcp',
  'https://docs.bounceless.io/contributing',
]) assert.ok(readme.includes(href), `README must link to ${href}`);

const skill = await read('skill.md');
for (const copy of [
  '.well-known/agent-skills/bounceless/SKILL.md',
  '.well-known/skills/bounceless/SKILL.md',
  '.well-known/skills/bounceless/skill.md',
]) assert.equal(await read(copy), skill, `${copy} must match skill.md`);
const index = JSON.parse(await read('.well-known/agent-skills/index.json'));
const digest = `sha256:${createHash('sha256').update(skill).digest('hex')}`;
assert.equal(index.skills[0].digest, digest, 'agent skill digest must match canonical skill.md');

console.log(`content contract ok: ${navigated.length} navigated pages, 4 GA routes, skill ${digest.slice(0, 23)}…`);
