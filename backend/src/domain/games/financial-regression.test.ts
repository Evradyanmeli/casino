import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDatabase, player } from '../admin/testSupport.js';
import { EconomyService } from '../economy/EconomyService.js';
import { openWager, increaseWager, settleWager, instantWager } from './GameSupport.js';
import { openEscrow, saveEscrow, recoverInterruptedFunds } from './Escrow.js';
import { BlackjackService } from './blackjack/BlackjackService.js';
import { VideoPokerService } from './videopoker/VideoPokerService.js';
import { validateBet, checkBetWon } from './roulette/RouletteService.js';
import { MinesService } from './mines/MinesService.js';
import { CrashService } from './crash/CrashService.js';
import { WheelService } from './wheel/WheelService.js';
import { PlinkoService } from './plinko/PlinkoService.js';
import { UserService } from '../user/UserService.js';

vi.mock('node:crypto', async original => ({ ...await original<typeof import('node:crypto')>(),
  randomInt: (min: number, max?: number) => max === undefined ? min - 1 : min,
}));
const database = () => testDatabase({ user: [player, { ...player, id: 'house', role: 'ADMIN', email: 'admin@casino.com', balance: 1000000000000n }] });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Durable financial settlement', () => {
  it('settles a wager once, with its ledger, and ignores unfinished games in profile stats', async () => {
    const ctx = database(); const economy = new EconomyService(ctx.db);
    const id = await economy.runInTransaction(tx => openWager(tx, player.id, 'blackjack', 10, 30));
    expect((await new UserService(ctx.db).getStats(player.id)).totalSessions).toBe(0);
    await economy.runInTransaction(tx => settleWager(tx, id, player.id, 'blackjack', 20, { won: true }));
    await expect(economy.runInTransaction(tx => settleWager(tx, id, player.id, 'blackjack', 20, {}))).rejects.toThrow('already settled');
    expect(ctx.state.user[0].balance).toBe(1010n);
    expect(ctx.state.transaction.filter(t => t.userId === player.id).map(t => t.amount)).toEqual([-10n, 20n]);
    expect(ctx.state.user[1].balance).toBe(999999999990n);
    expect((await new UserService(ctx.db).getStats(player.id)).totalSessions).toBe(1);
  });
  it('rolls back a debit if an instant result or its settlement fails', async () => {
    const ctx = database();
    await expect(instantWager(ctx.db, player.id, 'roulette', 10, async () => { throw Error('engine failed'); }, () => 0, 360)).rejects.toThrow();
    expect(ctx.state.user[0].balance).toBe(1000n); expect(ctx.state.transaction).toEqual([]);
    expect(ctx.state.gameSession).toEqual([]);
  });
  it('does not count a push or a refunded stake as a victory', async () => {
    const ctx = testDatabase({ user: [player], gameSession: [
      { userId: player.id, betAmount: 20n, winAmount: 20n },
      { userId: player.id, betAmount: 10n, winAmount: 25n },
    ] });
    expect(await new UserService(ctx.db).getStats(player.id)).toMatchObject({ totalSessions: 2, totalWins: 1, biggestWin: '25' });
  });
  it('recovers interrupted solo wagers exactly once without treating refunds as victories', async () => {
    const ctx = database();
    await new EconomyService(ctx.db).runInTransaction(tx => openWager(tx, player.id, 'mines', 10, 40));
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 1, escrows: 1 });
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 0, escrows: 0 });
    expect(ctx.state.user[0].balance).toBe(1000n); expect(ctx.state.transaction.filter(t => t.userId === player.id).map(t => t.amount)).toEqual([-10n, 10n]);
    expect(ctx.state.user[1].balance).toBe(1000000000000n);
    expect((await new UserService(ctx.db).getStats(player.id)).totalSessions).toBe(0);
  });
  it('persists the remaining poker stack and refunds it once after restart', async () => {
    const ctx = database(); const economy = new EconomyService(ctx.db);
    const id = await economy.runInTransaction(tx => openEscrow(tx, player.id, 100, 'poker_buyin', 'table', 'Buy-in'));
    await economy.runInTransaction(tx => saveEscrow(tx, id, 70));
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 0, escrows: 1 });
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 0, escrows: 0 });
    expect(ctx.state.user[0].balance).toBe(970n);
  });
  it('rolls back both interruption refunds if the player refund journal fails', async () => {
    const ctx = database(); const economy = new EconomyService(ctx.db);
    const id = await economy.runInTransaction(tx => openWager(tx, player.id, 'blackjack', 10, 30));
    await economy.runInTransaction(tx => increaseWager(tx, id, player.id, 'blackjack', 10));
    ctx.mocks.transaction.create.mockImplementationOnce(async (args: any) => {
      const row = { id: 'house-refund', ...args.data }; ctx.state.transaction.push(row); return row;
    }).mockRejectedValueOnce(Error('player refund journal failed'));
    await expect(recoverInterruptedFunds(ctx.db)).rejects.toThrow('player refund journal failed');
    expect(ctx.state.user.map(u => u.balance)).toEqual([980n, 999999999960n]);
    expect(ctx.state.gameSession[0].resultData.status).toBe('pending');
    expect(ctx.state.transaction.find(t => t.type === 'game_house_reserve')!.metadata.escrowStatus).toBe('active');
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 1, escrows: 1 });
    expect(ctx.state.user.map(u => u.balance)).toEqual([1000n, 1000000000000n]);
  });
  it('recovers both player and treasury checkpoints without creating chips', async () => {
    const ctx = testDatabase({ user: [player, { ...player, id: 'house', balance: 6000n, role: 'ADMIN' }] });
    const economy = new EconomyService(ctx.db);
    const ids = await economy.runInTransaction(async tx => [
      await openEscrow(tx, player.id, 200, 'poker_buyin', 'table', 'Player stake'),
      await openEscrow(tx, 'house', 600, 'poker_bot_funding', 'table', 'Bot reserve'),
    ]);
    await economy.runInTransaction(async tx => {
      await saveEscrow(tx, ids[0], 160);
      await saveEscrow(tx, ids[1], 640);
    });
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 0, escrows: 2 });
    expect(ctx.state.user[0].balance).toBe(960n);
    expect(ctx.state.user[1].balance).toBe(6040n);
    expect(ctx.state.user.reduce((sum, user) => sum + user.balance, 0n)).toBe(7000n);
    expect(await recoverInterruptedFunds(ctx.db)).toEqual({ wagers: 0, escrows: 0 });
  });
  it('rolls back closing escrow if the cashout credit fails', async () => {
    const ctx = database(); const economy = new EconomyService(ctx.db);
    const id = await economy.runInTransaction(tx => openEscrow(tx, player.id, 100, 'poker_buyin', 'table', 'Buy-in'));
    ctx.mocks.transaction.create.mockRejectedValueOnce(Error('journal failed'));
    await expect(economy.runInTransaction(async tx => {
      await saveEscrow(tx, id, 100, true); await new EconomyService(tx).addBalance(player.id, 100n, 'poker_cashout');
    })).rejects.toThrow();
    expect(ctx.state.user[0].balance).toBe(900n);
    expect(ctx.state.transaction[0].metadata.escrowStatus).toBe('active');
  });
});

