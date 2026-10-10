import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../auth/AuthService.js';

const profileSelect = {
  id: true, email: true, pseudo: true, role: true, status: true, balance: true,
  xp: true, level: true, avatar: true, customAvatar: true, birthDate: true, createdAt: true,
} satisfies Prisma.UserSelect;

export class UserService {
  constructor(private db: PrismaClient = prisma) {}

  async getProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return {
      ...user,
      balance: user.balance.toString(),
    };
  }

  async updateProfile(userId: string, data: { pseudo?: string; avatar?: string; customAvatar?: string }) {
    if (data.pseudo) {
      const existing = await this.db.user.findFirst({
        where: { pseudo: data.pseudo, id: { not: userId } },
      });
      if (existing) {
        throw new AppError('Pseudo already taken', 409);
      }
    }

    try {
      const user = await this.db.user.update({ where: { id: userId }, data, select: profileSelect });
      return { ...user, balance: user.balance.toString() };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') throw new AppError('Pseudo already taken', 409);
        if (err.code === 'P2025') throw new AppError('User not found', 404);
      }
      throw err;
    }
  }

  async getStats(userId: string) {
    const winning = { userId, endedAt: { gt: new Date(0) }, winAmount: { gt: this.db.gameSession.fields.betAmount } };
    const [totalSessions, totalWins, amounts, biggest] = await Promise.all([
      this.db.gameSession.count({ where: { userId, endedAt: { gt: new Date(0) } } }),
      this.db.gameSession.count({ where: winning }),
      this.db.gameSession.aggregate({ where: { userId, endedAt: { gt: new Date(0) } },
        _sum: { betAmount: true, winAmount: true } }),
      this.db.gameSession.aggregate({ where: winning, _max: { winAmount: true } }),
    ]);

    return {
      totalSessions,
      totalWins,
      winRate: totalSessions > 0 ? ((totalWins / totalSessions) * 100).toFixed(2) : '0.00',
      totalSpent: (amounts._sum.betAmount ?? 0n).toString(),
      totalWon: (amounts._sum.winAmount ?? 0n).toString(),
      biggestWin: (biggest._max.winAmount ?? 0n).toString(),
    };
  }

  async getTransactions(userId: string, filter?: { type?: string; limit?: number; offset?: number }) {
    const limit = filter?.limit ?? 20;
    const offset = filter?.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0)
      throw new AppError('Pagination invalide', 400);
    // Both types are persisted: seed uses bet/win, live games use game_bet/game_win.
    const type = filter?.type === 'bet' ? { in: ['bet', 'game_bet'] }
      : filter?.type === 'win' ? { in: ['win', 'game_win'] } : filter?.type;
    const where = { userId, ...(type ? { type } : {}) };
    const [transactions, total] = await Promise.all([
      this.db.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      this.db.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: t.amount.toString(),
      })),
      total,
      limit: filter?.limit ?? 20,
      offset: filter?.offset ?? 0,
    };
  }
}
