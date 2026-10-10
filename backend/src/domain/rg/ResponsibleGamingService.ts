import { Prisma } from '@prisma/client';
import { AppError } from '../auth/AuthService.js';
import type { EconomyDb } from '../economy/EconomyService.js';

interface RGSettings {
  depositLimit: { enabled: boolean; daily?: number; weekly?: number; monthly?: number };
  lossLimit: { enabled: boolean; daily?: number; weekly?: number; monthly?: number };
  sessionLimit: { enabled: boolean; minutes?: number };
  selfExclusion: { enabled: boolean; until?: string };
  realityCheck: { enabled: boolean; intervalMinutes?: number };
}

export class ResponsibleGamingService {
  constructor(private prisma: EconomyDb) {}

  private validateLimit(value: number | null | undefined): void {
    if (value !== undefined && value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
      throw new AppError('Limit must be a positive safe integer or null', 400);
    }
  }

  private async getOrCreateLimits(userId: string) {
    return this.prisma.responsibleLimit.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  async getSettings(userId: string): Promise<RGSettings> {
    const limits = await this.getOrCreateLimits(userId);
    return {
      depositLimit: {
        enabled: limits.depositLimitEnabled,
        daily: limits.dailyLimit ? Number(limits.dailyLimit) : undefined,
        weekly: limits.weeklyLimit ? Number(limits.weeklyLimit) : undefined,
        monthly: limits.monthlyLimit ? Number(limits.monthlyLimit) : undefined,
      },
      lossLimit: {
        enabled: limits.lossLimitEnabled,
        daily: limits.lossDailyLimit ? Number(limits.lossDailyLimit) : undefined,
        weekly: limits.lossWeeklyLimit ? Number(limits.lossWeeklyLimit) : undefined,
        monthly: limits.lossMonthlyLimit ? Number(limits.lossMonthlyLimit) : undefined,
      },
      sessionLimit: {
        enabled: limits.sessionLimitEnabled,
        minutes: limits.sessionLimitMinutes ?? undefined,
      },
      selfExclusion: {
        enabled: limits.selfExclusionEnabled,
        until: limits.selfExcludeUntil?.toISOString(),
      },
      realityCheck: {
        enabled: limits.realityCheckEnabled,
        intervalMinutes: limits.realityCheckInterval ?? undefined,
      },
    };
  }

  async updateDepositLimit(userId: string, daily?: number | null, weekly?: number | null, monthly?: number | null, enabled?: boolean): Promise<void> {
    [daily, weekly, monthly].forEach(value => this.validateLimit(value));
    const data: Omit<Prisma.ResponsibleLimitUncheckedCreateInput, 'userId'> = {};
    if (enabled !== undefined) data.depositLimitEnabled = enabled;
    else if ([daily, weekly, monthly].some(value => typeof value === 'number')) data.depositLimitEnabled = true;
    if (daily !== undefined) data.dailyLimit = daily === null ? null : BigInt(daily);
    if (weekly !== undefined) data.weeklyLimit = weekly === null ? null : BigInt(weekly);
    if (monthly !== undefined) data.monthlyLimit = monthly === null ? null : BigInt(monthly);
    await this.prisma.responsibleLimit.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async updateLossLimit(userId: string, daily?: number | null, weekly?: number | null, monthly?: number | null, enabled?: boolean): Promise<void> {
    [daily, weekly, monthly].forEach(value => this.validateLimit(value));
    const data: Omit<Prisma.ResponsibleLimitUncheckedCreateInput, 'userId'> = {};
    if (enabled !== undefined) data.lossLimitEnabled = enabled;
    else if ([daily, weekly, monthly].some(value => typeof value === 'number')) data.lossLimitEnabled = true;
    if (daily !== undefined) data.lossDailyLimit = daily === null ? null : BigInt(daily);
    if (weekly !== undefined) data.lossWeeklyLimit = weekly === null ? null : BigInt(weekly);
    if (monthly !== undefined) data.lossMonthlyLimit = monthly === null ? null : BigInt(monthly);
    await this.prisma.responsibleLimit.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async updateSessionLimit(userId: string, minutes?: number | null, enabled?: boolean): Promise<void> {
    this.validateLimit(minutes);
    if (minutes != null && minutes > 2147483647) throw new AppError('Session limit is too large', 400);
    const data: Omit<Prisma.ResponsibleLimitUncheckedCreateInput, 'userId'> = {};
    if (enabled !== undefined) data.sessionLimitEnabled = enabled;
    else if (typeof minutes === 'number') data.sessionLimitEnabled = true;
    if (minutes !== undefined) data.sessionLimitMinutes = minutes;
    await this.prisma.responsibleLimit.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async setSelfExclusion(userId: string, days: number): Promise<void> {
    this.validateLimit(days);
    const until = new Date();
    until.setDate(until.getDate() + days);
    if (!Number.isFinite(until.getTime())) throw new AppError('Exclusion duration is too large', 400);
    await this.prisma.responsibleLimit.upsert({
      where: { userId },
      update: { selfExclusionEnabled: true, selfExcludeUntil: until },
      create: { userId, selfExclusionEnabled: true, selfExcludeUntil: until },
    });
  }

  async cancelSelfExclusion(userId: string): Promise<void> {
    await this.prisma.responsibleLimit.upsert({
      where: { userId },
      update: { selfExclusionEnabled: false, selfExcludeUntil: null },
      create: { userId, selfExclusionEnabled: false },
    });
  }

  async enableRealityCheck(userId: string, intervalMinutes?: number | null, enabled?: boolean): Promise<void> {
    this.validateLimit(intervalMinutes);
    if (intervalMinutes != null && intervalMinutes > 2147483647) throw new AppError('Reality check interval is too large', 400);
    const data: Omit<Prisma.ResponsibleLimitUncheckedCreateInput, 'userId'> = {};
    if (enabled !== undefined) data.realityCheckEnabled = enabled;
    else if (typeof intervalMinutes === 'number') data.realityCheckEnabled = true;
    if (intervalMinutes !== undefined) data.realityCheckInterval = intervalMinutes;
    await this.prisma.responsibleLimit.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async canPlaceBet(userId: string, amount?: number): Promise<{ allowed: boolean; reason?: string }> {
    this.validateLimit(amount);
    const limits = await this.prisma.responsibleLimit.findUnique({ where: { userId } });
    if (!limits) return { allowed: true };

    if (limits.selfExclusionEnabled) {
      if (!limits.selfExcludeUntil || new Date() < limits.selfExcludeUntil) {
        return { allowed: false, reason: 'Vous êtes en période d\'auto-exclusion' };
      }
    }

    if (limits.lossLimitEnabled) {
      // Rolling 24h/7d/30d net journal losses, including pending stakes conservatively.
      // Poker buy-ins are exposure until cash-out; cash-out offsets loss but is not a victory.
      const periods = [limits.lossDailyLimit, limits.lossWeeklyLimit, limits.lossMonthlyLimit];
      for (const [index, limit] of periods.entries()) {
        if (limit === null) continue;
        const sum = await this.prisma.transaction.aggregate({
          where: {
            userId,
            type: { in: ['bet', 'game_bet', 'pokerbuyin', 'poker_buyin', 'win', 'game_win', 'poker_cashout', 'poker_cash_out', 'push', 'refund'] },
            createdAt: { gte: new Date(Date.now() - [1, 7, 30][index] * 86400000) },
          }, _sum: { amount: true },
        });
        const net = sum._sum.amount ?? 0n;
        const loss = net < 0n ? -net : 0n;
        if (loss >= limit || loss + BigInt(amount ?? 0) > limit) {
          return { allowed: false, reason: 'Loss limit reached' };
        }
      }
    }

    return { allowed: true };
  }

  async assertCanDeposit(userId: string, amount: bigint): Promise<void> {
    if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new AppError('Invalid deposit amount', 400);
    const limits = await this.prisma.responsibleLimit.findUnique({ where: { userId } });
    if (!limits) return;
    if (limits.selfExclusionEnabled && (!limits.selfExcludeUntil || limits.selfExcludeUntil > new Date())) {
      throw new AppError('Self-exclusion is active', 403);
    }
    if (!limits.depositLimitEnabled) return;
    // Simulated deposits and their limits are in GC, including package bonuses, not price cents.
    for (const [index, limit] of [limits.dailyLimit, limits.weeklyLimit, limits.monthlyLimit].entries()) {
      if (limit === null) continue;
      const sum = await this.prisma.transaction.aggregate({
        where: { userId, type: 'deposit', amount: { gt: 0n }, createdAt: { gte: new Date(Date.now() - [1, 7, 30][index] * 86400000) } },
        _sum: { amount: true },
      });
      if ((sum._sum.amount ?? 0n) + amount > limit) throw new AppError('Deposit limit reached', 403);
    }
  }

  async checkSession(userId: string): Promise<{ allowed: boolean; minutesRemaining?: number }> {
    const limits = await this.prisma.responsibleLimit.findUnique({ where: { userId } });
    if (!limits || !limits.sessionLimitEnabled || !limits.sessionLimitMinutes) {
      return { allowed: true };
    }

    const clock = await this.prisma.systemSetting.findUnique({ where: { key: `session_started:${userId}` } });
    if (!clock || typeof clock.value !== 'number') return { allowed: true };
    const elapsedMinutes = (Date.now() - clock.value) / 60000;
    const remaining = limits.sessionLimitMinutes - Math.floor(elapsedMinutes);

    if (remaining <= 0) {
      return { allowed: false, minutesRemaining: 0 };
    }

    return { allowed: true, minutesRemaining: remaining };
  }
}
