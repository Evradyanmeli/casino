import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!process.env.DATABASE_URL) loadEnvFile(resolve(root, '.env'));
const db = new PrismaClient();
const models = ['user', 'account', 'transaction', 'gameSession', 'dailyReward', 'notification', 'badge',
  'systemSetting', 'userBadge', 'task', 'userTask', 'race', 'raceEntry', 'gameConfig', 'chatMessage', 'auditLog', 'responsibleLimit'];
try {
  const data = await db.$transaction(async tx => Object.fromEntries(await Promise.all(
    models.map(async model => [model, await tx[model].findMany()]),
  )), { isolationLevel: 'RepeatableRead', timeout: 60000 });
  const target = process.argv[2] ?? `/tmp/opencode/casino-backup-${Date.now()}.json`;
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, JSON.stringify({ createdAt: new Date().toISOString(), data }, (_, value) =>
    typeof value === 'bigint' ? { $bigint: value.toString() } : value), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ backup: target, counts: Object.fromEntries(models.map(model => [model, data[model].length])) }));
} catch (err) {
  const detail = String(err.message).replaceAll(process.env.DATABASE_URL ?? '[none]', '[DATABASE_URL]').replace(/:\/\/[^\s/@]+:[^\s/@]+@/g, '://[credentials]@');
  console.error(`Backup failed (${err.name}, ${err.code ?? 'no code'}): ${detail}. No database mutation performed.`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
