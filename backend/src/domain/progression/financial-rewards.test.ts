import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { LevelService } from './LevelService.js';
import { RaceService } from './RaceService.js';
import { TaskService } from './TaskService.js';
import progressionRoutes from '../../api/routes/progression.js';
import { player, testDatabase } from '../admin/testSupport.js';

const activeRace = () => ({ id: 'race', name: 'Test race', status: 'active', prize: { 1: 2500 },
  startAt: new Date(Date.now() - 3600000), endAt: new Date(Date.now() + 3600000) });
const completedRace = () => ({ ...activeRace(), status: 'completed', endAt: new Date(Date.now() - 1000) });
afterEach(() => { vi.useRealTimers(); });

describe('Race ranking and XP serialization', () => {
  it('locks Race before User and updates entries while holding that lock', async () => {
    const ctx = testDatabase({ user: [player], race: [activeRace()] });
    expect(await new LevelService(ctx.db).addXp(player.id, 25)).toMatchObject({ newXp: 25 });
    expect(ctx.mocks.race.updateMany.mock.invocationCallOrder[0]).toBeLessThan(ctx.mocks.user.updateMany.mock.invocationCallOrder[0]);
    expect(ctx.state.raceEntry[0]).toMatchObject({ raceId: 'race', userId: player.id, xp: 25 });
  });

  it.each(['completed', 'expired'])('rechecks a race after a lock wait when it becomes %s', async outcome => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    const ctx = testDatabase({ user: [player], race: [activeRace()] });
    ctx.mocks.race.updateMany.mockImplementationOnce(async () => {
      if (outcome === 'completed') ctx.state.race[0].status = 'completed';
      else vi.advanceTimersByTime(3600001);
      return { count: outcome === 'completed' ? 0 : 1 };
    });
    expect(await new LevelService(ctx.db).addXp(player.id, 25)).toMatchObject({ newXp: 25 });
    expect(ctx.state.raceEntry).toEqual([]);
    expect(ctx.mocks.raceEntry.upsert).not.toHaveBeenCalled();
  });

  it('freezes rank and prize at closure and never recalculates a promised prize', async () => {
    const race = { ...completedRace(), status: 'active' };
    const ctx = testDatabase({ user: [player], race: [race], raceEntry: [
      { id: 'entry', raceId: race.id, userId: player.id, xp: 50, rank: null, prize: 0, claimed: false },
    ] });
    const service = new RaceService(ctx.db);
    await service.getCurrentRace();
    expect(ctx.state.raceEntry[0]).toMatchObject({ rank: 1, prize: 2500 });
    expect(ctx.mocks.race.updateMany.mock.invocationCallOrder[0]).toBeLessThan(ctx.mocks.raceEntry.findMany.mock.invocationCallOrder[0]);
    ctx.state.race[0].prize = { 1: 99999 };
    expect(await service.getUserRank(player.id, race.id)).toEqual({ rank: 1, xp: 50, prize: 2500 });
    expect(await service.claimPrize(player.id, race.id, 'prize-1')).toBe(2500);
    expect(await service.claimPrize(player.id, race.id, 'prize-1')).toBe(2500);
    expect(ctx.state.transaction[0]).toMatchObject({ type: 'race_prize', amount: 2500n, reference: 'entry' });
    expect(ctx.state.transaction).toHaveLength(1);
    await expect(service.claimPrize(player.id, race.id)).rejects.toThrow('already claimed');
  });

  it('does not mint a prize for a zero-prize entry even if the map is later changed', async () => {
    const ctx = testDatabase({ user: [player], race: [completedRace()], raceEntry: [
      { id: 'entry', raceId: 'race', userId: player.id, xp: 10, rank: 1, prize: 0, claimed: false },
    ] });
    expect(await new RaceService(ctx.db).claimPrize(player.id, 'race')).toBe(0);
    expect(ctx.state.raceEntry[0].claimed).toBe(true);
    expect(ctx.state.transaction).toEqual([]);
    expect(ctx.state.user[0].balance).toBe(player.balance);
  });

  it('rejects an out-of-range prize before persisting completed ranking', async () => {
    const ctx = testDatabase({ user: [player], race: [{ ...completedRace(), status: 'active', prize: { 1: 2147483648 } }],
      raceEntry: [{ id: 'entry', raceId: 'race', userId: player.id, xp: 10, rank: null, prize: 0, claimed: false }] });
    await expect(new RaceService(ctx.db).getCurrentRace()).rejects.toMatchObject({ statusCode: 400 });
    expect(ctx.state.race[0].status).toBe('active');
    expect(ctx.state.raceEntry[0].rank).toBeNull();
  });
});

