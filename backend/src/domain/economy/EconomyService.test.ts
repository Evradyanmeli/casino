import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { EconomyService } from './EconomyService.js';
import { DailyRewardService } from './DailyRewardService.js';
import { ShopService } from '../shop/ShopService.js';
import { ResponsibleGamingService } from '../rg/ResponsibleGamingService.js';
import rgRoutes from '../../api/routes/rg.js';
import shopRoutes from '../../api/routes/shop.js';

// In-memory transactional store, never a Prisma connection. Predicates are evaluated
// against current state at update time; the transaction queue models row-lock waiting.
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === 'AND') return (Array.isArray(condition) ? condition : [condition]).every(c => matches(row, c));
    if (key === 'OR') return condition.some((c: any) => matches(row, c));
    if (key === 'NOT') return !matches(row, condition);
    const value = row[key] ?? null;
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) return value === condition;
    if (condition.in && !condition.in.includes(value)) return false;
    if (condition.notIn && (value === null || condition.notIn.includes(value))) return false;
    if (condition.gte !== undefined && (value === null || value < condition.gte)) return false;
    if (condition.lte !== undefined && (value === null || value > condition.lte)) return false;
    if (condition.gt !== undefined && (value === null || value <= condition.gt)) return false;
    if (condition.contains !== undefined) {
      if (value === null) return false;
      return condition.mode === 'insensitive'
        ? value.toLowerCase().includes(condition.contains.toLowerCase())
        : value.includes(condition.contains);
    }
    return true;
  });
}

function mockDb(balance = 100n) {
  let state = {
    users: [{ id: 'u', balance, status: 'ACTIVE', birthDate: new Date('1990-01-01'), role: 'USER', email: 'u@example.test' }],
    transactions: [] as any[],
    rewards: [] as any[],
    limits: [] as any[],
    settings: [] as any[],
    configs: [] as any[],
    sessions: [] as any[],
  };
  const tx = {
    user: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const user of state.users) {
          if (!matches(user, where)) continue;
          user.balance += data.balance?.increment ?? 0n;
          user.balance -= data.balance?.decrement ?? 0n;
          count++;
        }
        return { count };
      }),
      findUnique: vi.fn(async ({ where }: any) => structuredClone(state.users.find(u => matches(u, where)) ?? null)),
      findFirst: vi.fn(async ({ where }: any) => structuredClone(state.users.find(u => matches(u, where)) ?? null)),
    },
    transaction: {
      create: vi.fn(async ({ data }: any) => {
        const row = { reference: null, description: null, createdAt: new Date(), ...data };
        state.transactions.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, take, skip = 0 }: any) => state.transactions.filter(t => matches(t, where)).slice(skip, skip + (take ?? 100))),
      aggregate: vi.fn(async ({ where }: any) => ({ _sum: {
        amount: state.transactions.filter(t => matches(t, where)).reduce((total, t) => total + t.amount, 0n),
      } })),
    },
    dailyReward: {
      findUnique: vi.fn(async ({ where }: any) => structuredClone(state.rewards.find(r => matches(r, where)) ?? null)),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = state.rewards.find(r => matches(r, where));
        if (row) return Object.assign(row, update);
        state.rewards.push(create);
        return create;
      }),
    },
    systemSetting: { findMany: vi.fn(async ({ where }: any) => state.settings.filter(s => matches(s, where))),
      findUnique: vi.fn(async ({ where }: any) => state.settings.find(s => matches(s, where)) ?? null) },
    gameConfig: { findUnique: vi.fn(async ({ where }: any) => state.configs.find(c => matches(c, where)) ?? null) },
    responsibleLimit: {
      findUnique: vi.fn(async ({ where }: any) => structuredClone(state.limits.find(l => matches(l, where)) ?? null)),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = state.limits.find(l => matches(l, where));
        if (row) return Object.assign(row, update);
        const created = {
          dailyLimit: null, weeklyLimit: null, monthlyLimit: null,
          lossDailyLimit: null, lossWeeklyLimit: null, lossMonthlyLimit: null,
          sessionLimitMinutes: null, realityCheckInterval: null, selfExcludeUntil: null,
          depositLimitEnabled: false, lossLimitEnabled: false, sessionLimitEnabled: false,
          realityCheckEnabled: false, selfExclusionEnabled: false, ...create,
        };
        state.limits.push(created);
        return created;
      }),
    },
    gameSession: { findFirst: vi.fn(async ({ where }: any) => state.sessions.filter(s => matches(s, where)).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null) },
  };
  let queue = Promise.resolve();
  const root = {
    ...tx,
    $transaction: vi.fn(async (work: (db: Prisma.TransactionClient) => Promise<any>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const snapshot = structuredClone(state);
      try {
        return await work(tx as unknown as Prisma.TransactionClient);
      } catch (error) {
        state = snapshot;
        throw error;
      } finally {
        release();
      }
    }),
  };
  return { db: root as unknown as PrismaClient, tx: tx as unknown as Prisma.TransactionClient, mocks: tx, root, state: () => state };
}

