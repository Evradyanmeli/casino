import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { ShopService } from './ShopService.js';
import shopRoutes from '../../api/routes/shop.js';
import { player, testDatabase } from '../admin/testSupport.js';

describe('ShopService financial operations', () => {
  it('replays a purchase without issuing again or consuming the deposit limit again', async () => {
    const ctx = testDatabase({ user: [player], responsibleLimit: [{ userId: player.id,
      depositLimitEnabled: true, dailyLimit: 1000n, weeklyLimit: null, monthlyLimit: null }] });
    const service = new ShopService(ctx.db);
    const first = await service.purchasePackage(player.id, 'starter', 'purchase-1');
    expect(first).toEqual({ tokensAwarded: 1000, newBalance: 2000 });
    expect(await service.purchasePackage(player.id, 'starter', 'purchase-1')).toEqual(first);
    expect(ctx.state.user[0].balance).toBe(2000n);
    expect(ctx.state.transaction).toHaveLength(1);
    expect(ctx.state.transaction[0]).toMatchObject({ userId: player.id, type: 'deposit', amount: 1000n });
    await expect(service.purchasePackage(player.id, 'casual', 'purchase-1')).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.purchasePackage(player.id, 'starter', 'purchase-2')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('keeps legacy keyless purchases and rolls back a keyed failed journal', async () => {
    const ctx = testDatabase({ user: [player] });
    const service = new ShopService(ctx.db);
    await service.purchasePackage(player.id, 'starter');
    await service.purchasePackage(player.id, 'starter');
    expect(ctx.state.user[0].balance).toBe(3000n);
    ctx.mocks.transaction.create.mockRejectedValueOnce(new Error('journal failed'));
    await expect(service.purchasePackage(player.id, 'regular', 'failure')).rejects.toThrow('journal failed');
    expect(ctx.state.user[0].balance).toBe(3000n);
    expect(ctx.state.transaction).toHaveLength(2);
    expect(ctx.state.financialOperation).toEqual([]);
  });

  it('includes bonuses in the credited amount and prevents inactive purchases', async () => {
    const ctx = testDatabase({ user: [player] });
    expect(await new ShopService(ctx.db).purchasePackage(player.id, 'regular')).toEqual({ tokensAwarded: 15000, newBalance: 16000 });
    ctx.state.user[0].status = 'BANNED';
    await expect(new ShopService(ctx.db).purchasePackage(player.id, 'starter')).rejects.toMatchObject({ statusCode: 403 });
    expect(ctx.state.transaction).toHaveLength(1);
  });

  it('forwards HTTP keys and replays simultaneous retry responses', async () => {
    const ctx = testDatabase({ user: [player] });
    const app = Fastify();
    app.decorate('prisma', ctx.db);
    app.decorate('authenticate', async (request: any) => { request.user = { sub: player.id }; });
    await app.register(shopRoutes);
    try {
      const request = { method: 'POST' as const, url: '/shop/purchase/starter', headers: { 'idempotency-key': 'http-purchase' } };
      const responses = await Promise.all([app.inject(request), app.inject(request)]);
      expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
      expect(responses[0].json()).toEqual(responses[1].json());
      expect(ctx.state.transaction).toHaveLength(1);
    } finally { await app.close(); }
  });
});
