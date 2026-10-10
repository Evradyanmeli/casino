import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!process.env.DATABASE_URL) loadEnvFile(resolve(root, '.env'));
const url = new URL(process.env.DATABASE_URL);
const schema = `casino_qa_${Date.now()}`;
url.searchParams.set('schema', schema);
const env = { ...process.env, DATABASE_URL: url.toString() };
// Prisma creates only this new, empty namespace, never resets the application's schema.
const prepared = spawnSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'],
  { cwd: resolve(root, 'backend'), env, encoding: 'utf8' });
if (prepared.status !== 0) {
  console.error('Isolated test schema unavailable. Application database left unchanged.');
  process.exit(1);
}
await mkdir('/tmp/opencode/casino-fix', { recursive: true, mode: 0o700 });
await writeFile('/tmp/opencode/casino-fix/test.env',
  `DATABASE_URL=${JSON.stringify(url.toString())}\nJWT_SECRET=isolated-casino-regression-only\nPORT=3300\nCORS_ORIGIN=http://127.0.0.1:5175\n`,
  { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ schema, environment: '/tmp/opencode/casino-fix/test.env', isolated: true }));
