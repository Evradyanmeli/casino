// Usage: node scripts/validate-financial-migration.mjs /usr/lib/postgresql/14/bin [legacy-git-ref]
// Creates its own local cluster; never loads .env or connects to DATABASE_URL.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pgBin = process.argv[2];
const legacyRevision = process.argv[3] ?? 'fab91e0';
assert.ok(pgBin, 'Pass a local PostgreSQL bin directory containing initdb, pg_ctl and psql');
assert.notEqual(process.getuid?.(), 0, 'Run as a non-root user');
const temp = await mkdtemp('/tmp/opencode/casino-migration-');
const port = randomInt(20000, 60000);
const source = `postgresql://validator@127.0.0.1:${port}/postgres`;
const env = { ...process.env, DATABASE_URL: source, PGOPTIONS: '', PGPASSWORD: '',
  PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'validator', PGDATABASE: 'postgres' };
const prismaCli = resolve(backend, 'node_modules/prisma/build/index.js');
const schema = resolve(backend, 'prisma/schema.prisma');
const migration = resolve(backend, 'prisma/migrations/20261011_financial_operations/migration.sql');
let started = false, db;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: backend, env, encoding: 'utf8', timeout: 60000, ...options });
  assert.equal(result.status, 0, `${command} failed: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function prisma(args, url) {
  return run(process.execPath, [prismaCli, ...args], { env: { ...env, DATABASE_URL: url } });
}
const legacyModels = Prisma.dmmf.datamodel.models.filter(model => model.name !== 'FinancialOperation');
async function snapshot() {
  return Object.fromEntries(await Promise.all(legacyModels.map(async model => {
    const name = model.name[0].toLowerCase() + model.name.slice(1);
    return [name, await db[name].findMany({ orderBy: model.fields.filter(field => field.isId)
      .map(field => ({ [field.name]: 'asc' })) })];
  })));
}

try {
  run(resolve(pgBin, 'initdb'), ['-D', `${temp}/data`, '-A', 'trust', '-U', 'validator', '--no-locale']);
  run(resolve(pgBin, 'pg_ctl'), ['-D', `${temp}/data`, '-l', `${temp}/postgres.log`, '-w', 'start',
    '-o', `-h 127.0.0.1 -p ${port} -k ${temp}`]);
  started = true;
  const legacy = run('git', ['show', `${legacyRevision}:backend/prisma/schema.prisma`]);
  assert.ok(!legacy.includes('model FinancialOperation') && /balance\s+BigInt\s+@default\(5000\)/.test(legacy),
    'Select a known pre-hardening db-push schema revision');
  const legacySchema = `${temp}/legacy.prisma`;
  await writeFile(legacySchema, legacy, { mode: 0o600 });
  for (const mode of ['sql', 'db_push']) {
    const url = `${source}?schema=validation_${mode}`;
    prisma(['db', 'push', '--skip-generate', '--schema', legacySchema], url);
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.user.createMany({ data: [
      { id: 'house', email: 'admin@casino.com', pseudo: 'House', role: 'ADMIN', balance: 9007199254740993n },
      { id: 'player', email: 'player@migration.test', pseudo: 'Player', balance: 123456n },
    ] });
    // Raw inserts test the database default, not the generated client's newer default.
    await db.$executeRaw`INSERT INTO "User" ("id", "email", "pseudo", "updatedAt")
      VALUES ('legacy-default', 'default@migration.test', 'LegacyDefault', CURRENT_TIMESTAMP)`;
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: 'legacy-default' } })).balance, 5000n);
    await db.transaction.create({ data: { id: 'reserve', userId: 'house', type: 'game_house_reserve', amount: -1200n,
      metadata: { escrowId: 'reserve', escrowStatus: 'active', escrowAmount: '1200' } } });
    await db.gameSession.create({ data: { id: 'pending', userId: 'player', gameType: 'blackjack', betAmount: 50n,
      endedAt: new Date(0), resultData: { status: 'pending' } } });
    await db.systemSetting.create({ data: { key: 'initial_capital', value: 100000 } });
    await db.auditLog.create({ data: { adminId: 'house', action: 'migration_fixture', entity: 'user', entityId: 'player' } });
    const before = await snapshot();

    if (mode === 'sql') {
      const deploy = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema],
        { cwd: backend, env: { ...env, DATABASE_URL: url }, encoding: 'utf8', timeout: 60000 });
      assert.notEqual(deploy.status, 0, 'An unbaselined populated database must not accept migrate deploy');
      assert.match(`${deploy.stdout}\n${deploy.stderr}`, /P3005/);
      run(resolve(pgBin, 'psql'), ['-X', '--dbname', source, '--set', 'ON_ERROR_STOP=1',
        '--single-transaction', '--file', migration], { env: { ...env, PGOPTIONS: '-c search_path=validation_sql' } });
      assert.deepEqual(await snapshot(), before);
      const drift = prisma(['migrate', 'diff', '--from-url', url, '--to-schema-datamodel', schema, '--script'], url);
      assert.ok(!/ALTER TABLE|CREATE TABLE|DROP TABLE|DROP COLUMN|CREATE INDEX/.test(drift), 'Unexpected schema drift after SQL migration');
      console.log('PASS: transactional SQL preserves legacy rows; unbaselined migrate deploy fails with P3005');
    }

    // No accept-data-loss/reset flags: both a legacy upgrade and post-SQL alignment must be safe.
    prisma(['db', 'push', '--skip-generate', '--schema', schema], url);
    assert.deepEqual(await snapshot(), before);
    const drift = spawnSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-url', url,
      '--to-schema-datamodel', schema, '--exit-code'], { cwd: backend, env: { ...env, DATABASE_URL: url },
      encoding: 'utf8', timeout: 60000 });
    assert.equal(drift.status, 0, `Schema drift after db push: ${drift.stdout}\n${drift.stderr}`);
    await db.$executeRaw`INSERT INTO "User" ("id", "email", "pseudo", "updatedAt")
      VALUES ('new-default', 'new@migration.test', 'NewDefault', CURRENT_TIMESTAMP)`;
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: 'new-default' } })).balance, 0n);
    const operation = { id: 'operation', actorId: 'player', scope: 'test', key: 'replay', fingerprint: 'payload',
      result: { success: true, balance: '123456' } };
    await db.financialOperation.create({ data: operation });
    await assert.rejects(db.financialOperation.create({ data: { ...operation, id: 'duplicate' } }), { code: 'P2002' });
    await assert.rejects(db.financialOperation.create({ data: { ...operation, id: 'orphan', actorId: 'missing' } }), { code: 'P2003' });
    const operations = await db.financialOperation.findMany();
    const after = await snapshot();
    prisma(['db', 'push', '--skip-generate', '--schema', schema], url);
    assert.deepEqual(await snapshot(), after);
    assert.deepEqual(await db.financialOperation.findMany(), operations);

    const backup = `${temp}/${mode}-backup.json`;
    run(process.execPath, [resolve(backend, 'scripts/backup.mjs'), backup], { env: { ...env, DATABASE_URL: url } });
    const saved = JSON.parse(await readFile(backup, 'utf8')).data;
    assert.deepEqual(Object.keys(saved).sort(), Prisma.dmmf.datamodel.models.map(model =>
      model.name[0].toLowerCase() + model.name.slice(1)).sort());
    assert.equal(saved.financialOperation.length, 1);
    assert.deepEqual(saved.financialOperation[0].result, operation.result);
    assert.deepEqual(saved.user.find(row => row.id === 'house').balance, { $bigint: '9007199254740993' });
    assert.deepEqual(saved.transaction[0].metadata, before.transaction[0].metadata);
    console.log(`PASS: ${mode} upgrade preserves rows, sets only new-user default to zero, enforces replay constraints, repeats safely and backs up every model`);
    await db.$disconnect();
    db = undefined;
  }
} finally {
  await db?.$disconnect();
  if (started) run(resolve(pgBin, 'pg_ctl'), ['-D', `${temp}/data`, '-m', 'fast', '-w', 'stop']);
  await rm(temp, { recursive: true, force: true });
}
