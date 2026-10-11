import { PrismaClient } from '@prisma/client';
import { AppError } from '../auth/AuthService.js';
import { EconomyService } from './EconomyService.js';
import type { EconomyDb } from './EconomyService.js';
import { ECONOMIC_DEFAULTS, isValidEconomicSetting } from './EconomicSettings.js';
import { runFinancialOperation } from './FinancialOperation.js';

const REWARD_PER_STREAK = 500;
const REWARD_MAX = 10000;

export interface IDailyRewardService {
  getDailyReward(userId: string): Promise<{ available: boolean; streak: number; amount: number; nextIn: string }>;
  claimDailyReward(userId: string, key?: string): Promise<{ amount: number; streak: number; newBalance: number }>;
}

export class DailyRewardService implements IDailyRewardService {
  constructor(private prisma: PrismaClient) {}

  private async rewardAmount(streak: number, db: EconomyDb = this.prisma): Promise<number> {
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ['daily_reward_base', 'daily_reward_streak_7', 'daily_reward_streak_30'] } },
    });
    const values = new Map(settings.map(s => [s.key, s.value]));
    for (const [key, value] of values) {
      if (!isValidEconomicSetting(key, value)) {
        throw new AppError('Invalid daily reward configuration', 500);
      }
    }
    if (streak >= 30) return (values.get('daily_reward_streak_30') ?? ECONOMIC_DEFAULTS.daily_reward_streak_30) as number;
    if (streak >= 7) return (values.get('daily_reward_streak_7') ?? ECONOMIC_DEFAULTS.daily_reward_streak_7) as number;
    return Math.min(((values.get('daily_reward_base') as number | undefined) ?? ECONOMIC_DEFAULTS.daily_reward_base) + REWARD_PER_STREAK * (streak - 1), REWARD_MAX);
  }

  async getDailyReward(userId: string): Promise<{ available: boolean; streak: number; amount: number; nextIn: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });
    if (!user) throw new AppError('User not found', 404);

    const record = await this.prisma.dailyReward.findUnique({
      where: { userId },
    });

    if (!record?.lastClaim) {
      return { available: true, streak: 1, amount: await this.rewardAmount(1), nextIn: '0s' };
    }

    const hoursSince = (Date.now() - record.lastClaim.getTime()) / 3_600_000;

    if (hoursSince < 24) {
      const nextAt = new Date(record.lastClaim.getTime() + 86_400_000);
      const diff = nextAt.getTime() - Date.now();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      return { available: false, streak: record.streak, amount: 0, nextIn: `${h}h ${m}m` };
    }

    const streak = hoursSince >= 48 ? 1 : record.streak + 1;
    const amount = await this.rewardAmount(streak);

    return { available: true, streak, amount, nextIn: '0s' };
  }

  async claimDailyReward(userId: string, key?: string): Promise<{ amount: number; streak: number; newBalance: number }> {
    return runFinancialOperation(this.prisma, userId, 'daily_reward', key, {}, async tx => {
      // Lock the existing user before reading/upserting the claim, including first-ever claims.
      const locked = await tx.user.updateMany({
        where: { id: userId, status: 'ACTIVE' }, data: { balance: { increment: 0n } },
      });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { birthDate: true, balance: true },
      });
      if (!user) throw new AppError('User not found', 404);
      if (locked.count !== 1) throw new AppError('Account is not active', 403);

      if (user.birthDate) {
        const age = Math.floor((Date.now() - user.birthDate.getTime()) / 31_557_600_000);
        if (age < 18) throw new AppError('You must be 18 or older to claim daily rewards', 403);
      }

      const existing = await tx.dailyReward.findUnique({ where: { userId } });

      const now = new Date();
      let streak: number;

      if (!existing?.lastClaim) {
        streak = 1;
      } else {
        const hoursSince = (now.getTime() - existing.lastClaim.getTime()) / 3_600_000;
        if (hoursSince < 24) throw new AppError('Daily reward already claimed today', 409);
        streak = hoursSince >= 48 ? 1 : existing.streak + 1;
      }

      const amount = await this.rewardAmount(streak, tx);
      const balance = await new EconomyService(tx).addBalance(userId, BigInt(amount), 'daily_reward', undefined, `Daily reward day ${streak}`);
      await tx.dailyReward.upsert({
        where: { userId },
        update: { streak, lastClaim: now },
        create: { userId, streak, lastClaim: now },
      });

      return { amount, streak, newBalance: Number(balance) };
    });
  }
}
