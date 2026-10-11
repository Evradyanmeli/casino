import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../auth/AuthService.js';
import { ResponsibleGamingService } from '../rg/ResponsibleGamingService.js';

export type EconomyDb = PrismaClient | Prisma.TransactionClient;
export const GAME_BET_TYPES = ['bet', 'game_bet', 'pokerbuyin', 'poker_buyin'];
export const GAME_WIN_TYPES = ['win', 'game_win'];
export function transactionFilter(userId: string, filter?: string): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (filter === 'win' || filter === 'game_win') {
    where.type = { in: GAME_WIN_TYPES };
    where.AND = [
      { OR: [{ reference: null }, { reference: { notIn: ['poker_cashout', 'poker_cash_out'] } }] },
      { OR: [{ description: null }, { NOT: { description: { contains: 'Poker cash-out', mode: 'insensitive' } } }] },
    ];
  } else if (filter === 'bet' || filter === 'game_bet') where.type = { in: GAME_BET_TYPES };
  else if (filter && filter !== 'all') where.type = filter;
  return where;
}
const MAX_BALANCE = BigInt(Number.MAX_SAFE_INTEGER);

export function assertPositiveAmount(amount: bigint): void {
  if (typeof amount !== 'bigint' || amount <= 0n || amount > MAX_BALANCE) {
    throw new AppError('Amount must be a positive safe integer', 400);
  }
}

export interface IEconomyService {
  getBalance(userId: string): Promise<bigint>;
  addBalance(userId: string, amount: bigint, type: string, reference?: string, description?: string): Promise<bigint>;
  deductBalance(userId: string, amount: bigint, type: string, reference?: string, description?: string, metadata?: Prisma.InputJsonValue): Promise<bigint>;
  getTransactions(userId: string, filter?: string, limit?: number, offset?: number): Promise<any[]>;
  getHouseBalance(): Promise<bigint>;
  rechargeHouse(amount: bigint): Promise<void>;
  assertCanPlay(userId: string, gameType: string, amount?: bigint): Promise<void>;
}

export class EconomyService implements IEconomyService {
  constructor(private prisma: EconomyDb) {}

  // A supplied transaction belongs to the caller; failures must propagate to it.
  async runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if ('$transaction' in this.prisma) return this.prisma.$transaction(work);
    return work(this.prisma);
  }

  async assertCanPlay(userId: string, gameType: string, amount?: bigint): Promise<void> {
    // In a caller transaction, hold the user lock through the subsequent debit so
    // competing bets cannot both pass the same net-loss headroom check.
    await this.prisma.user.updateMany({
      where: { id: userId }, data: { balance: { increment: 0n } },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new AppError('User not found', 404);
    if (user.status !== 'ACTIVE') throw new AppError('Account is not active', 403);
    if (amount !== undefined) assertPositiveAmount(amount);
    const rg = new ResponsibleGamingService(this.prisma);
    const allowed = await rg.canPlaceBet(userId, amount === undefined ? undefined : Number(amount));
    if (!allowed.allowed) throw new AppError(allowed.reason ?? 'Play is not allowed', 403);
    const session = await rg.checkSession(userId);
    if (!session.allowed) throw new AppError('Session limit reached', 403);

    const normalized = gameType.toLowerCase();
    const configType = normalized.startsWith('slots_') || normalized.startsWith('slots-') ? 'slots' : normalized;
    const config = await this.prisma.gameConfig.findUnique({ where: { gameType: configType } });
    if (config && !config.active) throw new AppError('Game is disabled', 403);
    // Stored Video Poker minBet may be 10 while the game UI offers 1..5.
    // Do not silently override persisted configuration or apply bounds to action-only guards.
    if (config && amount !== undefined && (amount < config.minBet || amount > config.maxBet)) {
      throw new AppError('Bet is outside configured limits', 400);
    }
  }

  async getBalance(userId: string): Promise<bigint> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) throw new AppError('User not found', 404);
    return user.balance;
  }

  async addBalance(userId: string, amount: bigint, type: string, reference?: string, description?: string): Promise<bigint> {
    assertPositiveAmount(amount);
    return this.runInTransaction(async tx => {
      const updated = await tx.user.updateMany({
        where: { id: userId, balance: { gte: 0n, lte: MAX_BALANCE - amount } },
        data: { balance: { increment: amount } },
      });
      const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      if (!user) throw new AppError('User not found', 404);
      if (updated.count !== 1) throw new AppError('Balance exceeds safe limits', 400);
      await tx.transaction.create({ data: { userId, amount, type, reference, description } });
      return user.balance;
    });
  }

  async deductBalance(userId: string, amount: bigint, type: string, reference?: string, description?: string, metadata?: Prisma.InputJsonValue): Promise<bigint> {
    assertPositiveAmount(amount);
    return this.runInTransaction(async tx => {
      const updated = await tx.user.updateMany({
        where: { id: userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      if (!user) throw new AppError('User not found', 404);
      if (updated.count !== 1) throw new AppError('Insufficient balance', 400);
      await tx.transaction.create({ data: { userId, amount: -amount, type, reference, description, ...(metadata ? { metadata } : {}) } });
      return user.balance;
    });
  }

  async getTransactions(userId: string, filter?: string, limit?: number, offset?: number): Promise<any[]> {
    const where = transactionFilter(userId, filter);

    return this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ?? 20,
      skip: offset ?? 0,
    });
  }

  async getHouseBalance(): Promise<bigint> {
    const house = await this.prisma.user.findFirst({
      where: { role: 'ADMIN', email: 'admin@casino.com' },
      select: { balance: true },
    });
    return house?.balance ?? 0n;
  }

  async rechargeHouse(amount: bigint): Promise<void> {
    assertPositiveAmount(amount);
    await this.runInTransaction(async tx => {
      const house = await tx.user.findFirst({
        where: { role: 'ADMIN', email: 'admin@casino.com' },
      });
      if (!house) throw new AppError('House account not found', 500);

      await new EconomyService(tx).addBalance(house.id, amount, 'house_recharge', undefined, 'House balance recharge');
    });
  }
}
