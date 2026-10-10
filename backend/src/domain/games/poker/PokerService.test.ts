import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokerService, type PokerPlayer, type PokerTable } from './PokerService.js';
import type { Card } from './deck.js';
import { compareHands, evaluateHand } from './handEvaluator.js';
import { botDecide } from './botAI.js';
import { walletFixture } from '../../../infrastructure/socket/wallet.test-support.js';

vi.mock('./botAI.js', () => ({ botDecide: vi.fn(() => ({ action: 'check', amount: 0 })) }));
const card = (rank: Card['rank'], suit: Card['suit'] = 'hearts'): Card => ({ rank, suit });
const board = [card('A'), card('A', 'diamonds'), card('K', 'clubs'), card('Q', 'spades'), card('J')];
const player = (userId: string, seat: number, totalBet = 20, holeCards = [card('2'), card('3', 'clubs')]): PokerPlayer => ({
  userId, username: userId, seat, chips: 100 - totalBet, holeCards, currentBet: 0, totalBet,
  folded: false, isAllIn: false, isBot: false, acted: true,
});

describe('Poker settlement and escrow', () => {
  let service: PokerService;
  let wallet: ReturnType<typeof walletFixture>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(botDecide).mockReset().mockReturnValue({ action: 'check', amount: 0 });
    wallet = walletFixture(); service = new PokerService(wallet.db);
  });
  afterEach(() => { service.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });
  const internals = () => service as unknown as {
    showdown(table: PokerTable): Promise<void>;
    scheduleBots(table: PokerTable): void;
    fillWithBots(table: PokerTable): Promise<void>;
  };
  async function river(players = [player('a', 0), player('b', 1, 20, [card('4'), card('5', 'diamonds')])]) {
    const table = await service.createTable('Deterministic', 5, 4);
    Object.assign(table, { players, communityCards: board, pot: players.reduce((s, p) => s + p.totalBet, 0), phase: 'river', handInProgress: true, handId: 1, currentRaise: 0, currentPlayerIndex: 1, dealerIndex: 0 });
    table.players[1].acted = false;
    return table;
  }

  it('resolves a two-human draw on the final check; conserves pot, logs both, never credits wallet twice', async () => {
    const table = await river();
    const broadcast = vi.fn(); service.setBroadcastFn(broadcast);
    const state = await service.handleAction('b', table.id, 'check');
    expect(state.table.handInProgress).toBe(false);
    expect(state.table.lastHandResults.winningAmounts).toEqual([{ userId: 'a', amount: 20 }, { userId: 'b', amount: 20 }]);
    expect(table.players.map(p => p.chips)).toEqual([100, 100]);
    expect(table.pot).toBe(0);
    expect(wallet.sessions.map(s => [s.betAmount, s.winAmount, s.resultData.netAmount])).toEqual([[20n, 20n, '0'], [20n, 20n, '0']]);
    expect(wallet.journal).toHaveLength(0);
    await internals().showdown(table);
    expect(table.players.map(p => p.chips)).toEqual([100, 100]);
    expect(wallet.sessions).toHaveLength(2);
    expect(broadcast).toHaveBeenCalled();
  });

  it('requires both players to check a new street and serializes duplicate final actions', async () => {
    const table = await river();
    table.players.forEach(p => p.acted = false); table.currentPlayerIndex = 0;
    await service.handleAction('a', table.id, 'check');
    expect(table.phase).toBe('river'); expect(table.handInProgress).toBe(true);
    const results = await Promise.allSettled([service.handleAction('b', table.id, 'check'), service.handleAction('b', table.id, 'check')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(wallet.sessions).toHaveLength(2);
    expect(table.players.reduce((s, p) => s + p.chips, 0)).toBe(200);
  });

  it('awards a folded pot exactly once and records the human loser without revealing the winning cards', async () => {
    const table = await river();
    await service.handleAction('b', table.id, 'fold');
    expect(table.players.map(p => p.chips)).toEqual([120, 80]);
    expect(table.lastHandResults!.winners[0].holeCards).toEqual([]);
    expect(wallet.sessions.find(s => s.userId === 'b')).toMatchObject({ betAmount: 20n, winAmount: 0n, resultData: { folded: true, netAmount: '-20' } });
    await internals().showdown(table);
    expect(table.players.map(p => p.chips)).toEqual([120, 80]);
  });

  it('evaluates every side-pot independently including folded contributions and unmatched overage', async () => {
    const players = [player('a', 0, 20, [card('A', 'clubs'), card('A', 'spades')]), player('b', 1, 100, [card('K'), card('K', 'diamonds')]), player('c', 2, 200, [card('Q'), card('Q', 'diamonds')]), player('d', 3, 200)];
    players.forEach(p => { p.chips = 0; p.isAllIn = true; }); players[3].folded = true;
    const table = await river(players); table.phase = 'showdown';
    await internals().showdown(table);
    expect(table.lastHandResults!.winningAmounts).toEqual([{ userId: 'a', amount: 80 }, { userId: 'b', amount: 240 }, { userId: 'c', amount: 200 }]);
    expect(table.players.reduce((sum, p) => sum + p.chips, 0)).toBe(520);
    expect(wallet.sessions).toHaveLength(4);
    expect(wallet.journal).toHaveLength(0);
  });

  it('distributes odd split chips deterministically without losing a chip', async () => {
    const players = [player('a', 0, 5), player('b', 1, 5, [card('4'), card('5')]), player('c', 2, 5)]; players[2].folded = true;
    const table = await river(players); table.phase = 'showdown';
    await internals().showdown(table);
    expect(table.lastHandResults!.winningAmounts).toEqual([{ userId: 'a', amount: 8 }, { userId: 'b', amount: 7 }]);
    expect(table.players.reduce((sum, p) => sum + p.chips, 0)).toBe(300);
  });

  it('does not publish/credit a failed settlement and retries it without duplicate sessions', async () => {
    const table = await river();
    wallet.tx.gameSession.create.mockRejectedValueOnce(new Error('write failed'));
    await expect(service.handleAction('b', table.id, 'check')).rejects.toThrow('write failed');
    expect(table.players.map(p => p.chips)).toEqual([80, 80]);
    expect(table.handInProgress).toBe(true); expect(wallet.sessions).toHaveLength(0);
    await service.handleAction('b', table.id, 'check');
    expect(table.players.map(p => p.chips)).toEqual([100, 100]);
    expect(wallet.sessions).toHaveLength(2);
  });

  it('bot final action resolves, and the next-round timer broadcasts instead of freezing', async () => {
    const table = await river(); table.players[1].isBot = true;
    const broadcast = vi.fn(); service.setBroadcastFn(broadcast);
    internals().scheduleBots(table);
    await vi.advanceTimersByTimeAsync(3000);
    expect(table.handInProgress).toBe(false); expect(table.lastHandResults).not.toBeNull();
    await vi.advanceTimersByTimeAsync(3000);
    expect(table.handId).toBe(2); expect(table.handInProgress).toBe(true);
    expect(broadcast.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('buy-in and normal leave/cash-out are transactionally once-only for concurrent calls', async () => {
    vi.spyOn(internals(), 'fillWithBots').mockResolvedValue(undefined);
    const table = await service.createTable('Escrow', 5, 2);
    await Promise.all([service.sitDown('a', table.id, 0, 100), service.sitDown('a', table.id, 0, 100)]);
    expect(wallet.users.get('a')!.balance).toBe(900n); expect(table.players).toHaveLength(1);
    await Promise.all([service.leaveTable('a', table.id), service.standUp('a', table.id)]);
    expect(wallet.users.get('a')!.balance).toBe(1000n); expect(table.players).toHaveLength(0);
    expect(wallet.journal.map(t => t.type)).toEqual(['poker_buyin', 'poker_cashout']);
  });

  it('a failed buy-in or cash-out journal never removes or creates an in-memory player', async () => {
    vi.spyOn(internals(), 'fillWithBots').mockResolvedValue(undefined);
    const table = await service.createTable('Escrow', 5, 2);
    wallet.tx.transaction.create.mockRejectedValueOnce(new Error('failed'));
    await expect(service.sitDown('a', table.id, 0, 100)).rejects.toThrow();
    expect(table.players).toHaveLength(0); expect(wallet.users.get('a')!.balance).toBe(1000n);
    await service.sitDown('a', table.id, 0, 100);
    wallet.tx.transaction.create.mockRejectedValueOnce(new Error('failed'));
    await expect(service.standUp('a', table.id)).rejects.toThrow();
    expect(table.players).toHaveLength(1); expect(wallet.users.get('a')!.balance).toBe(900n);
    await service.standUp('a', table.id);
    expect(wallet.users.get('a')!.balance).toBe(1000n);
  });

  it('rebuy of a busted seat debits once under duplicate calls and a live hand cannot cash out', async () => {
    vi.spyOn(internals(), 'fillWithBots').mockResolvedValue(undefined);
    const table = await service.createTable('Escrow', 5, 2);
    await service.sitDown('a', table.id, 0, 100); table.players[0].chips = 0;
    await Promise.all([service.rebuy('a', table.id, 100), service.rebuy('a', table.id, 100)]);
    expect(table.players[0].chips).toBe(100); expect(wallet.users.get('a')!.balance).toBe(800n);
    table.handInProgress = true;
    await expect(service.leaveTable('a', table.id)).rejects.toThrow('fin de la main');
    expect(table.players).toHaveLength(1);
  });

  it('private cards and turn flags are adapted for each player and spectator', async () => {
    const table = await river();
    const a = service.getPlayerGameState(table.id, 'a'); const b = service.getPlayerGameState(table.id, 'b'); const spectator = service.getPlayerGameState(table.id, '');
    expect(a.myCards).toHaveLength(2); expect(a.players[1].holeCards).toEqual([]);
    expect(b.myCards).toHaveLength(2); expect(b.players[0].holeCards).toEqual([]); expect(b.isMyTurn).toBe(true);
    expect(spectator.myCards).toEqual([]); expect(spectator.players.every((p: any) => p.holeCards.length === 0)).toBe(true);
    expect((await service.getTableState(table.id)).players.every((p: any) => p.holeCards === undefined)).toBe(true);
  });

  it('only the best five cards break ties, including a third pair as a kicker', () => {
    expect(compareHands(evaluateHand([card('2'), card('3')], board), evaluateHand([card('4'), card('5')], board))).toBe(0);
    const pairs = [card('A'), card('A', 'clubs'), card('K'), card('K', 'clubs'), card('Q')];
    expect(evaluateHand([card('Q', 'clubs'), card('2')], pairs).score).toEqual([14, 13, 12]);
  });

  it('creates isolated bot sessions rather than occupying the public Micro table', async () => {
    const a = await service.startBotGame('a', 200);
    const b = await service.startBotGame('b', 200);
    expect(a.table.id).not.toBe(b.table.id);
    expect(a.table.mode).toBe('bots');
    expect(a.players.filter((p: PokerPlayer) => p.isBot)).toHaveLength(3);
    expect(a.players.filter((p: PokerPlayer) => !p.isBot).map((p: PokerPlayer) => p.userId)).toEqual(['a']);
    expect((await service.getTables()).every(t => t.playerCount === 0)).toBe(true);
    expect(new Set([...a.players, ...b.players].filter(p => p.isBot).map(p => p.userId)).size).toBe(6);
  });

  it('starts once under concurrent clicks and resumes without another debit', async () => {
    const [a, b] = await Promise.all([service.startBotGame('a', 200), service.startBotGame('a', 200)]);
    expect(a.table.id).toBe(b.table.id);
    expect(wallet.journal).toHaveLength(1);
    expect((await service.resumeSession('a')).table.id).toBe(a.table.id);
    expect(wallet.users.get('a')!.balance).toBe(800n);
  });

  it('does not leave bots, tables or wagers after a rejected start', async () => {
    for (const amount of [99, 1001, NaN, 100.5]) await expect(service.startBotGame('a', amount)).rejects.toThrow();
    wallet.tx.transaction.create.mockRejectedValueOnce(new Error('journal failed'));
    await expect(service.startBotGame('a', 200)).rejects.toThrow('journal failed');
    expect(wallet.users.get('a')!.balance).toBe(1000n);
    expect(wallet.journal).toHaveLength(0);
    expect(await service.resumeSession('a')).toBeNull();
    expect((service as any).tables.size).toBe(5);
  });

  it('rejects access to another player bot session, including at showdown', async () => {
    const session = await service.startBotGame('a', 200);
    await expect(service.joinTable('b', session.table.id)).rejects.toThrow('privee');
    await expect(service.sitDown('b', session.table.id, 1, 100)).rejects.toThrow('privee');
    expect(() => service.getPlayerGameState(session.table.id, 'b')).toThrow('privee');
    (service as any).tables.get(session.table.id).phase = 'showdown';
    await expect(service.handleAction('b', session.table.id, 'check')).rejects.toThrow('privee');
    expect(wallet.users.get('b')!.balance).toBe(1000n);
    expect(wallet.sessions).toHaveLength(0);
  });

  it('settles committed bets, cashes out once and destroys the session on mid-hand departure', async () => {
    const session = await service.startBotGame('a', 200);
    await service.handleAction('a', session.table.id, 'raise', 40);
    await Promise.all([service.leaveTable('a', session.table.id), service.standUp('a', session.table.id)]);
    expect(wallet.users.get('a')!.balance).toBe(960n);
    expect(wallet.journal.map(t => [t.type, t.amount])).toEqual([['poker_buyin', -200n], ['poker_cashout', 160n]]);
    expect(wallet.journal[0].metadata.escrowStatus).toBe('closed');
    expect(wallet.sessions).toHaveLength(1);
    expect(wallet.sessions[0]).toMatchObject({ betAmount: 40n, winAmount: 0n });
    expect(await service.getTableState(session.table.id)).toBeNull();
    expect(await service.resumeSession('a')).toBeNull();
    expect((service as any).botTimers.size).toBe(0);
    expect((service as any).roundTimers.size).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect((service as any).tables.size).toBe(5);
    expect(wallet.journal).toHaveLength(2);
  });

  it('runs out an all-in rather than folding it or refunding it for free', async () => {
    const session = await service.startBotGame('a', 200);
    await service.handleAction('a', session.table.id, 'all-in');
    const table = (service as any).tables.get(session.table.id) as PokerTable;
    table.phase = 'river';
    table.communityCards = [card('2'), card('5', 'diamonds'), card('7', 'clubs'), card('9', 'spades'), card('10')];
    table.players.forEach((p, i) => { const rank = (['A', 'K', 'Q', 'J'] as const)[i]; p.holeCards = [card(rank), card(rank, 'diamonds')]; });
    await service.leaveTable('a', table.id);
    expect(wallet.users.get('a')!.balance).toBe(1600n);
    expect(wallet.sessions[0]).toMatchObject({ betAmount: 200n, winAmount: 800n });
    expect(wallet.journal.map(t => t.amount)).toEqual([-200n, 800n]);
    expect(await service.getTableState(table.id)).toBeNull();
  });

  it('normalizes fractional AI raises before closing a disconnected bot session', async () => {
    const session = await service.startBotGame('a', 200);
    vi.mocked(botDecide).mockReturnValueOnce({ action: 'raise', amount: 20.5 });
    await service.leaveTable('a', session.table.id);
    expect(wallet.users.get('a')!.balance).toBe(1000n);
    expect(wallet.journal.map(t => t.amount)).toEqual([-200n, 200n]);
    expect(await service.resumeSession('a')).toBeNull();
    expect((service as any).botTimers.size).toBe(0);
  });

  it('rolls back the whole hand and retains the session when departure payment fails', async () => {
    const session = await service.startBotGame('a', 200);
    await service.handleAction('a', session.table.id, 'raise', 40);
    wallet.tx.transaction.create.mockRejectedValueOnce(new Error('cashout journal failed'));
    await expect(service.leaveTable('a', session.table.id)).rejects.toThrow('cashout journal failed');
    expect(wallet.users.get('a')!.balance).toBe(800n);
    expect(wallet.sessions).toHaveLength(0);
    expect(wallet.journal[0].metadata).toMatchObject({ escrowStatus: 'active', escrowAmount: '200' });
    expect((await service.resumeSession('a')).table.handInProgress).toBe(true);
    await service.leaveTable('a', session.table.id);
    expect(wallet.users.get('a')!.balance).toBe(960n);
    expect(wallet.sessions).toHaveLength(1);
  });

  it('reconnects during the grace period without folding, restarting or buying in twice', async () => {
    const session = await service.startBotGame('a', 200);
    const cards = session.myCards;
    await service.handleDisconnect('a');
    await vi.advanceTimersByTimeAsync(29000);
    const resumed = await service.resumeSession('a');
    expect(resumed.table.id).toBe(session.table.id);
    expect(resumed.myCards).toEqual(cards);
    expect(resumed.players.find((p: PokerPlayer) => p.userId === 'a').folded).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await service.resumeSession('a')).table.id).toBe(session.table.id);
    expect(wallet.journal).toHaveLength(1);
  });

  it('expires disconnected bot sessions and starts the next one with new instances', async () => {
    const session = await service.startBotGame('a', 200);
    await service.handleDisconnect('a');
    await vi.advanceTimersByTimeAsync(31000);
    expect(await service.resumeSession('a')).toBeNull();
    expect(wallet.users.get('a')!.balance).toBe(1000n);
    expect((service as any).disconnectTimers.size).toBe(0);
    const next = await service.startBotGame('a', 200);
    expect(next.table.id).not.toBe(session.table.id);
    expect(next.players.filter((p: PokerPlayer) => p.isBot).every((p: PokerPlayer) => p.chips === 5000 || p.chips === 4995 || p.chips === 4990)).toBe(true);
    expect(next.players.some((p: PokerPlayer) => session.players.some((old: PokerPlayer) => old.isBot && old.userId === p.userId))).toBe(false);
  });

  it('keeps the public tables human-only and does not reset someone else game', async () => {
    const table = (await service.getTables())[0];
    const a = await service.sitDown('a', table.id, 0, 100);
    expect(a.table.phase).toBe('waiting');
    const b = await service.sitDown('b', table.id, 1, 100);
    expect(b.players.every((p: PokerPlayer) => !p.isBot)).toBe(true);
    const privateGame = await service.startBotGame('c', 200);
    await service.leaveTable('c', privateGame.table.id);
    expect(service.getPlayerGameState(table.id, 'b').table.handInProgress).toBe(true);
    expect(wallet.users.get('b')!.balance).toBe(900n);
  });

  it('a wrong-table departure cannot orphan the caller own session or affect a foreign owner', async () => {
    const a = await service.startBotGame('a', 200);
    const b = await service.startBotGame('b', 200);
    await expect(service.leaveTable('a', b.table.id)).rejects.toThrow('privee');
    await expect(service.standUp('a', b.table.id)).rejects.toThrow('privee');
    const publicTable = (await service.getTables())[0];
    await service.leaveTable('a', publicTable.id);
    expect((await service.resumeSession('a')).table.id).toBe(a.table.id);
    expect((await service.resumeSession('b')).table.id).toBe(b.table.id);
    expect(wallet.journal).toHaveLength(2);
  });

  it('a notification failure never reports an already-paid start as a rejected buy-in', async () => {
    service.setBroadcastFn(vi.fn().mockRejectedValue(new Error('transport unavailable')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = await service.startBotGame('a', 200);
    expect(session.isAtTable).toBe(true);
    expect(wallet.journal).toHaveLength(1);
  });
});