afterEach(() => { vi.useRealTimers(); });

describe('Economy atomicity and persisted types', () => {
  it('concurrent debits evaluate balance >= amount atomically, only one succeeds', async () => {
    const store = mockDb();
    const economy = new EconomyService(store.tx);
    const results = await Promise.allSettled([
      economy.deductBalance('u', 60n, 'bet'), economy.deductBalance('u', 60n, 'bet'),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(store.state().users[0].balance).toBe(40n);
    expect(store.state().transactions.map(t => t.amount)).toEqual([-60n]);
    expect(store.mocks.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u', balance: { gte: 60n } }, data: { balance: { decrement: 60n } },
    });
    expect(store.root.$transaction).not.toHaveBeenCalled();
  });

  it.each(['addBalance', 'deductBalance'] as const)('%s rolls balance back when journal fails', async method => {
    const store = mockDb();
    store.mocks.transaction.create.mockRejectedValueOnce(new Error('journal unavailable'));
    await expect(new EconomyService(store.db)[method]('u', 20n, 'test')).rejects.toThrow('journal unavailable');
    expect(store.state().users[0].balance).toBe(100n);
    expect(store.state().transactions).toEqual([]);
  });

  it('composes multiple writes in one caller transaction and rolls all of them back', async () => {
    const store = mockDb();
    await expect(new EconomyService(store.db).runInTransaction(async tx => {
      const service = new EconomyService(tx);
      await service.deductBalance('u', 30n, 'bet');
      await service.addBalance('u', 50n, 'win');
      throw new Error('game persistence failed');
    })).rejects.toThrow('game persistence failed');
    expect(store.root.$transaction).toHaveBeenCalledTimes(1);
    expect(store.state().users[0].balance).toBe(100n);
    expect(store.state().transactions).toEqual([]);
  });

  it.each([0n, -1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])('rejects invalid credit/debit amount %s before writes', async amount => {
    const store = mockDb();
    const service = new EconomyService(store.db);
    await expect(service.addBalance('u', amount, 'win')).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.deductBalance('u', amount, 'bet')).rejects.toMatchObject({ statusCode: 400 });
    expect(store.root.$transaction).not.toHaveBeenCalled();
  });

  it('prevents credit overflow and distinguishes missing accounts', async () => {
    const store = mockDb(BigInt(Number.MAX_SAFE_INTEGER));
    const service = new EconomyService(store.db);
    await expect(service.addBalance('u', 1n, 'win')).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.deductBalance('missing', 1n, 'bet')).rejects.toMatchObject({ statusCode: 404 });
    expect(store.state().transactions).toEqual([]);
  });

  it('filters legacy wins/bets, retains null fields and excludes old/new Poker cash-outs', async () => {
    const store = mockDb();
    for (const [type, description, reference] of [
      ['win', null, null], ['game_win', 'Limbo win', null],
      ['bet', null, null], ['game_bet', null, null], ['pokerbuyin', null, null], ['poker_buyin', null, null],
      ['win', 'Poker cash-out', null], ['win', null, 'poker_cashout'], ['poker_cashout', null, null], ['deposit', null, null],
    ]) store.state().transactions.push({ userId: 'u', type, description, reference, amount: 1n });
    const service = new EconomyService(store.db);
    expect((await service.getTransactions('u', 'win')).map(t => t.type)).toEqual(['win', 'game_win']);
    expect((await service.getTransactions('u', 'bet')).map(t => t.type)).toEqual(['bet', 'game_bet', 'pokerbuyin', 'poker_buyin']);
    expect(await service.getTransactions('u', 'all')).toHaveLength(10);
  });

  it('House balance reads and recharges the same account, atomically', async () => {
    const store = mockDb();
    store.state().users.push({ ...store.state().users[0], id: 'house', role: 'ADMIN', email: 'admin@casino.com', balance: 1000n });
    const service = new EconomyService(store.db);
    expect(await service.getHouseBalance()).toBe(1000n);
    await service.rechargeHouse(50n);
    expect(await service.getHouseBalance()).toBe(1050n);
    expect(store.state().transactions[0]).toMatchObject({ userId: 'house', type: 'house_recharge', amount: 50n });
    store.mocks.transaction.create.mockRejectedValueOnce(new Error('log failed'));
    await expect(service.rechargeHouse(50n)).rejects.toThrow('log failed');
    expect(await service.getHouseBalance()).toBe(1050n);
  });
});

