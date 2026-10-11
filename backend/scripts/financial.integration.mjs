// Usage: npm run build && node scripts/financial.integration.mjs /usr/lib/postgresql/14/bin
// Own disposable PostgreSQL cluster. Never connects to the application DATABASE_URL.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pgBin = process.argv[2];
assert.ok(pgBin, 'Pass the PostgreSQL binary directory');
assert.notEqual(process.getuid?.(), 0, 'Run as a non-root user');
const temp = await mkdtemp('/tmp/opencode/casino-financial-');
const port = randomInt(20000, 60000);
const url = `postgresql://validator@127.0.0.1:${port}/postgres?schema=financial_test`;
const env = { ...process.env, DATABASE_URL: url, PGOPTIONS: '', PGPASSWORD: '' };
const results = [];
let started = false, db, second, app, authDb;
let services = [];
function run(command, args) {
  const result = spawnSync(command, args, { cwd: backend, env, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, `${command} failed: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
}
async function check(name, work) {
  await work(); results.push({ name, status: 'PASS' }); console.log(JSON.stringify(results.at(-1)));
}
try {
  run(resolve(pgBin, 'initdb'), ['-D', `${temp}/data`, '-A', 'trust', '-U', 'validator', '--no-locale']);
  run(resolve(pgBin, 'pg_ctl'), ['-D', `${temp}/data`, '-l', `${temp}/postgres.log`, '-w', 'start',
    '-o', `-h 127.0.0.1 -p ${port} -k ${temp}`]);
  started = true;
  run(process.execPath, [resolve(backend, 'node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate',
    '--schema', resolve(backend, 'prisma/schema.prisma')]);
  process.env.DATABASE_URL = url;
  db = new PrismaClient({ datasources: { db: { url } } });
  second = new PrismaClient({ datasources: { db: { url } } });
  const { openWager, increaseWager, settleWager, instantWager } = await import('../dist/domain/games/GameSupport.js');
  const { recoverInterruptedFunds } = await import('../dist/domain/games/Escrow.js');
  const { runFinancialOperation } = await import('../dist/domain/economy/FinancialOperation.js');
  const { EconomyService } = await import('../dist/domain/economy/EconomyService.js');
  const { BlackjackService } = await import('../dist/domain/games/blackjack/BlackjackService.js');
  const { CrapsService } = await import('../dist/domain/games/craps/CrapsService.js');
  const { MinesService } = await import('../dist/domain/games/mines/MinesService.js');
  const { VideoPokerService } = await import('../dist/domain/games/videopoker/VideoPokerService.js');
  const { CrashService } = await import('../dist/domain/games/crash/CrashService.js');
  const { BingoService } = await import('../dist/domain/games/bingo/BingoService.js');
  const { PokerService } = await import('../dist/domain/games/poker/PokerService.js');
  const { AdminService } = await import('../dist/domain/admin/AdminService.js');
  const { ShopService } = await import('../dist/domain/shop/ShopService.js');
  const { DailyRewardService } = await import('../dist/domain/economy/DailyRewardService.js');
  const { TaskService } = await import('../dist/domain/progression/TaskService.js');
  const { RaceService } = await import('../dist/domain/progression/RaceService.js');
  const { AuthService } = await import('../dist/domain/auth/AuthService.js');
  ({ prisma: authDb } = await import('../dist/infrastructure/database/prisma.js'));
  const { default: gamesRoutes } = await import('../dist/api/routes/games.js');
  const balance = async id => (await db.user.findUniqueOrThrow({ where: { id } })).balance;
  const active = () => db.transaction.findMany({ where: { metadata: { path: ['escrowStatus'], equals: 'active' } } });
  async function total() {
    const wallets = await db.user.aggregate({ _sum: { balance: true } });
    const reserves = (await active()).reduce((sum, entry) => sum + BigInt(entry.metadata.escrowAmount), 0n);
    const pending = await db.gameSession.aggregate({ where: { resultData: { path: ['status'], equals: 'pending' } }, _sum: { betAmount: true } });
    return (wallets._sum.balance ?? 0n) + reserves + (pending._sum.betAmount ?? 0n);
  }
  async function reset(houseBalance = 10000000n) {
    await app?.close(); app = undefined;
    services.forEach(service => service.dispose?.() ?? service.close?.()); services = [];
    for (const name of ['financialOperation', 'userTask', 'task', 'raceEntry', 'race', 'gameSession', 'transaction', 'auditLog', 'systemSetting', 'user']) {
      await db[name].deleteMany();
    }
    await db.user.createMany({ data: [
      { id: 'a', email: 'a@integration.test', pseudo: 'A', balance: 1000n },
      { id: 'b', email: 'b@integration.test', pseudo: 'B', balance: 1000n },
      { id: 'house', email: 'admin@casino.com', pseudo: 'House', role: 'ADMIN', balance: houseBalance },
    ] });
  }
  async function rejectJournal(type, work) {
    assert.match(type, /^[a-z_]+$/);
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION financial_test.reject_journal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = '${type}' THEN RAISE EXCEPTION 'integration rejection'; END IF; RETURN NEW; END; $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER reject_journal BEFORE INSERT ON financial_test."Transaction" FOR EACH ROW EXECUTE FUNCTION financial_test.reject_journal()');
    try { await work(); } finally { await db.$executeRawUnsafe('DROP TRIGGER reject_journal ON financial_test."Transaction"'); }
  }
  await check('insufficient-liquidity-rejects-before-changing-ledger', async () => {
    await reset(19n);
    await assert.rejects(db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30)), /Caisse insuffisante/);
    assert.equal(await balance('a'), 1000n); assert.equal(await balance('house'), 19n);
    assert.equal(await db.gameSession.count(), 0); assert.equal(await db.transaction.count(), 0);
  });
  await check('parallel-clients-cannot-overdraw-treasury', async () => {
    await reset(30n);
    const attempts = await Promise.allSettled([db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30)),
      second.$transaction(tx => openWager(tx, 'b', 'blackjack', 10, 30))]);
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await balance('house'), 10n); assert.equal(await total(), 2030n);
  });
  await check('parallel-increases-use-current-wager-and-reserve', async () => {
    await reset(); const before = await total();
    const id = await db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30));
    await Promise.all([db.$transaction(tx => increaseWager(tx, id, 'a', 'blackjack', 10)),
      second.$transaction(tx => increaseWager(tx, id, 'a', 'blackjack', 10))]);
    const wager = await db.gameSession.findUniqueOrThrow({ where: { id } });
    assert.equal(wager.betAmount, 30n); assert.equal(wager.resultData.bank.reserved, 60);
    assert.equal(wager.resultData.bank.maximumPayout, 90); assert.equal(await total(), before);
    await db.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 90, {}));
    assert.equal(await balance('a'), 1060n); assert.equal(await total(), before);
  });
  await check('settlement-is-durable-once-across-clients', async () => {
    await reset(); const before = await total();
    const id = await db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30));
    const paid = await Promise.allSettled([db.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 30, {})),
      second.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 30, {}))]);
    assert.equal(paid.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await balance('a'), 1020n); assert.equal((await active()).length, 0); assert.equal(await total(), before);
  });
  await check('settlement-journal-failure-and-overpayment-roll-back', async () => {
    await reset(); const before = await total();
    const id = await db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30));
    await assert.rejects(db.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 31, {})), /reserved liability/);
    await rejectJournal('game_house_settlement', async () => {
      await assert.rejects(db.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 20, {})), /integration rejection/);
      assert.equal(await balance('a'), 990n); assert.equal((await active()).length, 1);
      assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id } })).resultData.status, 'pending');
    });
    await db.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 20, {}));
    assert.equal(await total(), before);
  });
  await check('interruption-refunds-stake-and-increased-reserve-atomically-once', async () => {
    await reset(); const before = await total();
    const id = await db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30));
    await db.$transaction(tx => increaseWager(tx, id, 'a', 'blackjack', 10));
    await rejectJournal('refund', async () => {
      await assert.rejects(recoverInterruptedFunds(db), /integration rejection/);
      assert.equal(await balance('a'), 980n); assert.equal((await active()).length, 1);
      assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id } })).resultData.status, 'pending');
    });
    const recovered = await Promise.all([recoverInterruptedFunds(db), recoverInterruptedFunds(second)]);
    assert.equal(recovered.reduce((sum, r) => sum + r.wagers, 0), 1);
    assert.equal(recovered.reduce((sum, r) => sum + r.escrows, 0), 1);
    assert.equal(await balance('a'), 1000n); assert.equal(await total(), before);
    assert.deepEqual(await recoverInterruptedFunds(db), { wagers: 0, escrows: 0 });
  });
  await check('idempotency-serializes-parallel-clients-and-rejects-payload-conflict', async () => {
    await reset(); let performed = 0;
    const work = tx => { performed++; return instantWager(tx, 'a', 'roulette', 10, async () => ({ payout: 360 }), r => r.payout, 360); };
    const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => runFinancialOperation(i % 2 ? second : db,
      'a', 'test_spin', 'same-key', i % 2 ? { bet: 10, positions: [1] } : { positions: [1], bet: 10 }, work)));
    responses.forEach(r => assert.deepEqual(r, responses[0])); assert.equal(performed, 1);
    assert.equal(await db.gameSession.count(), 1); assert.equal(await db.financialOperation.count(), 1);
    await assert.rejects(runFinancialOperation(second, 'a', 'test_spin', 'same-key', { bet: 20 }, work), /different operation/);
    assert.equal(await balance('a'), 1350n); assert.equal(performed, 1);
  });
  await check('failed-operation-does-not-consume-key-or-mint-chips', async () => {
    await reset(); const before = await total();
    await assert.rejects(runFinancialOperation(db, 'a', 'test_spin', 'retry', {}, tx =>
      instantWager(tx, 'a', 'roulette', 10, async () => { throw Error('engine rejected'); }, r => r.payout, 360)));
    assert.equal(await db.financialOperation.count(), 0); assert.equal(await db.transaction.count(), 0);
    await runFinancialOperation(db, 'a', 'test_spin', 'retry', {}, tx => instantWager(tx, 'a', 'roulette', 10,
      async () => ({ payout: 0 }), r => r.payout, 360));
    assert.equal(await db.financialOperation.count(), 1); assert.equal(await total(), before);
  });
  const instantGames = [
    ['limbo/play', { bet: 10, targetMultiplier: 2 }],
    ...['classic', 'fruit', 'diamond'].map(variant => ['slots/spin', { variant, bet: 1 }]),
    ['roulette/spin', { bets: [{ type: 'straight', positions: [1], amount: 10 }] }],
    ['wheel/spin', { bet: 10 }], ['keno/play', { bet: 10, numbers: [1, 2, 3] }],
    ['plinko/drop', { bet: 10, risk: 'high', rows: 16 }],
  ];
  for (const [path, payload] of instantGames) await check(`http-${path.replace('/', '-')}-${payload.variant ?? 'conservation-and-replay'}`, async () => {
    await reset(); const before = await total();
    app = Fastify(); app.decorate('prisma', db);
    app.decorate('authenticate', async request => { request.user = { sub: 'a' }; });
    await app.register(gamesRoutes);
    const request = { method: 'POST', url: `/games/${path}`, payload, headers: { 'idempotency-key': 'http-spin' } };
    const first = await app.inject(request); assert.equal(first.statusCode, 200, first.body);
    const history = await db.transaction.count(); const xp = (await db.user.findUniqueOrThrow({ where: { id: 'a' } })).xp;
    const replay = await app.inject(request); assert.equal(replay.statusCode, 200, replay.body);
    assert.deepEqual(replay.json(), first.json()); assert.equal(await db.transaction.count(), history);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: 'a' } })).xp, xp);
    assert.equal(await db.gameSession.count(), 1); assert.equal((await active()).length, 0); assert.equal(await total(), before);
  });
  const card = (rank, suit = 'hearts') => ({ rank, suit });
  await check('blackjack-split-settles-covered-gains-and-replays-after-pruning', async () => {
    await reset(); const before = await total(); const service = new BlackjackService(db, new EconomyService(db));
    let initial;
    for (let i = 0; i < 100; i++) { initial = await service.startRound('a', 10); if (initial.state === 'playing') break; }
    assert.equal(initial.state, 'playing'); const s = service.sessions.get(initial.sessionId);
    Object.assign(s.hands[0], { cards: [card('8'), card('8', 'clubs')], value: 16, isBlackjack: false, isStanding: false });
    s.dealerCards = [card('10'), card('7')]; s.shoe.push(card('10'), card('10')); s.insuranceAvailable = false;
    const split = await service.split('a', initial.sessionId, 0, 'split-key');
    await service.stand('a', initial.sessionId, 0); const final = await service.stand('a', initial.sessionId, 1);
    assert.equal(final.payout, 40); assert.equal(await total(), before);
    service.sessions.clear();
    assert.deepEqual(await new BlackjackService(second, new EconomyService(second)).split('a', initial.sessionId, 0, 'split-key'), split);
    await assert.rejects(service.split('a', initial.sessionId, 1, 'split-key'), /different operation/);
  });
  await check('craps-odds-remain-covered-and-replay-after-resolution', async () => {
    await reset(); const before = await total(); const service = new CrapsService(db); let initial;
    for (let i = 0; i < 100; i++) { initial = await service.startRound('a', 10); if (initial.state === 'playing') break; }
    assert.equal(initial.state, 'playing');
    const odds = await service.addOdds('a', initial.sessionId, 30, 'odds-key');
    const internal = service.sessions.get(initial.sessionId);
    assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id: internal.wagerId } })).resultData.bank.maximumPayout, 120);
    for (let i = 0; i < 1000 && service.getState('a'); i++) await service.roll('a', initial.sessionId);
    assert.equal(service.getState('a'), null); assert.equal(await total(), before);
    assert.deepEqual(await new CrapsService(second).addOdds('a', initial.sessionId, 30, 'odds-key'), odds);
  });
  await check('mines-maximum-legal-win-is-covered-without-minting', async () => {
    await reset(); const before = await total(); const service = new MinesService(db);
    const initial = await service.startGame('a', 10, 1, 'mines-key');
    const internal = service.sessions.get(initial.sessionId); let final;
    for (const tile of internal.state.grid.flat().filter(tile => !tile.isMine)) final = await service.revealTile('a', initial.sessionId, tile.index);
    assert.equal(final.state, 'won'); assert.equal(final.payout, 245); assert.equal(await total(), before);
    assert.equal((await active()).length, 0);
    assert.deepEqual(await service.startGame('a', 10, 1, 'mines-key'), initial);
  });
  await check('video-poker-max-bet-royal-flush-is-covered-and-paid-once', async () => {
    await reset(); const before = await total(); const service = new VideoPokerService(db, new EconomyService(db));
    const initial = await service.deal('a', 5, 'vp-key');
    service.sessions.get(initial.sessionId).hand = ['10', 'J', 'Q', 'K', 'A'].map(rank => card(rank));
    const final = await service.draw('a', initial.sessionId, [true, true, true, true, true]);
    assert.equal(final.payout, 4000); assert.equal(await total(), before);
    assert.deepEqual(await service.draw('a', initial.sessionId, [true, true, true, true, true]), final);
  });
  await check('crash-reserve-cashout-and-repeated-cashout-conserve-chips', async () => {
    await reset(); const before = await total(); const service = new CrashService(db); services.push(service);
    const initial = await service.placeBet('a', 10, undefined, 'crash-key');
    assert.equal((await active())[0].metadata.escrowAmount, '9990');
    Object.assign(service.round, { state: 'running', crashPoint: 1000, startedAt: Date.now() - 4000 });
    const paid = await service.cashOut('a'); assert.ok(paid.players[0].payout > 10);
    assert.deepEqual(await service.cashOut('a'), paid); assert.equal(await total(), before);
    assert.deepEqual(await service.placeBet('a', 10, undefined, 'crash-key'), initial);
  });
  await check('bingo-prize-plus-house-commission-equals-funded-pool', async () => {
    await reset(); const before = await total(); const service = new BingoService(db); services.push(service);
    const room = await service.createRoom('line', 10, 2);
    await Promise.all([service.joinRoom('a', 'A', room.id), service.joinRoom('b', 'B', room.id)]);
    await service.startGame(room.id, 'a'); service.stopInterval(room.id);
    service.rooms.get(room.id).calledNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    assert.deepEqual(await service.callBingo('a', room.id), { valid: true, prize: 19 });
    assert.equal(await balance('house'), 10000001n); assert.equal((await active()).length, 0);
    assert.equal(await total(), before); assert.equal(await db.gameSession.count(), 2);
    assert.deepEqual(await service.callBingo('a', room.id), { valid: false, prize: 0 });
  });
  await check('public-poker-buyin-and-leave-transfer-only-existing-chips', async () => {
    await reset(); const before = await total(); const service = new PokerService(db); services.push(service);
    const table = await service.createTable('Public integration', 5, 6);
    await service.joinTable('a', table.id); await service.sitDown('a', table.id, 0, 200);
    assert.equal(await total(), before); assert.equal(await balance('house'), 10000000n);
    await service.leaveTable('a', table.id); assert.equal(await balance('a'), 1000n);
    assert.equal((await active()).length, 0); assert.equal(await total(), before);
  });
  await check('poker-bot-funding-and-return-have-no-persisted-bot-users', async () => {
    await reset(6000n); const before = await total(); const service = new PokerService(db); services.push(service);
    const state = await service.startBotGame('a', 200);
    assert.equal(await balance('house'), 5400n); assert.equal(await total(), before);
    await service.handleAction('a', state.table.id, 'raise', 40);
    await service.leaveTable('a', state.table.id);
    assert.equal(await balance('house'), 6040n); assert.equal(await balance('a'), 960n);
    assert.equal(await db.user.count(), 3); assert.equal(await total(), before); assert.equal((await active()).length, 0);
  });
  await check('treasury-report-includes-all-house-reserves-without-double-counting', async () => {
    await reset(6000n); const service = new PokerService(db); services.push(service);
    await service.startBotGame('a', 100);
    await db.$transaction(tx => openWager(tx, 'b', 'blackjack', 10, 30));
    const treasury = await new AdminService(db).getHouseBalance();
    assert.equal(treasury.balance, 5680); assert.equal(treasury.reservedBots, 300);
    assert.equal(treasury.reservedGames, 20); assert.equal(treasury.totalBalance, 6000);
  });
  await check('rewards-shop-and-admin-are-explicit-replay-safe-issuance', async () => {
    await reset(6000n); const before = await total();
    const shop = new ShopService(db); const daily = new DailyRewardService(db); const admin = new AdminService(db);
    const purchase = await shop.purchasePackage('a', 'starter', 'purchase');
    assert.deepEqual(await new ShopService(second).purchasePackage('a', 'starter', 'purchase'), purchase);
    const reward = await daily.claimDailyReward('a', 'daily');
    assert.deepEqual(await new DailyRewardService(second).claimDailyReward('a', 'daily'), reward);
    await db.task.create({ data: { id: 'task', slug: 'integration', title: 'Integration', description: 'Isolated reward fixture', type: 'daily', condition: {}, reward: { xp: 0, coins: 200 } } });
    await db.userTask.create({ data: { id: 'ut', userId: 'a', taskId: 'task', completed: true } });
    const task = await new TaskService(db).claimTask('a', 'ut', 'task');
    assert.deepEqual(await new TaskService(second).claimTask('a', 'ut', 'task'), task);
    await db.race.create({ data: { id: 'race', name: 'Integration', startAt: new Date(0), endAt: new Date(1000), status: 'completed', prize: { '1': 9999 } } });
    await db.raceEntry.create({ data: { raceId: 'race', userId: 'a', rank: 1, prize: 300 } });
    assert.equal(await new RaceService(db).claimPrize('a', 'race', 'race'), 300);
    assert.equal(await new RaceService(second).claimPrize('a', 'race', 'race'), 300);
    await admin.adjustUserBalance('a', 50, 'integration issuance', 'house', 'adjust');
    await admin.adjustUserBalance('a', 50, 'integration issuance', 'house', 'adjust');
    await admin.rechargeHouse(100, 'house', 'recharge'); await admin.rechargeHouse(100, 'house', 'recharge');
    const issuance = 1000n + BigInt(reward.amount) + 200n + 300n + 50n + 100n;
    assert.equal(await total(), before + issuance); assert.equal(await balance('house'), 6100n);
    const ledger = await db.transaction.aggregate({ _sum: { amount: true } }); assert.equal(ledger._sum.amount, issuance);
    assert.equal(await db.transaction.count(), 6); assert.equal(await db.auditLog.count(), 2);
  });
  await check('welcome-bonus-issuance-and-registration-rollback-are-journaled', async () => {
    await reset(6000n); const before = await total(); const auth = new AuthService();
    await db.systemSetting.create({ data: { key: 'welcome_bonus', value: 321 } });
    await rejectJournal('welcome_bonus', async () => {
      await assert.rejects(auth.register('new@integration.test', 'New', 'IsolatedPassword123!', '1990-01-01'), /integration rejection/);
      assert.equal(await db.user.count(), 3); assert.equal(await total(), before);
    });
    const user = await auth.register('new@integration.test', 'New', 'IsolatedPassword123!', '1990-01-01');
    assert.equal(user.balance, 321n); assert.equal(await total(), before + 321n);
    const entry = await db.transaction.findFirstOrThrow();
    assert.equal(entry.type, 'welcome_bonus'); assert.equal(entry.amount, 321n);
    await assert.rejects(auth.register('new@integration.test', 'New', 'IsolatedPassword123!', '1990-01-01'), /already registered/);
    assert.equal(await db.transaction.count(), 1); assert.equal(await balance('house'), 6000n);
  });
  await check('daily-claim-and-deposit-limits-survive-distinct-concurrent-keys', async () => {
    await reset(6000n);
    const claims = await Promise.allSettled([new DailyRewardService(db).claimDailyReward('a', 'daily-a'),
      new DailyRewardService(second).claimDailyReward('a', 'daily-b')]);
    assert.equal(claims.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await db.transaction.count({ where: { type: 'daily_reward' } }), 1);
    assert.equal(await db.financialOperation.count({ where: { scope: 'daily_reward' } }), 1);
    await db.responsibleLimit.create({ data: { userId: 'a', depositLimitEnabled: true, dailyLimit: 1500n } });
    const purchases = await Promise.allSettled([new ShopService(db).purchasePackage('a', 'starter', 'shop-a'),
      new ShopService(second).purchasePackage('a', 'starter', 'shop-b')]);
    assert.equal(purchases.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await db.transaction.count({ where: { type: 'deposit' } }), 1);
    assert.equal(await balance('house'), 6000n);
  });
  await check('pending-stakes-count-toward-loss-limit-but-exclusion-does-not-block-settlement', async () => {
    await reset(6000n); const before = await total();
    await db.responsibleLimit.create({ data: { userId: 'a', lossLimitEnabled: true, lossDailyLimit: 15n } });
    const id = await db.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30));
    await assert.rejects(second.$transaction(tx => openWager(tx, 'a', 'blackjack', 10, 30)), /Loss limit/);
    assert.equal(await db.gameSession.count(), 1);
    await db.responsibleLimit.update({ where: { userId: 'a' }, data: { selfExclusionEnabled: true } });
    await db.$transaction(tx => settleWager(tx, id, 'a', 'blackjack', 20, {}));
    assert.equal(await balance('a'), 1010n); assert.equal(await total(), before);
  });
  await check('http-game-stats-exclude-pending-and-interruption-refunds', async () => {
    await reset();
    await db.$transaction(tx => openWager(tx, 'a', 'mines', 10, 30));
    const settled = await db.$transaction(tx => openWager(tx, 'a', 'mines', 10, 30));
    await db.$transaction(tx => settleWager(tx, settled, 'a', 'mines', 20, {}));
    app = Fastify(); app.decorate('prisma', db);
    app.decorate('authenticate', async request => { request.user = { sub: 'a' }; });
    await app.register(gamesRoutes);
    const first = await app.inject({ method: 'GET', url: '/games/mines/stats' });
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.json(), { game: 'mines', playCount: 1, totalBet: 10, totalWin: 20 });
    await recoverInterruptedFunds(db);
    const after = await app.inject({ method: 'GET', url: '/games/mines/stats' });
    assert.deepEqual(after.json(), first.json());
  });
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  await app?.close(); services.forEach(service => service.dispose?.() ?? service.close?.());
  await db?.$disconnect(); await second?.$disconnect(); await authDb?.$disconnect();
  if (started) run(resolve(pgBin, 'pg_ctl'), ['-D', `${temp}/data`, '-m', 'fast', '-w', 'stop']);
  await rm(temp, { recursive: true, force: true });
  const report = { status: process.exitCode ? 'FAIL' : 'PASS', checks: results, passed: results.length,
    isolatedClusterRemoved: true, productionDatabaseTouched: false, productionAccountsCreated: 0 };
  if (process.env.FINANCIAL_REPORT) await writeFile(process.env.FINANCIAL_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
