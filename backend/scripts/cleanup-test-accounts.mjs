import { PrismaClient } from '@prisma/client';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [allowlistPath, archivePath, option] = process.argv.slice(2);
if (!allowlistPath || !archivePath) throw Error('Usage: cleanup-test-accounts.mjs allowlist.json private-archive.json [--execute]');
const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
if (!Array.isArray(allowlist) || !allowlist.length || allowlist.length > 100 ||
    new Set(allowlist.map(u => u.id)).size !== allowlist.length ||
    allowlist.some(u => typeof u.id !== 'string' || typeof u.email !== 'string' || !u.email.startsWith('qa-'))) {
  throw Error('An explicit unique QA account allowlist is required');
}
if (option && option !== '--execute') throw Error('Unknown option');
const ids = allowlist.map(u => u.id);
const db = new PrismaClient();
try {
  const result = await db.$transaction(async tx => {
    // Lock only the explicitly authorised test profiles before archiving and deleting.
    if (option === '--execute') await tx.user.updateMany({ where: { id: { in: ids } }, data: { balance: { increment: 0n } } });
    const users = await tx.user.findMany({ where: { id: { in: ids } } });
    if (users.length !== ids.length || users.some(u => u.role !== 'USER' ||
        !allowlist.some(expected => expected.id === u.id && expected.email === u.email))) throw Error('QA allowlist mismatch; no deletion');
    const active = await tx.transaction.count({ where: { userId: { in: ids }, metadata: { path: ['escrowStatus'], equals: 'active' } } });
    const pending = await tx.gameSession.count({ where: { userId: { in: ids }, resultData: { path: ['status'], equals: 'pending' } } });
    if (active || pending) throw Error('Test profiles still have unsettled funds; no deletion');
    const models = ['account', 'transaction', 'gameSession', 'dailyReward', 'notification', 'responsibleLimit',
      'userBadge', 'userTask', 'raceEntry', 'chatMessage'];
    const data = { users };
    for (const model of models) data[model] = await tx[model].findMany({ where: { userId: { in: ids } } });
    const audit = await tx.auditLog.count({ where: { adminId: { in: ids } } });
    if (audit) throw Error('QA profiles are referenced as administrators; no deletion');
    const counts = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length]));
    if (option !== '--execute') return { dryRun: true, counts };
    await writeFile(resolve(archivePath), JSON.stringify({ archivedAt: new Date().toISOString(), data }, (_, value) =>
      typeof value === 'bigint' ? { $bigint: value.toString() } : value), { mode: 0o600, flag: 'wx' });
    // These three relations restrict deletion; the remaining user-owned rows cascade.
    for (const model of ['userBadge', 'userTask', 'raceEntry']) await tx[model].deleteMany({ where: { userId: { in: ids } } });
    const removed = await tx.user.deleteMany({ where: { id: { in: ids }, role: 'USER' } });
    if (removed.count !== ids.length) throw Error('Incomplete removal; transaction rolled back');
    return { deleted: removed.count, archived: counts, archive: resolve(archivePath), treasuryTransfer: 0 };
  }, { timeout: 60000 });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error('QA cleanup failed; database transaction rolled back. Check the private archive before retrying.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
