import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResultSummary from './ResultSummary';
import { PLINKO_MULTIPLIERS, nextWheelAngle, signedNet } from './gameMath';
import { gamesApi, minesApi, crashApi, limboApi, GAME_BALANCE_ERROR } from '@/services/games';
import { subscribePoker, usePokerStore } from '@/store/pokerStore';
import { subscribeBingo, useBingoStore } from '@/store/bingoStore';

const mocks = vi.hoisted(() => {
  const makeSocket = () => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    return {
      connected: false,
      emit: vi.fn(),
      on: vi.fn((name: string, callback: (...args: any[]) => void) => {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)!.add(callback);
      }),
      off: vi.fn((name: string, callback: (...args: any[]) => void) => listeners.get(name)?.delete(callback)),
      fire: (name: string, ...args: any[]) => listeners.get(name)?.forEach(callback => callback(...args)),
      clear: () => listeners.clear(),
      count: (name: string) => listeners.get(name)?.size ?? 0,
    };
  };
  return { poker: makeSocket(), bingo: makeSocket(), post: vi.fn(), get: vi.fn(), sync: vi.fn() };
});

vi.mock('@/services/api', () => ({ default: { post: mocks.post, get: mocks.get } }));
vi.mock('@/services/pokerSocket', () => ({ getPokerSocket: () => mocks.poker }));
vi.mock('@/services/bingoSocket', () => ({ getBingoSocket: () => mocks.bingo }));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ user: { id: 'me' } }) } }));
vi.mock('@/store/balanceStore', () => ({ useBalanceStore: { getState: () => ({ syncBalance: mocks.sync }) } }));

class TestCustomEvent extends Event {
  detail: unknown;
  constructor(name: string, options: { detail: unknown }) { super(name); this.detail = options.detail; }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.poker.clear();
  mocks.poker.connected = false;
  mocks.bingo.clear();
  mocks.sync.mockReset().mockResolvedValue(undefined);
  mocks.post.mockReset().mockResolvedValue({ data: { sessionId: 'session' } });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('CustomEvent', TestCustomEvent);
  usePokerStore.getState().reset();
  useBingoStore.getState().reset();
});

describe('Payments and presentation', () => {
  const actions = [
    () => gamesApi.slotsSpin('classic', 5),
    () => gamesApi.rouletteSpin([{ type: 'red', positions: [], amount: 1 }]),
    () => gamesApi.blackjackStart(10),
    () => gamesApi.blackjackHit('s', 1),
    () => gamesApi.blackjackStand('s', 1),
    () => gamesApi.blackjackDouble('s', 1),
    () => gamesApi.blackjackSplit('s', 1),
    () => gamesApi.blackjackInsurance('s', 5),
    () => gamesApi.craps.start(10),
    () => gamesApi.craps.addOdds('s', 2),
    () => gamesApi.craps.roll('s'),
    () => gamesApi.keno.play(5, [1]),
    () => gamesApi.plinko.drop(10, 'low', 12),
    () => gamesApi.wheel.spin(10),
    () => gamesApi.vpDeal(1),
    () => gamesApi.vpDraw('s', [false, false, false, false, false]),
    () => gamesApi.vpCancel('s'),
    () => minesApi.start(10, 3),
    () => minesApi.reveal('s', 0),
    () => minesApi.cashOut('s'),
    () => crashApi.placeBet(10),
    () => crashApi.cashOut(),
    () => limboApi.play(10, 2),
  ];
  it.each(actions.map((action, index) => [index, action] as const))('syncs successful mutation %i and its rejection', async (_index, action) => {
    await action();
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    const rejection = new Error('Action refusee');
    mocks.post.mockRejectedValueOnce(rejection);
    await expect(action()).rejects.toBe(rejection);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });
  it('surfaces balance failure without losing the already-dealt session', async () => {
    const onError = vi.fn();
    window.addEventListener(GAME_BALANCE_ERROR, onError);
    mocks.sync.mockRejectedValueOnce(new Error('Reseau indisponible'));
    await expect(gamesApi.blackjackStart(10)).resolves.toEqual({ sessionId: 'session' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].detail).toContain('Reseau indisponible');
  });
  it('sends automatic cashout only when enabled', async () => {
    await crashApi.placeBet(10, 0);
    expect(mocks.post).toHaveBeenLastCalledWith('/games/crash/bet', { bet: 10, autoCashout: undefined });
    await crashApi.placeBet(10, 2.5);
    expect(mocks.post).toHaveBeenLastCalledWith('/games/crash/bet', { bet: 10, autoCashout: 2.5 });
  });
  it('keeps empty positions for roulette outside bets', async () => {
    await gamesApi.rouletteSpin([{ type: 'red', positions: [], amount: 1 }]);
    expect(mocks.post).toHaveBeenLastCalledWith('/games/roulette/spin', { bets: [{ type: 'red', positions: [], amount: 1 }] });
  });
  it.each([[9, 10, '-1'], [10, 10, '0'], [0, 1, '-1'], [25, 10, '+15']])('renders gross %i vs original bet %i as net %s', (payout, bet, net) => {
    const text = renderToStaticMarkup(<ResultSummary payout={payout as number} bet={bet as number} />);
    expect(text).toContain('Retour brut');
    expect(text).toContain(`Resultat net : ${net}`);
    expect(text).not.toContain('Gagn');
  });
  it('historical losses use the recorded stake', () => expect(signedNet(0, 25)).toBe('-25'));
});