describe('Daily reward', () => {
  it.each([false, true])('concurrent claims credit only once, existing record=%s', async existing => {
    const store = mockDb();
    if (existing) store.state().rewards.push({ userId: 'u', streak: 3, lastClaim: new Date(Date.now() - 25 * 3600000) });
    const service = new DailyRewardService(store.db);
    const results = await Promise.allSettled([service.claimDailyReward('u'), service.claimDailyReward('u')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } });
    expect(store.state().transactions).toHaveLength(1);
    expect(store.state().rewards).toHaveLength(1);
    expect(store.state().users[0].balance).toBe(100n + store.state().transactions[0].amount);
  });

  it('rolls back credit and journal if claim persistence fails', async () => {
    const store = mockDb();
    store.mocks.dailyReward.upsert.mockRejectedValueOnce(new Error('claim failed'));
    await expect(new DailyRewardService(store.db).claimDailyReward('u')).rejects.toThrow('claim failed');
    expect(store.state().users[0].balance).toBe(100n);
    expect(store.state().transactions).toEqual([]);
    expect(store.state().rewards).toEqual([]);
  });

  it.each([[1, 'daily_reward_base', 1234], [7, 'daily_reward_streak_7', 2345], [30, 'daily_reward_streak_30', 12345]])('uses setting at streak %s for info and claim', async (streak, key, amount) => {
    const store = mockDb();
    store.state().settings.push({ key, value: amount });
    if (streak > 1) store.state().rewards.push({ userId: 'u', streak: Number(streak) - 1, lastClaim: new Date(Date.now() - 25 * 3600000) });
    const service = new DailyRewardService(store.db);
    expect(await service.getDailyReward('u')).toMatchObject({ amount });
    expect(await service.claimDailyReward('u')).toMatchObject({ amount, streak });
  });

  it('keeps the rolling 24h boundary and resets streak after 48h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const store = mockDb();
    store.state().rewards.push({ userId: 'u', streak: 5, lastClaim: new Date(Date.now() - 86400000 + 1) });
    const service = new DailyRewardService(store.db);
    await expect(service.claimDailyReward('u')).rejects.toMatchObject({ statusCode: 409 });
    vi.advanceTimersByTime(1);
    expect(await service.claimDailyReward('u')).toMatchObject({ streak: 6 });
    vi.advanceTimersByTime(48 * 3600000);
    expect(await service.claimDailyReward('u')).toMatchObject({ streak: 1, amount: 1000 });
  });
});

