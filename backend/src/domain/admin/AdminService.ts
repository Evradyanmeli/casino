import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../auth/AuthService.js';
import { ECONOMIC_DEFAULTS, isValidEconomicSetting } from '../economy/EconomicSettings.js';
import { runFinancialOperation } from '../economy/FinancialOperation.js';
export { ECONOMIC_DEFAULTS } from '../economy/EconomicSettings.js';

export const GAME_DEFAULTS: Record<string, { minBet: number; maxBet: number }> = {
  slots: { minBet: 1, maxBet: 100000 }, roulette: { minBet: 1, maxBet: 100000 },
  blackjack: { minBet: 1, maxBet: 100000 }, videopoker: { minBet: 1, maxBet: 5 },
  craps: { minBet: 1, maxBet: 100000 }, wheel: { minBet: 1, maxBet: 100000 },
  keno: { minBet: 1, maxBet: 100000 }, plinko: { minBet: 1, maxBet: 100000 },
  mines: { minBet: 1, maxBet: 100000 }, crash: { minBet: 1, maxBet: 100000 },
  limbo: { minBet: 1, maxBet: 100000 }, poker: { minBet: 1, maxBet: 100000 },
  bingo: { minBet: 1, maxBet: 100000 },
};

// Preserve exact amounts outside JavaScript's integer range instead of rounding them.
export function adminDTO(value: any): any {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value) : value.toString();
  }
  if (value instanceof Date || value === null) return value;
  if (Array.isArray(value)) return value.map(adminDTO);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'passwordHash').map(([key, val]) => [key, adminDTO(val)]));
  return value;
}

export type DashboardPeriod = '24h' | '7d' | '30d';

export class AdminService {
  constructor(private prisma: PrismaClient) {}

  private async assertAdmin(tx: Prisma.TransactionClient, adminId: string) {
    if (!adminId) throw new AppError('Administrateur requis', 403);
    const actor = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') throw new AppError('Administrateur invalide', 403);
  }

  private integer(value: number, min = 0) {
    if (!Number.isSafeInteger(value) || value < min) throw new AppError('Montant entier invalide', 400);
  }