describe('Wheel and Plinko geometry', () => {
  for (const risk of ['low', 'medium', 'high']) {
    for (const rows of [8, 12, 16]) {
      it(`${risk}/${rows} has rows + 1 symmetric buckets including both extremes`, () => {
        const table = PLINKO_MULTIPLIERS[risk][rows];
        expect(table).toHaveLength(rows + 1);
        expect(table).toEqual([...table].reverse());
        expect(table.every(Number.isFinite)).toBe(true);
        expect(table[rows]).toBe(table[0]);
      });
    }
  }
  it('aligns repeated wheel spins to the selected grouped segment, not accumulated offsets', () => {
    const weights = [1, 4, 8, 15, 20, 20, 32];
    let angle = 0;
    for (const index of [4, 4, 6, 0, 5, 2]) {
      const next = nextWheelAngle(angle, index, weights);
      const center = (weights.slice(0, index).reduce((a, b) => a + b, 0) + weights[index] / 2) * 3.6;
      const offset = (next % 360 + center) % 360;
      expect(Math.min(offset, 360 - offset)).toBeCloseTo(0, 6);
      expect(next - angle).toBeGreaterThanOrEqual(1800);
      angle = next;
    }
    expect(() => nextWheelAngle(0, 71, weights)).toThrow();
  });
});

const personalPokerState = (phase = 'preflop') => ({
  table: { id: 't', phase, pot: 40, currentPlayerIndex: 0, currentRaise: 10, communityCards: [] },
  players: [{ userId: 'me', seat: 2, chips: 90, currentBet: 10 }],
  myCards: [{ suit: 'hearts', rank: 'A' }], mySeat: 2, isAtTable: true, isMyTurn: true,
});

async function reply(socket: typeof mocks.poker, event: string, response: any) {
  const call = [...socket.emit.mock.calls].reverse().find(args => args[0] === event)!;
  await call[call.length - 1](response);
}