describe('Responsible gaming and simulated purchases', () => {
  it('clears explicit null fields and disables without altering omitted values', async () => {
    const store = mockDb();
    const rg = new ResponsibleGamingService(store.db);
    await rg.updateDepositLimit('u', 100, 200, 300);
    await rg.updateDepositLimit('u', null, undefined, null, false);
    expect(store.state().limits[0]).toMatchObject({ dailyLimit: null, weeklyLimit: 200n, monthlyLimit: null, depositLimitEnabled: false });
    await rg.updateLossLimit('u', 100, 200, 300);
    await rg.updateLossLimit('u', null, null, null, false);
    await rg.updateSessionLimit('u', 60);
    await rg.updateSessionLimit('u', null, false);
    await rg.enableRealityCheck('u', 15);
    await rg.enableRealityCheck('u', null, false);
    expect(await rg.getSettings('u')).toMatchObject({
      depositLimit: { enabled: false }, lossLimit: { enabled: false },
      sessionLimit: { enabled: false }, realityCheck: { enabled: false },
    });
    expect(store.state().limits[0]).toMatchObject({ lossDailyLimit: null, lossWeeklyLimit: null, lossMonthlyLimit: null, sessionLimitMinutes: null, realityCheckInterval: null });
  });

  it('blocks inactive and self-excluded players including exclusion without end date; permits expired exclusion', async () => {
    const store = mockDb();
    const service = new EconomyService(store.db);
    store.state().users[0].status = 'SUSPENDED';
    await expect(service.assertCanPlay('u', 'limbo')).rejects.toMatchObject({ statusCode: 403 });
    store.state().users[0].status = 'ACTIVE';
    await new ResponsibleGamingService(store.db).setSelfExclusion('u', 1);
    await expect(service.assertCanPlay('u', 'limbo')).rejects.toMatchObject({ statusCode: 403 });
    await expect(new ShopService(store.db).purchasePackage('u', 'starter')).rejects.toMatchObject({ statusCode: 403 });
    store.state().limits[0].selfExcludeUntil = null;
    await expect(service.assertCanPlay('u', 'limbo')).rejects.toMatchObject({ statusCode: 403 });
    store.state().limits[0].selfExcludeUntil = new Date(Date.now() - 1);
    await expect(service.assertCanPlay('u', 'limbo')).resolves.toBeUndefined();
  });

  it('maps slots variants; applies stored min/max only when amount is provided', async () => {
    const store = mockDb();
    store.state().configs.push({ gameType: 'slots', active: true, minBet: 10n, maxBet: 100n }, { gameType: 'videopoker', active: true, minBet: 10n, maxBet: 100n });
    const service = new EconomyService(store.db);
    await expect(service.assertCanPlay('u', 'slots_fruits', 9n)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.assertCanPlay('u', 'slots-diamond', 10n)).resolves.toBeUndefined();
    await expect(service.assertCanPlay('u', 'slots_classic', 101n)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.assertCanPlay('u', 'videopoker', 1n)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.assertCanPlay('u', 'videopoker')).resolves.toBeUndefined();
    store.state().configs[0].active = false;
    await expect(service.assertCanPlay('u', 'slots_classic')).rejects.toMatchObject({ statusCode: 403 });
    expect(store.state().configs[1].minBet).toBe(10n);
  });

  it.each(['daily', 'weekly', 'monthly'] as const)('enforces %s deposit limit at exact package boundary, including concurrent purchases', async period => {
    const store = mockDb();
    const rg = new ResponsibleGamingService(store.db);
    await rg.updateDepositLimit('u', period === 'daily' ? 1000 : null, period === 'weekly' ? 1000 : null, period === 'monthly' ? 1000 : null);
    const shop = new ShopService(store.db);
    const results = await Promise.allSettled([shop.purchasePackage('u', 'starter'), shop.purchasePackage('u', 'starter')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { statusCode: 403 } });
    expect(store.state().users[0].balance).toBe(1100n);
    expect(store.state().transactions).toHaveLength(1);
  });

  it('counts bonuses in GC limits, ignores expired deposits, refuses unknown packs and rolls back failed journal', async () => {
    const store = mockDb();
    const shop = new ShopService(store.db);
    await new ResponsibleGamingService(store.db).updateDepositLimit('u', 14999);
    await expect(shop.purchasePackage('u', 'regular')).rejects.toMatchObject({ statusCode: 403 });
    await expect(shop.purchasePackage('u', 'unknown')).rejects.toMatchObject({ statusCode: 404 });
    await new ResponsibleGamingService(store.db).updateDepositLimit('u', 15000);
    store.state().transactions.push({ userId: 'u', type: 'deposit', amount: 15000n, createdAt: new Date(Date.now() - 25 * 3600000) });
    expect(await shop.purchasePackage('u', 'regular')).toMatchObject({ tokensAwarded: 15000, newBalance: 15100 });
    await new ResponsibleGamingService(store.db).updateDepositLimit('u', null, null, null, false);
    store.mocks.transaction.create.mockRejectedValueOnce(new Error('journal failed'));
    await expect(shop.purchasePackage('u', 'starter')).rejects.toThrow('journal failed');
    expect(store.state().users[0].balance).toBe(15100n);
    const packages = shop.getPackages();
    packages[0].tokens = -100;
    expect(shop.getPackages()[0].tokens).toBe(1000);
  });

  it.each([1, 7, 30])('enforces rolling %sd net loss and excludes non-game transactions', async days => {
    const store = mockDb();
    await new ResponsibleGamingService(store.db).updateLossLimit('u', days === 1 ? 60 : null, days === 7 ? 60 : null, days === 30 ? 60 : null);
    const now = new Date();
    store.state().transactions.push(
      { userId: 'u', type: 'game_bet', amount: -100n, createdAt: now },
      { userId: 'u', type: 'game_win', amount: 50n, createdAt: now },
      { userId: 'u', type: 'deposit', amount: 10000n, createdAt: now },
      { userId: 'u', type: 'bet', amount: -100n, createdAt: new Date(Date.now() - (days * 86400000 + 1000)) },
    );
    const service = new EconomyService(store.db);
    await expect(service.assertCanPlay('u', 'limbo', 10n)).resolves.toBeUndefined();
    await expect(service.assertCanPlay('u', 'limbo', 11n)).rejects.toMatchObject({ statusCode: 403 });
    store.state().transactions.push({ userId: 'u', type: 'bet', amount: -10n, createdAt: now });
    await expect(service.assertCanPlay('u', 'limbo')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('uses the login session clock and disabling releases the guard', async () => {
    const store = mockDb();
    const rg = new ResponsibleGamingService(store.db);
    await rg.updateSessionLimit('u', 60);
    const service = new EconomyService(store.db);
    await expect(service.assertCanPlay('u', 'limbo')).resolves.toBeUndefined();
    store.state().settings.push({ key: 'session_started:u', value: Date.now() - 61 * 60000 });
    await expect(service.assertCanPlay('u', 'limbo')).rejects.toMatchObject({ statusCode: 403 });
    await rg.updateSessionLimit('u', null, false);
    await expect(service.assertCanPlay('u', 'limbo')).resolves.toBeUndefined();
  });

  it('existing PUT APIs clear/disable and reject unsafe/non-positive numeric input', async () => {
    const store = mockDb();
    const app = Fastify();
    app.decorate('prisma', store.db);
    app.decorate('authenticate', async (request: any) => { request.user = { sub: 'u' }; });
    await app.register(rgRoutes);
    await app.register(shopRoutes);
    try {
      const depositUrl = '/responsible-gaming/deposit-limit';
      expect((await app.inject({ method: 'PUT', url: depositUrl, payload: { daily: 1000 } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'PUT', url: depositUrl, payload: { daily: null, enabled: false } })).statusCode).toBe(200);
      expect(store.state().limits[0]).toMatchObject({ dailyLimit: null, depositLimitEnabled: false });
      for (const [url, field] of [
        [depositUrl, 'daily'], ['/responsible-gaming/loss-limit', 'weekly'],
        ['/responsible-gaming/session-limit', 'minutes'], ['/responsible-gaming/reality-check', 'intervalMinutes'],
      ]) {
        expect((await app.inject({ method: 'PUT', url, payload: { [field]: null, enabled: false } })).statusCode).toBe(200);
        for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
          expect((await app.inject({ method: 'PUT', url, payload: { [field]: value } })).statusCode).toBe(400);
        }
      }
      expect((await app.inject({ method: 'POST', url: '/shop/purchase/unknown' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/shop/purchase/starter' })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
