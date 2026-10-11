import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyRewardService } from './DailyRewardService.js';
import { ECONOMIC_DEFAULTS } from './EconomicSettings.js';
import { player, testDatabase } from '../admin/testSupport.js';

afterEach(() => { vi.useRealTimers(); });

describe('DailyRewardService economic policy', () => {
  it.each([7, 8, 29, 30, 31])('uses the advertised default at streak %s for both preview and claim', async streak => {
    const ctx = testDatabase({ user: [player], dailyReward: [{ userId: player.id, streak: streak - 1,
      lastClaim: new Date(Date.now() - 25 * 3600000) }] });
    const service = new DailyRewardService(ctx.db);
    const amount = streak >= 30 ? ECONOMIC_DEFAULTS.daily_reward_streak_30 : ECONOMIC_DEFAULTS.daily_reward_streak_7;
    expect(await service.getDailyReward(player.id)).toMatchObject({ available: true, streak, amount });
    expect(await service.claimDailyReward(player.id)).toEqual({ amount, streak, newBalance: 1000 + amount });
    expect(ctx.state.transaction[0]).toMatchObject({ userId: player.id, type: 'daily_reward', amount: BigInt(amount) });
    expect(ctx.state.systemSetting).toEqual([]);
  });

  it.each([[1, 'daily_reward_base', 1200], [7, 'daily_reward_streak_7', 4321],
    [30, 'daily_reward_streak_30', 12345]] as const)('uses persisted %s-day rewards consistently', async (streak, key, amount) => {
    const ctx = testDatabase({ user: [player], systemSetting: [{ key, value: amount }],
      dailyReward: streak === 1 ? [] : [{ userId: player.id, streak: streak - 1, lastClaim: new Date(Date.now() - 25 * 3600000) }] });
    const service = new DailyRewardService(ctx.db);
    expect(await service.getDailyReward(player.id)).toMatchObject({ amount });
    expect(await service.claimDailyReward(player.id)).toMatchObject({ amount, streak });
  });

  it('replays a keyed claim but keeps legacy no-key cooldown and atomic failure behavior', async () => {
    const ctx = testDatabase({ user: [player] });
    const service = new DailyRewardService(ctx.db);
    const first = await service.claimDailyReward(player.id, 'daily-1');
    expect(await service.claimDailyReward(player.id, 'daily-1')).toEqual(first);
    await expect(service.claimDailyReward(player.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(ctx.state.transaction).toHaveLength(1);
    expect(ctx.state.dailyReward).toHaveLength(1);
    const failing = testDatabase({ user: [player] });
    failing.mocks.dailyReward.upsert.mockRejectedValueOnce(new Error('claim write failed'));
    await expect(new DailyRewardService(failing.db).claimDailyReward(player.id, 'daily-2')).rejects.toThrow('claim write failed');
    expect(failing.state.user[0].balance).toBe(player.balance);
    expect(failing.state.transaction).toEqual([]);
    expect(failing.state.financialOperation).toEqual([]);
  });

  it('serializes concurrent first claims, including two requests using the same key', async () => {
    const ctx = testDatabase({ user: [player] });
    const service = new DailyRewardService(ctx.db);
    const results = await Promise.all([service.claimDailyReward(player.id, 'first'), service.claimDailyReward(player.id, 'first')]);
    expect(results[0]).toEqual(results[1]);
    expect(ctx.state.transaction).toHaveLength(1);
    const legacy = testDatabase({ user: [player] });
    const outcomes = await Promise.allSettled([new DailyRewardService(legacy.db).claimDailyReward(player.id),
      new DailyRewardService(legacy.db).claimDailyReward(player.id)]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(legacy.state.transaction).toHaveLength(1);
  });

  it('keeps rolling 24h and 48h boundaries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    const ctx = testDatabase({ user: [player], dailyReward: [{ userId: player.id, streak: 5,
      lastClaim: new Date(Date.now() - 86400000 + 1) }] });
    const service = new DailyRewardService(ctx.db);
    await expect(service.claimDailyReward(player.id)).rejects.toMatchObject({ statusCode: 409 });
    vi.advanceTimersByTime(1);
    expect(await service.claimDailyReward(player.id)).toMatchObject({ streak: 6 });
    vi.advanceTimersByTime(48 * 3600000);
    expect(await service.claimDailyReward(player.id)).toMatchObject({ streak: 1, amount: 1000 });
  });

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, '2500'])('rejects invalid persisted rewards %s before crediting', async value => {
    const ctx = testDatabase({ user: [player], systemSetting: [{ key: 'daily_reward_streak_7', value }] });
    await expect(new DailyRewardService(ctx.db).claimDailyReward(player.id)).rejects.toMatchObject({ statusCode: 500 });
    expect(ctx.state.user[0].balance).toBe(player.balance);
    expect(ctx.state.transaction).toEqual([]);
  });
});