  async getDashboardStats(period: DashboardPeriod = '24h') {
    const days = { '24h': 1, '7d': 7, '30d': 30 }[period];
    if (!days) throw new AppError('Periode invalide', 400);
    const since = new Date(Date.now() - days * 86400000);
    const createdAt = { gte: since };
    const [totalUsers, activeUsers, depositAgg, withdrawalAgg, games, userBalance, house] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { updatedAt: createdAt } }),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'deposit', createdAt } }),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'withdrawal', createdAt } }),
      this.prisma.gameSession.aggregate({ where: { createdAt, endedAt: { gt: new Date(0) } }, _sum: { betAmount: true, winAmount: true }, _count: true }),
      this.prisma.user.aggregate({ _sum: { balance: true }, where: { role: 'USER' } }),
      this.getHouseBalance(),
    ]);
    const revenue = (games._sum.betAmount ?? 0n) - (games._sum.winAmount ?? 0n);
    return adminDTO({ period, totalUsers, activeUsers, activeUsers24h: activeUsers,
      totalDeposits: depositAgg._sum.amount ?? 0n,
      totalWithdrawals: withdrawalAgg._sum.amount === null ? 0n :
        (withdrawalAgg._sum.amount < 0n ? -withdrawalAgg._sum.amount : withdrawalAgg._sum.amount),
      totalUserBalance: userBalance._sum.balance ?? 0n,
      totalGamesPlayed: games._count, revenue, netRevenue: revenue, houseBalance: house.balance,
    });
  }

  async getUsers(page: number, limit: number, search?: string) {
    this.integer(page, 1); this.integer(limit, 1);
    if (limit > 100 || !Number.isSafeInteger((page - 1) * limit)) throw new AppError('Pagination invalide', 400);
    const where: Prisma.UserWhereInput = search ? { OR: [
      { pseudo: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ] } : {};
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, pseudo: true, role: true, status: true, balance: true,
          xp: true, level: true, createdAt: true, updatedAt: true } }),
      this.prisma.user.count({ where }),
    ]);
    return adminDTO({ users, total });
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: {
      id: true, email: true, pseudo: true, role: true, status: true, balance: true, xp: true, level: true,
      avatar: true, customAvatar: true, birthDate: true, createdAt: true, updatedAt: true,
      transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      gameSessions: { orderBy: { createdAt: 'desc' }, take: 20 }, responsibleLimits: true,
    } });
    if (!user) throw new AppError('Utilisateur introuvable', 404);
    return adminDTO(user);
  }

  async toggleUserBan(userId: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('Utilisateur introuvable', 404);
      const status = user.status === 'BANNED' ? 'ACTIVE' : 'BANNED';
      await tx.user.update({ where: { id: userId }, data: { status } });
      await tx.auditLog.create({ data: { adminId, action: status === 'BANNED' ? 'ban_user' : 'unban_user',
        entity: 'user', entityId: userId, before: { status: user.status }, after: { status } } });
    });
  }

  async adjustUserBalance(userId: string, amount: number, reason: string, adminId: string, key?: string) {
    this.integer(amount, Number.MIN_SAFE_INTEGER);
    if (!amount || !reason?.trim() || reason.trim().length > 1000) throw new AppError('Motif et montant requis', 400);
    return runFinancialOperation(this.prisma, adminId, 'admin_adjust_balance', key, { userId, amount, reason: reason.trim() }, async tx => {
      await this.assertAdmin(tx, adminId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('Utilisateur introuvable', 404);
      const changed = await tx.user.updateMany({ where: { id: userId, balance: amount < 0
        ? { gte: -BigInt(amount) } : { lte: BigInt(Number.MAX_SAFE_INTEGER) - BigInt(amount) } },
        data: { balance: { increment: BigInt(amount) } } });
      if (!changed.count) throw new AppError('Solde insuffisant ou hors limites', 400);
      const after = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
      await tx.transaction.create({ data: { userId, amount: BigInt(amount),
        type: amount > 0 ? 'admin_deposit' : 'admin_withdrawal', description: reason.trim() } });
      await tx.auditLog.create({ data: { adminId, action: 'adjust_user_balance', entity: 'user', entityId: userId,
        before: { balance: (after.balance - BigInt(amount)).toString() },
        after: { balance: after.balance.toString(), amount, reason: reason.trim() } } });
      return { success: true };
    });
  }

  async getGameStats(game?: string) {
    const groups = await this.prisma.gameSession.groupBy({ by: ['gameType'],
      where: { ...(game ? { gameType: game === 'slots' ? { in: ['slots', 'slots_classic', 'slots_fruit', 'slots_diamond'] } : game } : {}), endedAt: { gt: new Date(0) } }, _count: true, _sum: { betAmount: true, winAmount: true } });
    const stats = new Map<string, { game: string; playCount: number; totalBet: bigint; totalWin: bigint }>();
    for (const group of groups) {
      const name = group.gameType.startsWith('slots_') ? 'slots' : group.gameType;
      const row = stats.get(name) ?? { game: name, playCount: 0, totalBet: 0n, totalWin: 0n };
      row.playCount += group._count; row.totalBet += group._sum.betAmount ?? 0n; row.totalWin += group._sum.winAmount ?? 0n;
      stats.set(name, row);
    }
    return [...stats.values()].map(s => adminDTO({ ...s, rtp: s.totalBet ? Number(s.totalWin * 10000n / s.totalBet) / 100 : 0 }));
  }

  async getRecentGames(limit = 20) {
    this.integer(limit, 1);
    if (limit > 100) throw new AppError('Pagination invalide', 400);
    return adminDTO(await this.prisma.gameSession.findMany({ orderBy: { createdAt: 'desc' }, take: limit,
      include: { user: { select: { pseudo: true } } } }));
  }

  async getSettings() {
    const persisted = (await this.prisma.systemSetting.findMany()).filter(s => !/^(session_started:|race_calendar:|slots_bonus:|chat_muted_user_ids$|task_reward_base$|task_reward_all$)/.test(s.key));
    const keys = new Set(persisted.map(s => s.key));
    return [...persisted, ...Object.entries(ECONOMIC_DEFAULTS).filter(([key]) => !keys.has(key))
      .map(([key, value]) => ({ key, value }))];
  }

  async updateSetting(key: string, value: Prisma.InputJsonValue, adminId: string) {
    return this.updateSettings([{ key, value }], adminId);
  }

  async updateSettings(settings: { key: string; value: Prisma.InputJsonValue }[], adminId: string) {
    if (!settings.length || settings.length > 100 || new Set(settings.map(s => s.key)).size !== settings.length)
      throw new AppError('Parametres invalides', 400);
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      for (const { key, value } of settings) {
        const before = await tx.systemSetting.findUnique({ where: { key } });
        if (/^(session_started:|race_calendar:|slots_bonus:|chat_muted_user_ids$|task_reward_base$|task_reward_all$)/.test(key) || (!Object.hasOwn(ECONOMIC_DEFAULTS, key) && !before))
          throw new AppError('Parametre inconnu ou reserve', 400);
        if (Object.hasOwn(ECONOMIC_DEFAULTS, key)) {
          if (!isValidEconomicSetting(key, value)) throw new AppError('Valeur invalide', 400);
        }
        await tx.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
        await tx.auditLog.create({ data: { adminId, action: 'update_setting', entity: 'system_setting', entityId: key,
          ...(before ? { before: { value: before.value } as Prisma.InputJsonObject } : {}), after: { value } } });
      }
    });
  }

  async deleteSetting(key: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      if (/^(session_started:|race_calendar:|slots_bonus:|chat_muted_user_ids$|task_reward_base$|task_reward_all$)/.test(key)) throw new AppError('Parametre reserve', 400);
      const before = await tx.systemSetting.findUnique({ where: { key } });
      if (!before) throw new AppError('Parametre introuvable', 404);
      await tx.systemSetting.delete({ where: { key } });
      await tx.auditLog.create({ data: { adminId, action: 'delete_setting', entity: 'system_setting', entityId: key,
        before: { value: before.value } as Prisma.InputJsonObject } });
    });
  }

  async getHouseBalance() {
    return this.prisma.$transaction(async tx => {
      const [house, setting] = await Promise.all([
        tx.user.findFirst({ where: { role: 'ADMIN', email: 'admin@casino.com' }, select: { id: true, balance: true } }),
        tx.systemSetting.findUnique({ where: { key: 'initial_capital' } }),
      ]);
      const capital = typeof setting?.value === 'number' && Number.isSafeInteger(setting.value) && setting.value > 0
        ? setting.value : ECONOMIC_DEFAULTS.initial_capital;
      const balance = house?.balance ?? 0n;
      const reserves = house ? await tx.transaction.findMany({ where: { userId: house.id,
        type: { in: ['poker_bot_funding', 'game_house_reserve'] },
        metadata: { path: ['escrowStatus'], equals: 'active' } }, select: { type: true, metadata: true } }) : [];
      let reservedBots = 0n, reservedGames = 0n;
      for (const entry of reserves) {
        const amount = BigInt((entry.metadata as { escrowAmount: string }).escrowAmount);
        if (entry.type === 'poker_bot_funding') reservedBots += amount;
        else reservedGames += amount;
      }
      const totalBalance = balance + reservedBots + reservedGames;
      const used = BigInt(capital) - totalBalance;
      return adminDTO({ balance, reservedBots, reservedGames, totalBalance, capital, capitalUsed: used,
        capitalUsagePercent: Number(used * 10000n / BigInt(capital)) / 100 });
    }, { isolationLevel: 'RepeatableRead' });
  }

  async rechargeHouse(amount: number, adminId: string, key?: string) {
    this.integer(amount, 1);
    return runFinancialOperation(this.prisma, adminId, 'admin_house_recharge', key, { amount }, async tx => {
      await this.assertAdmin(tx, adminId);
      const house = await tx.user.findFirst({ where: { role: 'ADMIN', email: 'admin@casino.com' } });
      if (!house) throw new AppError('House account not found', 404);
      const changed = await tx.user.updateMany({ where: { id: house.id,
        balance: { lte: BigInt(Number.MAX_SAFE_INTEGER) - BigInt(amount) } }, data: { balance: { increment: BigInt(amount) } } });
      if (!changed.count) throw new AppError('Solde hors limites', 400);
      const after = await tx.user.findUniqueOrThrow({ where: { id: house.id }, select: { balance: true } });
      await tx.transaction.create({ data: { userId: house.id, amount: BigInt(amount), type: 'house_recharge',
        description: `House recharge: ${amount} GC` } });
      await tx.auditLog.create({ data: { adminId, action: 'house_recharge', entity: 'house_account', entityId: house.id,
        before: { balance: (after.balance - BigInt(amount)).toString() }, after: { amount, balance: after.balance.toString() } } });
      return { success: true };
    });
  }

  async getGameConfigs() {
    const persisted = await this.prisma.gameConfig.findMany({ orderBy: { gameType: 'asc' } });
    const edge = await this.prisma.systemSetting.findUnique({ where: { key: 'default_house_edge' } });
    const houseEdge = typeof edge?.value === 'number' ? edge.value : ECONOMIC_DEFAULTS.default_house_edge;
    const keys = new Set(persisted.map(s => s.gameType));
    return adminDTO([...persisted, ...Object.entries(GAME_DEFAULTS).filter(([game]) => !keys.has(game))
      .map(([gameType, limits]) => ({ gameType, ...limits, houseEdge, active: true }))]
      .sort((a, b) => a.gameType.localeCompare(b.gameType)));
  }

  async updateGameConfig(gameType: string, data: { houseEdge?: number; minBet?: number; maxBet?: number; active?: boolean }, adminId: string) {
    if (!Object.hasOwn(GAME_DEFAULTS, gameType)) throw new AppError('Jeu inconnu', 400);
    if (data.minBet !== undefined) this.integer(data.minBet, 1);
    if (data.maxBet !== undefined) this.integer(data.maxBet, 1);
    if (data.houseEdge !== undefined && (!Number.isFinite(data.houseEdge) || data.houseEdge < 0 || data.houseEdge >= 100))
      throw new AppError('House edge invalide', 400);
    if (data.active !== undefined && typeof data.active !== 'boolean') throw new AppError('Etat invalide', 400);
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      const existing = await tx.gameConfig.findUnique({ where: { gameType } });
      const edge = await tx.systemSetting.findUnique({ where: { key: 'default_house_edge' } });
      const minBet = BigInt(data.minBet ?? existing?.minBet ?? GAME_DEFAULTS[gameType].minBet);
      const maxBet = BigInt(data.maxBet ?? existing?.maxBet ?? GAME_DEFAULTS[gameType].maxBet);
      if (minBet > maxBet || (gameType === 'videopoker' && maxBet > 5n)) throw new AppError('Limites de mise incompatibles', 400);
      const updated = await tx.gameConfig.upsert({ where: { gameType }, update: {
        ...(data.houseEdge !== undefined ? { houseEdge: data.houseEdge } : {}), minBet, maxBet,
        ...(data.active !== undefined ? { active: data.active } : {}),
      }, create: { gameType, houseEdge: data.houseEdge ?? (typeof edge?.value === 'number' ? edge.value : 5),
        minBet, maxBet, active: data.active ?? true } });
      const snapshot = (config: typeof updated) => adminDTO({ houseEdge: config.houseEdge,
        minBet: config.minBet, maxBet: config.maxBet, active: config.active });
      await tx.auditLog.create({ data: { adminId, action: 'update_game_config', entity: 'game_config', entityId: gameType,
        ...(existing ? { before: snapshot(existing) } : {}), after: snapshot(updated) } });
      return adminDTO(updated);
    });
  }

  async getChatMessages(room?: string, limit = 50) {
    this.integer(limit, 1);
    if (limit > 100) throw new AppError('Pagination invalide', 400);
    return this.prisma.chatMessage.findMany({ where: room ? { room } : {}, orderBy: { createdAt: 'desc' }, take: limit,
      include: { user: { select: { id: true, pseudo: true, avatar: true } } } });
  }

  async deleteChatMessage(messageId: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      const msg = await tx.chatMessage.findUnique({ where: { id: messageId } });
      if (!msg) throw new AppError('Message not found', 404);
      await tx.chatMessage.delete({ where: { id: messageId } });
      await tx.auditLog.create({ data: { adminId, action: 'delete_chat_message', entity: 'chat_message', entityId: messageId,
        before: { content: msg.content, userId: msg.userId, room: msg.room } } });
    });
  }

  async banUserFromChat(userId: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new AppError('User not found', 404);
      // Lock the setting through the upsert before merging concurrent mute requests.
      const setting = await tx.systemSetting.upsert({ where: { key: 'chat_muted_user_ids' },
        create: { key: 'chat_muted_user_ids', value: [] }, update: { updatedAt: new Date() } });
      const muted = Array.isArray(setting.value) ? setting.value.filter((v): v is string => typeof v === 'string') : [];
      await tx.systemSetting.update({ where: { key: 'chat_muted_user_ids' }, data: { value: [...new Set([...muted, userId])] } });
      await tx.chatMessage.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { adminId, action: 'ban_chat_user', entity: 'user', entityId: userId,
        before: { muted: muted.includes(userId) }, after: { muted: true } } });
    });
  }

  async createAnnouncement(title: string, content: string, type: string = 'announcement', adminId: string) {
    if (!title.trim() || title.length > 200 || !content.trim() || content.length > 10000 || !type.trim() || type.length > 50)
      throw new AppError('Annonce invalide', 400);
    return this.prisma.$transaction(async tx => {
      await this.assertAdmin(tx, adminId);
      const users = await tx.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
      await tx.notification.createMany({ data: users.map(u => ({ userId: u.id, type,
        content: JSON.stringify({ title: title.trim(), message: content.trim() }) })) });
      await tx.auditLog.create({ data: { adminId, action: 'create_announcement', entity: 'notification',
        after: { title, content, type, recipients: users.length } } });
    });
  }

  async getAuditLogs(filters: { adminId?: string; action?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) {
    this.integer(filters.limit ?? 50, 1); this.integer(filters.offset ?? 0);
    if ((filters.limit ?? 50) > 200) throw new AppError('Pagination invalide', 400);
    const start = filters.startDate ? new Date(filters.startDate) : undefined;
    const end = filters.endDate ? new Date(filters.endDate) : undefined;
    if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime())) || (start && end && start > end))
      throw new AppError('Dates invalides', 400);
    const where: Prisma.AuditLogWhereInput = { ...(filters.adminId ? { adminId: filters.adminId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}) };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: filters.limit ?? 50,
        skip: filters.offset ?? 0, include: { admin: { select: { id: true, pseudo: true } } } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total };
  }
}
