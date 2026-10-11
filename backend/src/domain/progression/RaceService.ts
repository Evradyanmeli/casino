import { PrismaClient, Race, RaceEntry } from '@prisma/client';
import { EconomyService } from '../economy/EconomyService.js';
import { AppError } from '../auth/AuthService.js';
import { ECONOMIC_DEFAULTS, isValidEconomicSetting } from '../economy/EconomicSettings.js';
import { runFinancialOperation } from '../economy/FinancialOperation.js';

export class RaceService {
  constructor(private prisma: PrismaClient, private io?: any) {}

  async getCurrentRace(): Promise<Race | null> {
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      const expired = await tx.race.findMany({ where: { status: { in: ['active', 'upcoming'] }, endAt: { lt: now } } });
      for (const candidate of expired) {
        // This Race lock is also held by addXp until its entry update commits.
        const closed = await tx.race.updateMany({ where: { id: candidate.id, status: { in: ['active', 'upcoming'] }, endAt: { lt: new Date() } }, data: { status: 'completed' } });
        if (!closed.count) continue;
        const race = await tx.race.findUniqueOrThrow({ where: { id: candidate.id } });
        const entries = await tx.raceEntry.findMany({ where: { raceId: race.id }, orderBy: [{ xp: 'desc' }, { userId: 'asc' }] });
        for (const [index, entry] of entries.entries()) {
          const prize = this.prizeForRank(race, index + 1);
          if (!Number.isSafeInteger(prize) || prize < 0 || prize > 2147483647) throw new AppError('Invalid race prize', 400);
          await tx.raceEntry.update({ where: { id: entry.id }, data: { rank: index + 1, prize } });
        }
      }
    });
    let race = await this.prisma.race.findFirst({
      where: { status: 'active', startAt: { lte: now }, endAt: { gte: now } },
    });

    if (!race) {
      race = await this.prisma.race.findFirst({
        where: { status: 'upcoming', endAt: { gte: now } },
        orderBy: { startAt: 'asc' },
      });

      if (!race) race = await this.createNextRace();
      if (race && now >= race.startAt && now <= race.endAt) {
        await this.prisma.race.updateMany({
          where: { id: race.id, status: 'upcoming', endAt: { gt: new Date() } },
          data: { status: 'active' },
        });
        race = await this.prisma.race.findUnique({ where: { id: race.id } });
      }
    }

    return race;
  }

  async getLeaderboard(raceId: string, limit: number = 50): Promise<RaceEntry[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError('Pagination invalide', 400);
    return this.prisma.raceEntry.findMany({
      where: { raceId },
      orderBy: [{ xp: 'desc' }, { userId: 'asc' }],
      take: limit,
      include: { user: { select: { id: true, pseudo: true, avatar: true } } },
    });
  }

  async getUserRank(userId: string, raceId: string): Promise<{ rank: number; xp: number; prize: number }> {
    const entry = await this.prisma.raceEntry.findUnique({
      where: { raceId_userId: { raceId, userId } },
    });

    if (!entry) return { rank: 0, xp: 0, prize: 0 };
    if (entry.rank) return { rank: entry.rank, xp: entry.xp, prize: entry.prize };

    const higher = await this.prisma.raceEntry.count({
      where: { raceId, OR: [{ xp: { gt: entry.xp } }, { xp: entry.xp, userId: { lt: userId } }] },
    });

    const rank = higher + 1;
    const prize = await this.calculatePrize(raceId, rank);
    return { rank, xp: entry.xp, prize };
  }

  async claimPrize(userId: string, raceId?: string, key?: string): Promise<number> {
    return runFinancialOperation(this.prisma, userId, 'race_prize', key, { raceId: raceId ?? null }, async tx => {
      // Resolve the optional target inside the operation so a retry replays the same prize.
      const entry = raceId
        ? await tx.raceEntry.findUnique({ where: { raceId_userId: { raceId, userId } }, include: { race: true } })
        : await tx.raceEntry.findFirst({ where: { userId, claimed: false, race: { status: 'completed' } },
          orderBy: { race: { endAt: 'desc' } }, include: { race: true } });
      if (!entry) throw new AppError(raceId ? 'Race entry not found' : 'No race found', raceId ? 404 : 400);
      if (entry.race.status !== 'completed' || entry.race.endAt >= new Date()) throw new AppError('Race not completed yet', 400);
      if (!entry.rank || entry.rank < 1) throw new AppError('Race not ranked yet', 400);
      const prize = entry.prize;
      if (!Number.isSafeInteger(prize) || prize < 0 || prize > 2147483647) throw new AppError('Invalid race prize', 400);
      const claimed = await tx.raceEntry.updateMany({ where: { id: entry.id, userId, claimed: false }, data: { claimed: true } });
      if (!claimed.count) throw new AppError('Prize already claimed', 400);
      if (prize > 0) await new EconomyService(tx).addBalance(userId, BigInt(prize), 'race_prize', entry.id, entry.race.name);
      return prize;
    });
  }

  async getClaimableRace(userId: string): Promise<Race | null> {
    await this.getCurrentRace();
    const entry = await this.prisma.raceEntry.findFirst({ where: { userId, claimed: false, race: { status: 'completed' } },
      orderBy: { race: { endAt: 'desc' } }, include: { race: true } });
    return entry?.race ?? null;
  }

  private async calculatePrize(raceId: string, rank: number): Promise<number> {
    const race = await this.prisma.race.findUniqueOrThrow({ where: { id: raceId } });
    return this.prizeForRank(race, rank);
  }

  private prizeForRank(race: Race, rank: number): number {
    const prizeMap = race.prize as Record<string, number>;

    if (Object.hasOwn(prizeMap, rank)) return prizeMap[rank];

    for (const [key, val] of Object.entries(prizeMap)) {
      if (key.includes('_')) {
        const [min, max] = key.split('_').map(Number);
        if (rank >= min && rank <= max) return val;
      }
    }

    return 0;
  }

  private async createNextRace(): Promise<Race> {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = (day === 0 ? 6 : day - 1);
    const mondayStart = new Date(now);
    mondayStart.setUTCDate(now.getUTCDate() - diff);
    mondayStart.setUTCHours(0, 0, 0, 0);

    if (now < mondayStart) mondayStart.setUTCDate(mondayStart.getUTCDate() - 7);

    const endAt = new Date(mondayStart);
    endAt.setUTCDate(mondayStart.getUTCDate() + 6);
    endAt.setUTCHours(23, 59, 59, 999);

    const weekNumber = Math.ceil((mondayStart.getTime() - new Date(mondayStart.getFullYear(), 0, 1).getTime()) / 604800000);

    return this.prisma.$transaction(async tx => {
      const key = `race_calendar:${mondayStart.toISOString()}`;
      await tx.systemSetting.upsert({ where: { key }, create: { key, value: true }, update: { updatedAt: new Date() } });
      const existing = await tx.race.findFirst({ where: { startAt: mondayStart, endAt } });
      if (existing) return existing;
      const settings = await tx.systemSetting.findMany({ where: { key: { in: ['competition_prize_first', 'competition_prize_second', 'competition_prize_third'] } } });
      const prizes: Record<string, number> = { '4_10': 0 };
      for (const [index, key] of ['competition_prize_first', 'competition_prize_second', 'competition_prize_third'].entries()) {
        const value = settings.find(s => s.key === key)?.value ?? ECONOMIC_DEFAULTS[key];
        if (!isValidEconomicSetting(key, value)) throw new AppError('Invalid race prize configuration', 400);
        prizes[index + 1] = value;
      }
      return tx.race.create({ data: {
        name: `Course Semaine ${weekNumber}`,
        startAt: mondayStart,
        endAt,
        status: now >= mondayStart ? 'active' : 'upcoming',
        prize: prizes,
      },
      });
    });
  }
}
