import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDatabase, player } from '../admin/testSupport.js';
import { EconomyService } from '../economy/EconomyService.js';
import { BlackjackService } from './blackjack/BlackjackService.js';
import { CrapsService } from './craps/CrapsService.js';

vi.mock('node:crypto', async original => ({ ...await original<typeof import('node:crypto')>(),
  randomInt: (min: number, max?: number) => max === undefined ? min - 1 : 2,
}));
const database = () => testDatabase({ user: [player, { ...player, id: 'house', role: 'ADMIN', email: 'admin@casino.com', balance: 1000000000000n }] });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function blackjackRound(ctx: ReturnType<typeof database>, action: 'split' | 'insurance' | 'double') {
  const service = new BlackjackService(ctx.db, new EconomyService(ctx.db));
  const initial = await service.startRound(player.id, 10);
  const id = initial.sessionId;
  const internal = (service as any).sessions.get(id);
  internal.dealerCards = [{ suit: 'hearts', rank: action === 'insurance' ? 'A' : '10' }, { suit: 'clubs', rank: '7' }];
  internal.hands[0].cards = [{ suit: 'hearts', rank: '8' }, { suit: 'clubs', rank: '8' }];
  internal.hands[0].value = 16;
  internal.insuranceAvailable = action === 'insurance';
  internal.shoe = Array.from({ length: 20 }, () => ({ suit: 'clubs', rank: '2' }));
  if (action === 'double') await service.split(player.id, id, 0);
  const invoke = (target = service, value = action === 'insurance' ? 5 : 0, sessionId = id) =>
    action === 'insurance' ? target.insurance(player.id, sessionId, value, 'action') :
    action === 'split' ? target.split(player.id, sessionId, value, 'action') :
    target.doubleDown(player.id, sessionId, value, 'action');
  return { service, id, invoke };
}

