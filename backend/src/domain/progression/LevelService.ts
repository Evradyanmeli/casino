import { Prisma, PrismaClient } from '@prisma/client';
import { NotificationService } from '../notification/NotificationService.js';
import { EconomyService } from '../economy/EconomyService.js';
import { AppError } from '../auth/AuthService.js';

export class LevelService {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient, private notificationService?: NotificationService) {}

  xpForLevel(level: number): number {
    return level <= 1 ? 0 : 100 * level * (level + 1) / 2;
  }

  xpForNextLevel(currentLevel: number): number {
    return this.xpForLevel(currentLevel + 1) - this.xpForLevel(currentLevel);
  }

  async addXp(userId: string, amount: number): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647) throw new AppError('XP invalide', 400);
    return new EconomyService(this.prisma).runInTransaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: userId, xp: { lte: 2147483647 - amount } },
        data: { xp: { increment: amount } } });
      if (!changed.count) throw new AppError('Utilisateur introuvable ou limite XP atteinte', 400);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      let currentLevel = user.level;
      while (user.xp >= this.xpForLevel(currentLevel + 1)) currentLevel++;
      let leveledUp = false;
      if (currentLevel > user.level) {
        const advanced = await tx.user.updateMany({ where: { id: userId, level: { lt: currentLevel } }, data: { level: currentLevel } });
        leveledUp = advanced.count > 0;
        if (leveledUp) await new NotificationService(tx).createNotification(userId, 'level_up',
          JSON.stringify({ title: 'Montée de niveau !', message: `Vous avez atteint le niveau ${currentLevel} !` }));
      }
      const now = new Date();
      const race = amount > 0 ? await tx.race.findFirst({ where: { status: 'active', startAt: { lte: now }, endAt: { gte: now } } }) : null;
      if (race) {
        await tx.raceEntry.upsert({ where: { raceId_userId: { raceId: race.id, userId } },
          create: { raceId: race.id, userId, xp: 0 }, update: {} });
        const progress = await tx.raceEntry.updateMany({ where: { raceId: race.id, userId, xp: { lte: 2147483647 - amount } },
          data: { xp: { increment: amount } } });
        if (!progress.count) throw new AppError('Limite XP de course atteinte', 400);
      }
      return { newXp: user.xp, newLevel: currentLevel, leveledUp };
    });
  }

  async getUserLevel(userId: string): Promise<{ xp: number; level: number; nextLevelXp: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const nextLevelXp = this.xpForLevel(user.level + 1);
    return { xp: user.xp, level: user.level, nextLevelXp };
  }

  async getLevelProgress(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const xpForCurrent = this.xpForLevel(user.level);
    const xpForNext = this.xpForLevel(user.level + 1);
    const xpInCurrentLevel = user.xp - xpForCurrent;
    const xpNeeded = xpForNext - xpForCurrent;
    return {
      xp: user.xp,
      level: user.level,
      currentLevelXp: xpForCurrent,
      nextLevelXp: xpForNext,
      xpInCurrentLevel: Math.max(0, xpInCurrentLevel),
      xpForNextLevel: xpNeeded,
      progressPercent: Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeeded) * 100)),
    };
  }
}
