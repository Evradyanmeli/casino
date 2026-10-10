import { PrismaClient, Badge, UserBadge } from '@prisma/client';
import { NotificationService } from '../notification/NotificationService.js';
import { LevelService } from './LevelService.js';
import { AppError } from '../auth/AuthService.js';

export class BadgeService {
  constructor(
    private prisma: PrismaClient,
    private notificationService?: NotificationService,
    private levelService?: LevelService,
  ) {}

  async getAllBadges(): Promise<Badge[]> {
    return this.prisma.badge.findMany({ orderBy: { category: 'asc' } });
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async checkAndAwardBadges(userId: string): Promise<{ badges: Badge[]; leveledUp: boolean; newLevel: number }> {
    const allBadges = await this.prisma.badge.findMany();
    const earnedBadgeIds = (await this.prisma.userBadge.findMany({ where: { userId } })).map(ub => ub.badgeId);
    const newBadges: Badge[] = [];
    let leveledUp = false;
    let newLevel = 0;

    for (const badge of allBadges) {
      if (earnedBadgeIds.includes(badge.id)) continue;
      const earned = await this.checkBadgeCondition(userId, badge);
      if (earned) {
        const awarded = await this.prisma.$transaction(async tx => {
          const inserted = await tx.userBadge.createMany({ data: [{ userId, badgeId: badge.id }], skipDuplicates: true });
          if (!inserted.count) return null;
          if (!Number.isSafeInteger(badge.xpReward) || badge.xpReward < 0) throw new AppError('Invalid badge reward', 400);
          const result = await new LevelService(tx).addXp(userId, badge.xpReward);
          await new NotificationService(tx).createNotification(userId, 'badge_earned',
            JSON.stringify({ title: 'Badge débloqué !', message: `Vous avez obtenu le badge "${badge.name}" !` }));
          return result;
        });
        if (awarded) {
          if (awarded.leveledUp) { leveledUp = true; newLevel = awarded.newLevel; }
          newBadges.push(badge);
        }
      }
    }

    return { badges: newBadges, leveledUp, newLevel };
  }

  async checkBadgeCondition(userId: string, badge: Badge): Promise<boolean> {
    const condition = badge.condition as { type: string; count: number; game?: string; amount?: number; level?: number };

    switch (condition.type) {
      case 'games_played': {
        const where: any = { userId };
        if (condition.game) where.gameType = condition.game;
        const count = await this.prisma.gameSession.count({ where });
        return count >= condition.count;
      }
      case 'total_won': {
        const result = await this.prisma.gameSession.aggregate({ where: { userId }, _sum: { winAmount: true }, _max: { winAmount: true } });
        const amount = badge.slug === 'big_win' ? result._max.winAmount : result._sum.winAmount;
        return (amount ?? 0n) >= BigInt(condition.amount || 0);
      }
      case 'level_reached': {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return user.level >= (condition.level || 0);
      }
      case 'streak': {
        const reward = await this.prisma.dailyReward.findUnique({ where: { userId } });
        return (reward?.streak || 0) >= (condition.count || 0);
      }
      case 'vip_deposit': {
        const result = await this.prisma.transaction.aggregate({
          where: { userId, type: 'deposit' },
          _sum: { amount: true },
        });
        return (result._sum.amount ?? 0n) >= BigInt(condition.amount || 0);
      }
      default:
        return false;
    }
  }
}
