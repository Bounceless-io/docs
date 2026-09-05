import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../skill.md', import.meta.url));
const targets = [
  new URL('../.well-known/agent-skills/bounceless/SKILL.md', import.meta.url),
  new URL('../.well-known/skills/bounceless/SKILL.md', import.meta.url),
  new URL('../.well-known/skills/bounceless/skill.md', import.meta.url),
];

await Promise.all(targets.map((target) => writeFile(target, source)));

const digest = createHash('sha256').update(source).digest('hex');
const indexPath = new URL('../.well-known/agent-skills/index.json', import.meta.url);
const index = JSON.parse(await readFile(indexPath, 'utf8'));
index.skills[0].description = 'Verify individual email addresses or batches with Bounceless through its GA API, local MCP server, or CLI.';
index.skills[0].digest = `sha256:${digest}`;
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