describe('Durable action idempotency', () => {
  it.each(['split', 'insurance', 'double'] as const)('replays blackjack %s after later actions, restart and pruning', async action => {
    const ctx = database();
    const { service, id, invoke } = await blackjackRound(ctx, action);
    const result = await invoke();
    expect(result.state).toBe('playing');

    const restarted = new BlackjackService(ctx.db, new EconomyService(ctx.db));
    expect(await invoke(restarted)).toEqual(result);
    expect(restarted.getState(player.id, id)).toBeNull();

    if (action !== 'double') {
      const later = action === 'split' ? await service.stand(player.id, id, 0) : await service.hit(player.id, id, 0);
      expect(later).not.toEqual(result);
      const saved = structuredClone(ctx.state);
      expect(await invoke()).toEqual(result);
      expect(service.getState(player.id, id)).toEqual(later);
      expect(ctx.state).toEqual(saved);
    }

    const complete = await service.stand(player.id, id, action === 'insurance' ? 0 : 1);
    expect(complete.state).toBe('complete');
    const saved = structuredClone(ctx.state);
    expect(await invoke()).toEqual(result);
    expect(service.getState(player.id, id)).toEqual(complete);
    expect(await service.stand(player.id, id, 0)).toEqual(complete);
    expect(await service.hit(player.id, id, 0)).toEqual(complete);
    expect(ctx.state).toEqual(saved);

    await vi.advanceTimersByTimeAsync(600000);
    expect(service.getState(player.id, id)).toBeNull();
    expect(await invoke()).toEqual(result);
    expect(await invoke(restarted)).toEqual(result);
    expect(service.getState(player.id, id)).toBeNull();
    // Conflicts must be checked even when the original session no longer exists.
    await expect(invoke(restarted, action === 'insurance' ? 4 : 1)).rejects.toMatchObject({ statusCode: 409 });
    await expect(invoke(restarted, action === 'insurance' ? 5 : 0, 'other-session')).rejects.toMatchObject({ statusCode: 409 });
    // Replays refresh updatedAt, but must not change financial data or stored results.
    expect(ctx.state).toMatchObject({ ...saved,
      financialOperation: saved.financialOperation.map(({ updatedAt, ...operation }) => operation) });
  });

  it('replays craps odds after more odds, resolution, restart and pruning', async () => {
    const ctx = database(); const service = new CrapsService(ctx.db);
    const initial = await service.startRound(player.id, 10);
    expect(initial).toMatchObject({ state: 'playing', point: 4 });
    const id = initial.sessionId;
    const result = await service.addOdds(player.id, id, 5, 'odds');
    const restarted = new CrapsService(ctx.db);
    expect(await restarted.addOdds(player.id, id, 5, 'odds')).toEqual(result);
    expect(restarted.getState(player.id)).toBeNull();

    const later = await service.addOdds(player.id, id, 3, 'more-odds');
    let saved = structuredClone(ctx.state);
    expect(await service.addOdds(player.id, id, 5, 'odds')).toEqual(result);
    expect(service.getState(player.id)).toEqual(later);
    expect(ctx.state).toEqual(saved);

    const complete = await service.roll(player.id, id);
    expect(complete).toMatchObject({ state: 'won', phase: 'resolved', oddsBet: 8 });
    saved = structuredClone(ctx.state);
    expect(await service.addOdds(player.id, id, 5, 'odds')).toEqual(result);
    expect(await service.roll(player.id, id)).toEqual(complete);
    await expect(service.addOdds(player.id, id, 1)).rejects.toThrow('Round already resolved');
    await expect(service.addOdds(player.id, id, 4, 'odds')).rejects.toMatchObject({ statusCode: 409 });
    expect(ctx.state).toEqual(saved);

    await vi.advanceTimersByTimeAsync(600000);
    expect(await service.addOdds(player.id, id, 5, 'odds')).toEqual(result);
    expect(await restarted.addOdds(player.id, id, 5, 'odds')).toEqual(result);
    await expect(restarted.addOdds(player.id, id, 4, 'odds')).rejects.toMatchObject({ statusCode: 409 });
    await expect(restarted.addOdds(player.id, 'other-session', 5, 'odds')).rejects.toMatchObject({ statusCode: 409 });
    expect(service.getState(player.id)).toBeNull();
    expect(ctx.state).toMatchObject({ ...saved,
      financialOperation: saved.financialOperation.map(({ updatedAt, ...operation }) => operation) });
  });

  it.each(['split', 'insurance', 'double'] as const)('does not publish blackjack %s when result persistence rolls back', async action => {
    const ctx = database();
    const { service, id, invoke } = await blackjackRound(ctx, action);
    const memory = service.getState(player.id, id);
    const saved = structuredClone(ctx.state);
    ctx.mocks.user.updateMany.mockClear();
    ctx.mocks.financialOperation.update.mockRejectedValueOnce(Error('result persistence failed'));
    await expect(invoke()).rejects.toThrow('result persistence failed');
    expect(ctx.mocks.user.updateMany.mock.calls.slice(0, 2).map(([args]: any[]) => args.where.id)).toEqual(['house', player.id]);
    expect(service.getState(player.id, id)).toEqual(memory);
    expect(ctx.state).toEqual(saved);
    const result = await invoke();
    expect(result).not.toEqual(memory);
    expect(service.getState(player.id, id)).toEqual(result);
    expect(ctx.state.financialOperation).toHaveLength(1);
    expect(await invoke()).toEqual(result);
  });

  it('does not publish craps odds when result persistence rolls back', async () => {
    const ctx = database(); const service = new CrapsService(ctx.db);
    const initial = await service.startRound(player.id, 10);
    const saved = structuredClone(ctx.state);
    ctx.mocks.financialOperation.update.mockRejectedValueOnce(Error('result persistence failed'));
    await expect(service.addOdds(player.id, initial.sessionId, 5, 'odds')).rejects.toThrow('result persistence failed');
    expect(service.getState(player.id)).toEqual(initial);
    expect(ctx.state).toEqual(saved);
    const result = await service.addOdds(player.id, initial.sessionId, 5, 'odds');
    expect(result.oddsBet).toBe(5);
    expect(service.getState(player.id)).toEqual(result);
    expect(ctx.state.financialOperation).toHaveLength(1);
    expect(await service.addOdds(player.id, initial.sessionId, 5, 'odds')).toEqual(result);
  });
});
