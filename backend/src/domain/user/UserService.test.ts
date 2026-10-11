import { describe, expect, it } from 'vitest';
import { UserService } from './UserService.js';
import { EconomyService, transactionFilter } from '../economy/EconomyService.js';
import { player, testDatabase } from '../admin/testSupport.js';

describe('UserService transaction filters', () => {
  it.each(['win', 'game_win', 'bet', 'game_bet', 'all', 'deposit', undefined])('shares the list/count predicate for %s', async type => {
    const ctx = testDatabase({ user: [player], transaction: [
      { id: 'legacy-win', userId: player.id, amount: 50n, type: 'win', reference: null, description: null },
      { id: 'win', userId: player.id, amount: 50n, type: 'game_win', reference: 'game', description: 'win' },
      { id: 'old-cashout-ref', userId: player.id, amount: 200n, type: 'win', reference: 'poker_cashout', description: null },
      { id: 'old-cashout-description', userId: player.id, amount: 200n, type: 'game_win', reference: null, description: 'Poker cash-out table' },
      { id: 'cashout', userId: player.id, amount: 200n, type: 'poker_cashout' },
      { id: 'deposit', userId: player.id, amount: 1000n, type: 'deposit' },
      { id: 'bet', userId: player.id, amount: -10n, type: 'game_bet' },
      { id: 'buyin', userId: player.id, amount: -200n, type: 'poker_buyin' },
      { id: 'other', userId: 'other', amount: 100n, type: 'win', reference: null, description: null },
    ] });
    const result = await new UserService(ctx.db).getTransactions(player.id, { type, limit: 1, offset: 0 });
    const all = await new EconomyService(ctx.db).getTransactions(player.id, type, 100, 0);
    expect(result.total).toBe(all.length);
    expect(result.transactions.map(t => t.id)).toEqual(all.slice(0, 1).map(t => t.id));
    expect(ctx.mocks.transaction.count).toHaveBeenCalledWith({ where: transactionFilter(player.id, type) });
    if (type === 'win' || type === 'game_win') expect(all.map(t => t.id)).toEqual(['legacy-win', 'win']);
    if (type === 'bet' || type === 'game_bet') expect(all.map(t => t.id)).toEqual(['bet', 'buyin']);
  });
});
