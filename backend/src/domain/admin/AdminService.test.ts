import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import adminRoutes from '../../api/routes/admin.js';
import { AdminService, adminDTO, ECONOMIC_DEFAULTS } from './AdminService.js';
import { admin, player, testDatabase } from './testSupport.js';

describe('AdminService', () => {
  it('serializes nested BigInt exactly and never returns password hashes', async () => {
    const ctx = testDatabase({ user: [{ ...player, passwordHash: 'secret' }],
      transaction: [{ id: 't', userId: player.id, amount: 12n }],
      gameSession: [{ userId: player.id, betAmount: 10n, winAmount: 20n }] });
    const service = new AdminService(ctx.db);
    const detail = await service.getUserDetails(player.id);
    expect(detail.passwordHash).toBeUndefined();
    expect(detail.transactions[0].amount).toBe(12);
    expect(detail.gameSessions[0].betAmount).toBe(10);
    expect(() => JSON.stringify(detail)).not.toThrow();
    expect(adminDTO({ big: 9007199254740993n, negative: -9007199254740993n }))
      .toEqual({ big: '9007199254740993', negative: '-9007199254740993' });
    const recentGames = await service.getRecentGames();
    expect(() => JSON.stringify(recentGames)).not.toThrow();
  });

  it('provides game-specific virtual defaults without modifying the database', async () => {
    const ctx = testDatabase();
    const configs = await new AdminService(ctx.db).getGameConfigs();
    expect(configs.find((c: any) => c.gameType === 'videopoker')).toMatchObject({ minBet: 1, maxBet: 5 });
    expect(configs.find((c: any) => c.gameType === 'roulette')).toMatchObject({ minBet: 1 });
    expect(ctx.state.gameConfig).toEqual([]);
    expect(() => JSON.stringify(configs)).not.toThrow();
  });

  it('filters period-based statistics and preserves negative net revenue', async () => {
    const now = new Date();
    const ctx = testDatabase({ user: [{ ...player, updatedAt: now }], transaction: [
      { userId: player.id, type: 'deposit', amount: 100n, createdAt: now },
      { userId: player.id, type: 'deposit', amount: 500n, createdAt: new Date(Date.now() - 3 * 86400000) },
    ], gameSession: [
      { betAmount: 10n, winAmount: 30n, createdAt: now },
      { betAmount: 100n, winAmount: 0n, createdAt: new Date(Date.now() - 3 * 86400000) },
    ] });
    const service = new AdminService(ctx.db);
    expect(await service.getDashboardStats('24h')).toMatchObject({ period: '24h', revenue: -20, netRevenue: -20,
      totalDeposits: 100, totalGamesPlayed: 1, activeUsers: 1 });
    expect(await service.getDashboardStats('7d')).toMatchObject({ totalDeposits: 600, totalGamesPlayed: 2, revenue: 80 });
    expect(await service.getDashboardStats('30d')).toMatchObject({ totalDeposits: 600 });
  });

  it('derives house capital from the setting and uses the same house account', async () => {
    const ctx = testDatabase({ user: [{ ...admin, email: 'admin@casino.com', balance: 2000n }],
      systemSetting: [{ key: 'initial_capital', value: 10000 }] });
    expect(await new AdminService(ctx.db).getHouseBalance()).toEqual({ balance: 2000, capital: 10000,
      capitalUsed: 8000, capitalUsagePercent: 80 });
    ctx.state.systemSetting.length = 0;
    expect((await new AdminService(ctx.db).getHouseBalance()).capital).toBe(50000000);
  });

  it('atomically adjusts balances, journals and audits the actual actor', async () => {
    const ctx = testDatabase({ user: [admin, player] });
    const service = new AdminService(ctx.db);
    await service.adjustUserBalance(player.id, -100, ' correction ', admin.id);
    expect(ctx.state.user[1].balance).toBe(900n);
    expect(ctx.state.transaction[0]).toMatchObject({ userId: player.id, amount: -100n, description: 'correction' });
    expect(ctx.state.auditLog[0]).toMatchObject({ adminId: admin.id, before: { balance: '1000' }, after: { balance: '900' } });
    ctx.mocks.auditLog.create.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.adjustUserBalance(player.id, 50, 'rollback', admin.id)).rejects.toThrow('audit failure');
    expect(ctx.state.user[1].balance).toBe(900n);
    expect(ctx.state.transaction).toHaveLength(1);
    expect(ctx.state.auditLog).toHaveLength(1);
  });

  it('prevents concurrent deductions from producing a negative balance', async () => {
    const ctx = testDatabase({ user: [admin, { ...player, balance: 100n }] });
    const service = new AdminService(ctx.db);
    const results = await Promise.allSettled([service.adjustUserBalance(player.id, -80, 'a', admin.id),
      service.adjustUserBalance(player.id, -80, 'b', admin.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(ctx.state.user[1].balance).toBe(20n);
    expect(ctx.state.transaction).toHaveLength(1);
  });

  it.each([NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, 0])('rejects unsafe adjustment %s', async amount => {
    const ctx = testDatabase({ user: [admin, player] });
    await expect(new AdminService(ctx.db).adjustUserBalance(player.id, amount, 'reason', admin.id)).rejects.toThrow();
    expect(ctx.state.transaction).toEqual([]);
  });

  it('rejects missing, non-admin and inactive actors before mutation', async () => {
    const ctx = testDatabase({ user: [admin, player, { ...admin, id: 'banned-admin', status: 'BANNED' }] });
    const service = new AdminService(ctx.db);
    for (const actor of ['', 'missing', player.id, 'banned-admin'])
      await expect(service.adjustUserBalance(player.id, 10, 'reason', actor)).rejects.toThrow();
    expect(ctx.state.transaction).toEqual([]);
  });

  it('audits ban and unban and rolls back when audit fails', async () => {
    const ctx = testDatabase({ user: [admin, player] });
    const service = new AdminService(ctx.db);
    await service.toggleUserBan(player.id, admin.id);
    await service.toggleUserBan(player.id, admin.id);
    expect(ctx.state.auditLog.map(a => a.action)).toEqual(['ban_user', 'unban_user']);
    ctx.mocks.auditLog.create.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.toggleUserBan(player.id, admin.id)).rejects.toThrow();
    expect(ctx.state.user[1].status).toBe('ACTIVE');
  });

  it('rolls back announcement delivery if audit insertion fails', async () => {
    const ctx = testDatabase({ user: [admin, player] });
    const service = new AdminService(ctx.db);
    ctx.mocks.auditLog.create.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.createAnnouncement('Notice', 'Message', 'announcement', admin.id)).rejects.toThrow();
    expect(ctx.state.notification).toEqual([]);
    await service.createAnnouncement('Notice', 'Message', undefined, admin.id);
    expect(ctx.state.notification).toHaveLength(2);
    expect(ctx.state.auditLog[0]).toMatchObject({ adminId: admin.id, after: { recipients: 2 } });
  });

  it('uses the caller, not the house account, for recharge audit and rolls back', async () => {
    const house = { ...admin, id: 'house', email: 'admin@casino.com' };
    const ctx = testDatabase({ user: [admin, house] });
    const service = new AdminService(ctx.db);
    await service.rechargeHouse(100, admin.id);
    expect(ctx.state.user[1].balance).toBe(5100n);
    expect(ctx.state.transaction[0].userId).toBe(house.id);
    expect(ctx.state.auditLog[0].adminId).toBe(admin.id);
    ctx.mocks.auditLog.create.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.rechargeHouse(100, admin.id)).rejects.toThrow();
    expect(ctx.state.user[1].balance).toBe(5100n);
    expect(ctx.state.transaction).toHaveLength(1);
  });

  it('validates effective min/max limits and config audit is atomic', async () => {
    const ctx = testDatabase({ user: [admin], gameConfig: [{ gameType: 'roulette', minBet: 1n, maxBet: 50n, houseEdge: 5, active: true }] });
    const service = new AdminService(ctx.db);
    await expect(service.updateGameConfig('roulette', { minBet: 60 }, admin.id)).rejects.toThrow();
    await expect(service.updateGameConfig('videopoker', { maxBet: 6 }, admin.id)).rejects.toThrow();
    await expect(service.updateGameConfig('roulette', { houseEdge: NaN }, admin.id)).rejects.toThrow();
    await expect(service.updateGameConfig('unknown', {}, admin.id)).rejects.toThrow();
    ctx.mocks.auditLog.create.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.updateGameConfig('roulette', { active: false }, admin.id)).rejects.toThrow();
    expect(ctx.state.gameConfig[0].active).toBe(true);
    expect(await service.updateGameConfig('videopoker', { houseEdge: 2 }, admin.id)).toMatchObject({ minBet: 1, maxBet: 5 });
    expect(ctx.state.auditLog[0].adminId).toBe(admin.id);
  });

  it('supports existing setting writes and an atomic economic batch, not arbitrary keys', async () => {
    const ctx = testDatabase({ user: [admin], systemSetting: [{ key: 'existing_custom', value: 'old' }] });
    const service = new AdminService(ctx.db);
    expect((await service.getSettings()).find(s => s.key === 'welcome_bonus')?.value).toBe(ECONOMIC_DEFAULTS.welcome_bonus);
    await service.updateSetting('existing_custom', 'new', admin.id);
    await service.updateSettings([{ key: 'welcome_bonus', value: 6000 }, { key: 'daily_reward_base', value: 1200 }], admin.id);
    await expect(service.updateSetting('arbitrary_new_key', 1, admin.id)).rejects.toThrow();
    await expect(service.updateSettings([{ key: 'welcome_bonus', value: 8000 }, { key: 'default_house_edge', value: 101 }], admin.id)).rejects.toThrow();
    expect(ctx.state.systemSetting.find(s => s.key === 'welcome_bonus')?.value).toBe(6000);
    expect(ctx.state.auditLog).toHaveLength(3);
    await service.deleteSetting('existing_custom', admin.id);
    expect(ctx.state.auditLog.at(-1)?.action).toBe('delete_setting');
  });

  it('atomically deletes chat messages and persists chat-only mutes', async () => {
    const ctx = testDatabase({ user: [admin, player], chatMessage: [{ id: 'message', userId: player.id, content: 'hello', room: 'global' }] });
    const service = new AdminService(ctx.db);
    ctx.mocks.auditLog.create.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.deleteChatMessage('message', admin.id)).rejects.toThrow();
    expect(ctx.state.chatMessage).toHaveLength(1);
    await service.banUserFromChat(player.id, admin.id);
    expect(ctx.state.user[1].status).toBe('ACTIVE');
    expect(ctx.state.systemSetting[0]).toMatchObject({ key: 'chat_muted_user_ids', value: [player.id] });
    expect(ctx.state.chatMessage).toEqual([]);
    expect(ctx.state.auditLog[0].adminId).toBe(admin.id);
  });

  it('validates audit dates, pagination and non-empty reasons', async () => {
    const service = new AdminService(testDatabase().db);
    await expect(service.getAuditLogs({ startDate: 'bad' })).rejects.toThrow();
    await expect(service.getAuditLogs({ startDate: '2026-10-10', endDate: '2026-10-01' })).rejects.toThrow();
    await expect(service.getAuditLogs({ offset: -1 })).rejects.toThrow();
    await expect(service.getChatMessages(undefined, -1)).rejects.toThrow();
    await expect(service.getUsers(Number.MAX_SAFE_INTEGER, 100)).rejects.toThrow();
    await expect(service.adjustUserBalance(player.id, 1, '   ', admin.id)).rejects.toThrow();
  });
});

