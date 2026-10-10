import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BingoService, type BingoRoom } from './BingoService.js';
import { walletFixture } from '../../../infrastructure/socket/wallet.test-support.js';

describe('Bingo tickets and claims', () => {
  let service: BingoService;
  let wallet: ReturnType<typeof walletFixture>;
  beforeEach(() => { vi.useFakeTimers(); wallet = walletFixture(); service = new BingoService(wallet.db); });
  afterEach(() => { service.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });
  const internalRoom = (id: string) => (service as unknown as { rooms: Map<string, BingoRoom> }).rooms.get(id)!;

  it('broadcasts room creation and listing to the namespace', async () => {
    const emit = vi.fn(); service.setEmitFunction(emit);
    const room = await service.createRoom('line', 10, 2);
    expect(emit).toHaveBeenCalledWith('bingo:rooms-created', '', expect.objectContaining({ id: room.id }));
    expect(emit).toHaveBeenCalledWith('bingo:rooms-update', '', [room]);
  });

  it('charges once for concurrent duplicate joins and keeps the purchased card on start/reconnect', async () => {
    const room = await service.createRoom('line', 10, 2);
    const [one, two] = await Promise.all([service.joinRoom('a', 'A', room.id), service.joinRoom('a', 'A', room.id)]);
    expect(one.myCard.id).toBe(two.myCard.id);
    expect(wallet.users.get('a')!.balance).toBe(990n);
    expect(wallet.journal).toHaveLength(1);
    await service.joinRoom('b', 'B', room.id);
    await service.startGame(room.id, 'a');
    expect((await service.joinRoom('a', 'A', room.id)).myCard.id).toBe(one.myCard.id);
    expect(wallet.journal).toHaveLength(2);
  });

  it('rolls back ticket debit if its journal cannot commit, without enrolling a player', async () => {
    const room = await service.createRoom('line', 10, 2);
    wallet.tx.transaction.create.mockRejectedValueOnce(new Error('commit failed'));
    await expect(service.joinRoom('a', 'A', room.id)).rejects.toThrow('commit failed');
    expect(wallet.users.get('a')!.balance).toBe(1000n);
    expect(internalRoom(room.id).players).toHaveLength(0);
    expect(wallet.journal).toHaveLength(0);
  });

  it('refunds a waiting ticket once; failed refunds keep the card recoverable', async () => {
    const room = await service.createRoom('line', 10, 2);
    await service.joinRoom('a', 'A', room.id);
    wallet.tx.transaction.create.mockRejectedValueOnce(new Error('commit failed'));
    await expect(service.leaveRoom('a', room.id)).rejects.toThrow();
    expect(service.getPlayerGameState(room.id, 'a').isInRoom).toBe(true);
    expect(wallet.users.get('a')!.balance).toBe(990n);
    await Promise.all([service.leaveRoom('a', room.id), service.leaveRoom('a', room.id)]);
    expect(wallet.users.get('a')!.balance).toBe(1000n);
    expect(wallet.journal.filter(t => t.type === 'refund')).toHaveLength(1);
  });

  it('does not refund or shrink the committed prize after a running leave/disconnect', async () => {
    const room = await service.createRoom('line', 10, 2);
    await service.joinRoom('a', 'A', room.id); await service.joinRoom('b', 'B', room.id);
    await service.startGame(room.id, 'a');
    await service.leaveRoom('a', room.id); await service.handleDisconnect('b');
    expect(internalRoom(room.id).prize).toBe(20);
    expect(internalRoom(room.id).players).toHaveLength(2);
    expect(wallet.journal).toHaveLength(2);
  });

  it('declines premature bingo and pays the verified winner once under concurrent calls', async () => {
    const room = await service.createRoom('line', 10, 2);
    await service.joinRoom('a', 'A', room.id); await service.joinRoom('b', 'B', room.id);
    await service.startGame(room.id, 'a');
    const state = internalRoom(room.id);
    state.players[0].card.marked[0].fill(true);
    expect(await service.callBingo('a', room.id)).toEqual({ valid: false, prize: 0 });
    state.calledNumbers = [...state.players[0].card.numbers[0]];
    const replies = await Promise.all([service.callBingo('a', room.id), service.callBingo('a', room.id)]);
    expect(replies.filter(r => r.valid)).toHaveLength(1);
    expect(wallet.users.get('a')!.balance).toBe(1009n);
    expect(wallet.journal.filter(t => t.type === 'win')).toHaveLength(1);
    expect(wallet.sessions).toHaveLength(2);
    expect(state.phase).toBe('complete');
  });

  it('rolls back prize and retries safely after a session write failure', async () => {
    const room = await service.createRoom('full', 10, 2);
    await service.joinRoom('a', 'A', room.id); await service.joinRoom('b', 'B', room.id);
    await service.startGame(room.id, 'a');
    const state = internalRoom(room.id); state.calledNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    wallet.tx.gameSession.create.mockRejectedValueOnce(new Error('session failed'));
    await expect(service.callBingo('a', room.id)).rejects.toThrow();
    expect(wallet.users.get('a')!.balance).toBe(990n);
    expect(state.phase).toBe('playing');
    expect((await service.callBingo('a', room.id)).valid).toBe(true);
    expect(wallet.users.get('a')!.balance).toBe(1009n);
  });

  it('rejects inactive/excluded players and invalid integer tickets before charging', async () => {
    await expect(service.createRoom('line', NaN, 2)).rejects.toThrow();
    await expect(service.createRoom('line', 1.5, 2)).rejects.toThrow();
    const room = await service.createRoom('line', 10, 2);
    wallet.users.get('a')!.status = 'BANNED';
    await expect(service.joinRoom('a', 'A', room.id)).rejects.toThrow();
    wallet.limits.set('b', { selfExclusionEnabled: true, selfExcludeUntil: null });
    await expect(service.joinRoom('b', 'B', room.id)).rejects.toThrow();
    expect(wallet.journal).toHaveLength(0);
  });
});