describe('Poker subscriptions and finance', () => {
  it('handles public seating and private live updates without losing own cards', () => {
    const cleanup = subscribePoker();
    usePokerStore.setState({ selectedTable: 't' });
    mocks.poker.fire('poker:game-update', personalPokerState());
    const cards = usePokerStore.getState().myCards;
    mocks.poker.fire('poker:table-update', { ...personalPokerState().table, pot: 50, players: personalPokerState().players });
    expect(usePokerStore.getState().pot).toBe(50);
    expect(usePokerStore.getState().myCards).toEqual(cards);
    expect(usePokerStore.getState().isAtTable).toBe(true);
    mocks.poker.fire('poker:game-update', { ...personalPokerState('flop'), isMyTurn: false });
    expect(usePokerStore.getState().phase).toBe('flop');
    expect(usePokerStore.getState().isMyTurn).toBe(false);
    cleanup();
    expect(mocks.poker.count('poker:game-update')).toBe(0);
    expect(mocks.poker.count('poker:table-update')).toBe(0);
  });
  it('resumes the owned session without a second buy-in and cleans subscriptions', async () => {
    const cleanup = subscribePoker();
    usePokerStore.setState({ selectedTable: 't' });
    mocks.poker.connected = true;
    mocks.poker.fire('connect');
    expect(mocks.poker.emit.mock.calls.some(args => args[0] === 'poker:resume')).toBe(true);
    expect(mocks.poker.emit.mock.calls.some(args => args[0] === 'poker:sit-down')).toBe(false);
    await reply(mocks.poker, 'poker:resume', { success: true, state: personalPokerState() });
    cleanup();
    mocks.poker.connected = false;
    const cleanup2 = subscribePoker();
    expect(mocks.poker.count('poker:game-update')).toBe(1);
    cleanup2();
  });
  it('applies buy-in ack/private state, syncs withdrawals and exposes refusals', async () => {
    mocks.poker.connected = true;
    const seated = usePokerStore.getState().sitDown('t', 2, 100);
    await reply(mocks.poker, 'poker:sit-down', { success: true, state: personalPokerState() });
    await seated;
    expect(usePokerStore.getState().mySeat).toBe(2);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    const refused = usePokerStore.getState().standUp('t');
    await reply(mocks.poker, 'poker:stand-up', { success: false, error: 'Retrait refuse' });
    await refused;
    expect(usePokerStore.getState().error).toBe('Retrait refuse');
    expect(usePokerStore.getState().isAtTable).toBe(true);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    const withdrawn = usePokerStore.getState().standUp('t');
    await reply(mocks.poker, 'poker:stand-up', { success: true });
    await withdrawn;
    expect(usePokerStore.getState().table).toBeNull();
    expect(mocks.sync).toHaveBeenCalledTimes(3);
  });
  it('shows rejected financial synchronization', async () => {
    mocks.poker.connected = true;
    mocks.sync.mockRejectedValueOnce(new Error('Solde indisponible'));
    const request = usePokerStore.getState().sitDown('t', null, 100);
    await reply(mocks.poker, 'poker:sit-down', { success: false, error: 'Buy-in refuse' });
    await request;
    expect(usePokerStore.getState().error).toContain('Buy-in refuse');
    expect(usePokerStore.getState().error).toContain('Solde indisponible');
  });
  it('starts bots through their dedicated command and blocks duplicate clicks', async () => {
    mocks.poker.connected = true;
    const first = usePokerStore.getState().startBotGame(200);
    void usePokerStore.getState().startBotGame(200);
    expect(mocks.poker.emit.mock.calls.filter(args => args[0] === 'poker:start-bots')).toHaveLength(1);
    await reply(mocks.poker, 'poker:start-bots', { success: true, state: personalPokerState() });
    await first;
    expect(usePokerStore.getState().selectedTable).toBe('t');
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it('does not buffer a financial command on a disconnected socket', async () => {
    await usePokerStore.getState().startBotGame(200);
    expect(mocks.poker.emit).not.toHaveBeenCalled();
    expect(usePokerStore.getState().error).toContain('Aucune nouvelle operation');
  });
  it('returns an acknowledged departure result and keeps the session on rejection', async () => {
    mocks.poker.connected = true;
    usePokerStore.getState().setTableState(personalPokerState());
    const first = usePokerStore.getState().standUp('t');
    await reply(mocks.poker, 'poker:stand-up', { success: false, error: 'Paiement indisponible' });
    expect(await first).toBe(false);
    expect(usePokerStore.getState().table.id).toBe('t');
    const second = usePokerStore.getState().standUp('t');
    await reply(mocks.poker, 'poker:stand-up', { success: true });
    expect(await second).toBe(true);
    expect(usePokerStore.getState().table).toBeNull();
  });
  it('uses the rebuy command instead of re-sitting at an occupied seat', async () => {
    mocks.poker.connected = true;
    const request = usePokerStore.getState().rebuy('t', 100);
    expect(mocks.poker.emit.mock.calls[0].slice(0, 2)).toEqual(['poker:rebuy', { tableId: 't', amount: 100 }]);
    await reply(mocks.poker, 'poker:rebuy', { success: true, state: personalPokerState() });
    await request;
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it('ignores an ended event from an old session after a new one was selected', () => {
    const cleanup = subscribePoker();
    usePokerStore.setState({ selectedTable: 't', loading: false });
    usePokerStore.getState().setTableState(personalPokerState());
    mocks.poker.fire('poker:session-ended', { tableId: 'old' });
    expect(usePokerStore.getState().table.id).toBe('t');
    mocks.poker.fire('poker:session-ended', { tableId: 't' });
    expect(usePokerStore.getState().selectedTable).toBeNull();
    cleanup();
    expect(mocks.poker.count('poker:session-ended')).toBe(0);
  });
});

const bingoCard = { id: 'c', numbers: Array.from({ length: 5 }, () => [1, 2, 3, 4, 5]), marked: Array.from({ length: 5 }, () => [false, false, false, false, false]) };
const bingoState = (phase = 'waiting') => ({ room: { id: 'r', phase, pattern: 'line', ticketPrice: 10, players: [{ userId: 'me', username: 'Moi' }], calledNumbers: [], ballCount: 75 }, myCard: bingoCard, isInRoom: true });

describe('Bingo subscriptions and tickets', () => {
  it('updates lobby lists, preserves membership and reconnects once', () => {
    const cleanup = subscribeBingo();
    mocks.bingo.fire('bingo:rooms-update', [{ id: 'r' }]);
    expect(useBingoStore.getState().rooms[0].id).toBe('r');
    useBingoStore.getState().setRoomState(bingoState());
    mocks.bingo.fire('connect');
    expect(mocks.bingo.emit.mock.calls.filter(args => args[0] === 'bingo:join-room')).toHaveLength(1);
    cleanup();
    expect(mocks.bingo.count('bingo:rooms-update')).toBe(0);
    expect(useBingoStore.getState().isInRoom).toBe(true);
  });
  it('does not debit twice for concurrent join clicks and never invents a card on refusal', async () => {
    useBingoStore.getState().joinRoom('r');
    useBingoStore.getState().joinRoom('r');
    expect(mocks.bingo.emit).toHaveBeenCalledTimes(1);
    await reply(mocks.bingo, 'bingo:join-room', { success: false, error: 'Salon complet' });
    expect(useBingoStore.getState().myCard).toBeNull();
    expect(useBingoStore.getState().isInRoom).toBe(false);
    expect(useBingoStore.getState().error).toBe('Salon complet');
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it('refreshes a generated card only once on start and marks duplicate calls once', async () => {
    const cleanup = subscribeBingo();
    useBingoStore.getState().setRoomState(bingoState());
    mocks.bingo.fire('bingo:game-update', bingoState('playing').room);
    mocks.bingo.fire('bingo:game-update', bingoState('playing').room);
    expect(mocks.bingo.emit.mock.calls.filter(args => args[0] === 'bingo:join-room')).toHaveLength(1);
    expect(useBingoStore.getState().myCard).toBeNull();
    await reply(mocks.bingo, 'bingo:join-room', { success: true, state: bingoState('playing') });
    mocks.bingo.fire('bingo:number-called', { number: 1 });
    mocks.bingo.fire('bingo:number-called', { number: 1 });
    expect(useBingoStore.getState().calledNumbers).toEqual([1]);
    expect(useBingoStore.getState().ballCount).toBe(74);
    expect(useBingoStore.getState().myCard?.marked[0][0]).toBe(true);
    cleanup();
  });
  it('returns expired rooms to the lobby and syncs winner payments', async () => {
    const cleanup = subscribeBingo();
    useBingoStore.getState().setRoomState(bingoState());
    useBingoStore.getState().joinRoom('r');
    await reply(mocks.bingo, 'bingo:join-room', { success: false, error: 'Salon introuvable' });
    expect(useBingoStore.getState().currentRoom).toBeNull();
    expect(useBingoStore.getState().error).toBe('Salon introuvable');
    mocks.bingo.fire('bingo:winner', { userId: 'me', username: 'Moi', prize: 19 });
    expect(useBingoStore.getState().phase).toBe('complete');
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