describe('admin HTTP contract', () => {
  it('uses JWT sub for every mutation and validates the period and query bounds', async () => {
    const ctx = testDatabase({ user: [admin, player] });
    const app = Fastify();
    app.decorate('prisma', ctx.db);
    app.decorate('authenticate', async (request: any) => { request.user = { sub: admin.id }; });
    await app.register(adminRoutes);
    try {
      for (const url of ['/admin/dashboard?period=invalid', '/admin/chat/messages?limit=-1', '/admin/audit-logs?offset=-1'])
        expect((await app.inject({ method: 'GET', url })).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/admin/dashboard?period=7d' })).json().period).toBe('7d');
      const response = await app.inject({ method: 'POST', url: `/admin/users/${player.id}/adjust-balance`,
        payload: { amount: 10, reason: 'test', adminId: 'spoofed' } });
      expect(response.statusCode).toBe(200);
      expect(ctx.state.auditLog[0].adminId).toBe(admin.id);
      expect((await app.inject({ method: 'PUT', url: '/admin/settings', payload: {
        settings: [{ key: 'welcome_bonus', value: 100 }, { key: 'default_house_edge', value: 2 }],
      } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: `/admin/users/${player.id}/adjust-balance`,
        payload: { amount: Number.MAX_SAFE_INTEGER + 1, reason: 'unsafe' } })).statusCode).toBe(400);
    } finally { await app.close(); }
  });
});