describe('Task financial rewards', () => {
  it('replays rewards and acquires Race before any User credit or XP lock', async () => {
    const ctx = testDatabase({ user: [player], race: [activeRace()],
      task: [{ id: 'task', title: 'Task', reward: { xp: 25, coins: 300 } }],
      userTask: [{ id: 'user-task', userId: player.id, taskId: 'task', completed: true, claimed: false, expiresAt: null }] });
    const service = new TaskService(ctx.db);
    const first = await service.claimTask(player.id, 'user-task', 'task-1');
    expect(first).toMatchObject({ xp: 25, coins: 300 });
    expect(await service.claimTask(player.id, 'user-task', 'task-1')).toEqual(first);
    expect(ctx.mocks.race.updateMany.mock.invocationCallOrder[0]).toBeLessThan(ctx.mocks.user.updateMany.mock.invocationCallOrder[0]);
    expect(ctx.state.user[0]).toMatchObject({ balance: 1300n, xp: 25 });
    expect(ctx.state.transaction).toHaveLength(1);
    expect(ctx.state.transaction[0]).toMatchObject({ type: 'task_reward', reference: 'user-task', amount: 300n });
    await expect(service.claimTask(player.id, 'user-task')).rejects.toThrow('already claimed');
  });

  it('rolls back claim, XP, race entry and balance on a journal failure', async () => {
    const ctx = testDatabase({ user: [player], race: [activeRace()],
      task: [{ id: 'task', title: 'Task', reward: { xp: 25, coins: 300 } }],
      userTask: [{ id: 'user-task', userId: player.id, taskId: 'task', completed: true, claimed: false, expiresAt: null }] });
    ctx.mocks.transaction.create.mockRejectedValueOnce(new Error('journal failed'));
    await expect(new TaskService(ctx.db).claimTask(player.id, 'user-task', 'task-failure')).rejects.toThrow('journal failed');
    expect(ctx.state.user[0]).toMatchObject({ balance: 1000n, xp: 0 });
    expect(ctx.state.raceEntry).toEqual([]);
    expect(ctx.state.userTask[0].claimed).toBe(false);
    expect(ctx.state.financialOperation).toEqual([]);
  });
});

describe('Progression HTTP financial retries', () => {
  it('forwards task claim keys and preserves the original response without crediting twice', async () => {
    const ctx = testDatabase({ user: [player], task: [{ id: 'task', title: 'Task', reward: { xp: 25, coins: 300 } }],
      userTask: [{ id: 'user-task', userId: player.id, taskId: 'task', completed: true, claimed: false, expiresAt: null }] });
    const app = Fastify();
    app.decorate('prisma', ctx.db);
    app.decorate('authenticate', async (request: any) => { request.user = { sub: player.id }; });
    await app.register(progressionRoutes);
    try {
      const request = { method: 'POST' as const, url: '/progression/tasks/user-task/claim', headers: { 'idempotency-key': 'http-task' } };
      const first = await app.inject(request);
      expect(first.statusCode).toBe(200);
      const retry = await app.inject(request);
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toEqual(first.json());
      expect(ctx.state.user[0]).toMatchObject({ balance: 1300n, xp: 25 });
      expect(ctx.state.transaction).toHaveLength(1);
    } finally { await app.close(); }
  });

  it('replays a race claim without an explicit raceId after its entry has been claimed', async () => {
    const ctx = testDatabase({ user: [player], race: [completedRace()], raceEntry: [
      { id: 'entry', raceId: 'race', userId: player.id, xp: 50, rank: 1, prize: 2500, claimed: false },
    ] });
    const app = Fastify();
    app.decorate('prisma', ctx.db);
    app.decorate('authenticate', async (request: any) => { request.user = { sub: player.id }; });
    await app.register(progressionRoutes);
    try {
      const request = { method: 'POST' as const, url: '/progression/race/claim', headers: { 'idempotency-key': 'http-prize' }, payload: {} };
      const first = await app.inject(request);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ prize: 2500 });
      const retry = await app.inject(request);
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toEqual(first.json());
      expect(ctx.state.transaction).toHaveLength(1);
      expect((await app.inject({ method: 'POST', url: '/progression/race/claim', payload: {} })).statusCode).toBe(400);
    } finally { await app.close(); }
  });
});
