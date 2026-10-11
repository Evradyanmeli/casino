import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const source = process.env.DATABASE_URL;
assert.ok(source, 'DATABASE_URL is required');
const schema = `casino_poker_bank_${Date.now()}_${randomBytes(4).toString('hex')}`;
assert.match(schema, /^casino_poker_bank_\d+_[0-9a-f]+$/);
const url = new URL(source);
url.searchParams.set('schema', schema);
const base = new PrismaClient({ datasources: { db: { url: source } } });
let db, services = [];
const results = [];
async function check(name, work) {
  await work(); results.push({ name, status: 'PASS' }); console.log(JSON.stringify(results.at(-1)));
}
try {
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const push = spawnSync(process.execPath, ['/app/node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--schema', '/app/prisma/schema.prisma'],
    { env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8' });
  assert.equal(push.status, 0, 'Isolated schema preparation failed');
  process.env.DATABASE_URL = url.toString();
  const { PokerService } = await import('/app/dist/domain/games/poker/PokerService.js');
  const { recoverInterruptedFunds } = await import('/app/dist/domain/games/Escrow.js');
  db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  async function reset(houseBalance = 6000) {
    services.forEach(service => service.dispose()); services = [];
    await db.gameSession.deleteMany(); await db.transaction.deleteMany(); await db.user.deleteMany();
    await db.user.createMany({ data: [
      { id: 'a', email: 'a@integration.test', pseudo: 'A', balance: 1000n },
      { id: 'b', email: 'b@integration.test', pseudo: 'B', balance: 1000n },
      { id: 'house', email: 'admin@casino.com', pseudo: 'House', role: 'ADMIN', balance: BigInt(houseBalance) },
    ] });
    const service = new PokerService(db); services.push(service); return service;
  }
  const balance = async id => (await db.user.findUniqueOrThrow({ where: { id } })).balance;
  const active = () => db.transaction.count({ where: { metadata: { path: ['escrowStatus'], equals: 'active' } } });
  await check('reserve-and-return-real-postgres-no-bot-users', async () => {
    const service = await reset();
    const [a, again] = await Promise.all([service.startBotGame('a', 200), service.startBotGame('a', 200)]);
    assert.equal(a.table.id, again.table.id);
    assert.equal(await balance('house'), 5400n); assert.equal(await balance('a'), 800n);
    assert.equal(await active(), 2); assert.equal(await db.user.count(), 3);
    await service.handleAction('a', a.table.id, 'raise', 40);
    await Promise.all([service.leaveTable('a', a.table.id), service.standUp('a', a.table.id)]);
    assert.equal(await balance('house'), 6040n); assert.equal(await balance('a'), 960n);
    assert.equal(await active(), 0); assert.equal(await db.user.count(), 3);
    assert.equal(await db.transaction.count({ where: { type: 'poker_bot_return' } }), 1);
  });
  await check('treasury-lock-prevents-overdraft-across-service-instances', async () => {
    const a = await reset(1000); const b = new PokerService(db); services.push(b);
    const settled = await Promise.allSettled([a.startBotGame('a', 200), b.startBotGame('b', 200)]);
    assert.equal(settled.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await balance('house'), 400n);
    assert.equal(await balance('a') + await balance('b'), 1800n);
    assert.equal(await db.transaction.count({ where: { type: 'poker_bot_funding' } }), 1);
  });
  await check('database-rejection-rolls-back-player-treasury-and-history', async () => {
    const service = await reset(); const state = await service.startBotGame('a', 200);
    await service.handleAction('a', state.table.id, 'raise', 40);
    await base.$executeRawUnsafe(`CREATE FUNCTION "${schema}".reject_bot_return() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'poker_bot_return' THEN RAISE EXCEPTION 'integration rejection'; END IF; RETURN NEW; END; $$`);
    await base.$executeRawUnsafe(`CREATE TRIGGER reject_bot_return BEFORE INSERT ON "${schema}"."Transaction" FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_bot_return()`);
    await assert.rejects(service.leaveTable('a', state.table.id));
    assert.equal(await balance('a'), 800n); assert.equal(await balance('house'), 5400n);
    assert.equal(await active(), 2); assert.equal(await db.gameSession.count(), 0);
    await base.$executeRawUnsafe(`DROP TRIGGER reject_bot_return ON "${schema}"."Transaction"`);
    await service.leaveTable('a', state.table.id);
    assert.equal(await balance('a'), 960n); assert.equal(await balance('house'), 6040n);
  });
  await check('restart-recovers-both-checkpoints-once-without-minting', async () => {
    const service = await reset(); const state = await service.startBotGame('a', 100);
    const table = service.tables.get(state.table.id);
    const ranks = ['2', '3', '4', '5'];
    table.players.forEach((player, i) => {
      player.chips = 60; player.totalBet = 40; player.currentBet = 40; player.folded = i === 0;
      player.holeCards = [{ suit: 'hearts', rank: ranks[i] }, { suit: 'clubs', rank: ranks[i] }];
    });
    table.communityCards = [{ suit: 'hearts', rank: 'A' }, { suit: 'clubs', rank: '7' }, { suit: 'diamonds', rank: '9' }, { suit: 'spades', rank: 'J' }, { suit: 'hearts', rank: 'K' }];
    table.phase = 'showdown'; table.pot = 160;
    await service.showdown(table); service.dispose();
    assert.deepEqual(await recoverInterruptedFunds(db), { wagers: 0, escrows: 2 });
    assert.equal(await balance('a'), 960n); assert.equal(await balance('house'), 6040n);
    assert.deepEqual(await recoverInterruptedFunds(db), { wagers: 0, escrows: 0 });
    assert.equal(await active(), 0); assert.equal(await db.user.count(), 3);
  });
  console.log(JSON.stringify({ schema, checks: results, productionAccountsCreated: 0 }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error.message).replaceAll(source, '[DATABASE_URL]') }));
  process.exitCode = 1;
} finally {
  services.forEach(service => service.dispose());
  if (db) await db.$disconnect();
  await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  if (process.env.POKER_TREASURY_REPORT) {
    await mkdir(dirname(process.env.POKER_TREASURY_REPORT), { recursive: true });
    await writeFile(process.env.POKER_TREASURY_REPORT, JSON.stringify({ schema, schemaRemoved: true,
      checks: results, passed: results.length, status: process.exitCode ? 'FAIL' : 'PASS', productionAccountsCreated: 0 }, null, 2));
  }
  await base.$disconnect();
}
