import { randomBytes } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Generates private values locally; never prints them or changes other settings.
const target = resolve(process.argv[2] ?? '.env');
let content = await readFile(target, 'utf8');
const config = parseEnv(content);
const changes = [];
for (const key of ['JWT_SECRET', 'COOKIE_SECRET']) {
  const value = config[key] ?? '';
  if (value.includes('\n') || value.includes('\r')) throw new Error(`${key} must be a single-line value; file unchanged.`);
  if (value.length >= 32 && (key !== 'COOKIE_SECRET' || value !== config.JWT_SECRET)) continue;
  const secret = randomBytes(32).toString('hex');
  const assignment = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'm');
  content = assignment.test(content) ? content.replace(assignment, () => `${key}=${secret}`)
    : `${content}${content.endsWith('\n') ? '' : '\n'}${key}=${secret}\n`;
  config[key] = secret;
  changes.push(key);
}
if (changes.length) {
  const temp = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temp, content, { mode: 0o600, flag: 'wx' });
    await rename(temp, target);
  } finally { await unlink(temp).catch(() => {}); }
}
console.log(JSON.stringify({ file: target, updated: changes, secretLengths: {
  JWT_SECRET: config.JWT_SECRET.length, COOKIE_SECRET: config.COOKIE_SECRET.length,
} }));