describe('Game rules and repeat actions', () => {
  it.each(['red', 'black', 'odd', 'even', 'low', 'high'] as const)('accepts the UI outside bet %s', type => {
    expect(() => validateBet({ type, positions: [], amount: 1 })).not.toThrow();
    expect(checkBetWon({ type, positions: [], amount: 1 }, 0)).toBe(false);
  });
  it('rejects covered columns, invalid geometry and duplicated numbers', () => {
    expect(() => validateBet({ type: 'column', positions: [0, 1, 2], amount: 1 })).toThrow();
    expect(() => validateBet({ type: 'split', positions: [1, 36], amount: 1 })).toThrow();
    expect(() => validateBet({ type: 'split', positions: [1, 1], amount: 1 })).toThrow();
  });
  it('keeps blackjack sessions, advances split hands, and prevents repeated credits', async () => {
    const ctx = database(); const service = new BlackjackService(ctx.db, new EconomyService(ctx.db));
    const initial = await service.startRound(player.id, 10);
    const internal = (service as any).sessions.get(initial.sessionId);
    internal.hands[0].cards = [{ suit: 'hearts', rank: '8' }, { suit: 'clubs', rank: '8' }];
    internal.hands[0].value = 16;
    const split = await service.split(player.id, initial.sessionId, 0); expect(split.hands).toHaveLength(2);
    await service.stand(player.id, initial.sessionId, 0);
    const complete = await service.stand(player.id, initial.sessionId, 1); expect(complete.state).toBe('complete');
    const balance = ctx.state.user[0].balance;
    await service.stand(player.id, initial.sessionId, 1); expect(ctx.state.user[0].balance).toBe(balance);
  });
  it('pays zero for losing video poker and returns the same completed draw', async () => {
    const ctx = database(); const service = new VideoPokerService(ctx.db, new EconomyService(ctx.db));
    const initial = await service.deal(player.id, 1);
    (service as any).sessions.get(initial.sessionId).hand = [
      { rank: '2', suit: 'hearts' }, { rank: '5', suit: 'diamonds' }, { rank: '8', suit: 'clubs' },
      { rank: '10', suit: 'spades' }, { rank: 'K', suit: 'hearts' },
    ];
    const results = await Promise.all([service.draw(player.id, initial.sessionId, [true, true, true, true, true]),
      service.draw(player.id, initial.sessionId, [true, true, true, true, true])]);
    expect(results[0]).toMatchObject({ handName: 'Rien', payout: 0, phase: 'complete' });
    expect(ctx.state.user[0].balance).toBe(999n); expect(ctx.state.gameSession).toHaveLength(1);
  });
  it('abandons video poker explicitly without a second debit or a refund', async () => {
    const ctx = database(); const service = new VideoPokerService(ctx.db, new EconomyService(ctx.db));
    const initial = await service.deal(player.id, 1);
    await expect(service.deal(player.id, 1)).rejects.toThrow('active');
    await service.cancel(player.id, initial.sessionId); await service.cancel(player.id, initial.sessionId);
    expect(ctx.state.user[0].balance).toBe(999n); expect(ctx.state.transaction.filter(t => t.userId === player.id)).toHaveLength(1);
  });
  it('masks mines, allows withdrawal after exclusion, and pays one cashout', async () => {
    const ctx = database(); const service = new MinesService(ctx.db);
    const initial = await service.startGame(player.id, 10, 1);
    expect(initial.grid.flat().filter(c => c.isMine)).toHaveLength(0);
    await service.revealTile(player.id, initial.sessionId, 24);
    ctx.state.responsibleLimit.push({ userId: player.id, selfExclusionEnabled: true, selfExcludeUntil: new Date(Date.now() + 86400000) });
    const a = await service.cashOut(player.id, initial.sessionId); const b = await service.cashOut(player.id, initial.sessionId);
    expect(b.payout).toBe(a.payout); expect(ctx.state.user[0].balance).toBe(990n + BigInt(a.payout));
  });
  it('automatically cashes out crash once and bounds its round duration', async () => {
    const ctx = database(); const service = new CrashService(ctx.db);
    const state = await service.placeBet(player.id, 10, 1.5); expect(state.crashPoint).toBeUndefined();
    await vi.advanceTimersByTimeAsync(7500);
    expect(service.getCurrentState().players[0]).toMatchObject({ cashedOutAt: 1.5, payout: 15 });
    await service.cashOut(player.id); expect(ctx.state.user[0].balance).toBe(1005n);
    await vi.advanceTimersByTimeAsync(40000); expect(service.getCurrentState().roundId).not.toBe(state.roundId);
    expect(ctx.state.transaction.filter(t => t.userId === player.id)).toHaveLength(2); service.close();
  });
  it('uses grouped wheel indexes matching the UI', async () => {
    const result = await new WheelService().spin(player.id, 10);
    expect(result.result.index).toBeGreaterThanOrEqual(0); expect(result.result.index).toBeLessThan(8);
    const returned = result.segments.reduce((sum, s) => sum + s.weight * s.multiplier, 0);
    const weight = result.segments.reduce((sum, s) => sum + s.weight, 0);
    expect(returned / weight).toBeCloseTo(0.95, 8);
  });
  it.each([8, 12, 16])('provides %i + 1 reachable Plinko buckets', async rows => {
    const result = await new PlinkoService().drop(player.id, 10, 'medium', rows);
    expect(result.multipliers).toHaveLength(rows + 1); expect(result.slot).toBe(rows);
    expect(result.multiplier).toBe(result.multipliers[rows]); expect(Number.isSafeInteger(result.payout)).toBe(true);
  });
});
