import { Prisma, PrismaClient } from '@prisma/client';
import { EconomyService } from '../economy/EconomyService.js';
import { AppError } from '../auth/AuthService.js';

// Process-local ordering; the conditional settlement below is the durable payment gate.
export class GameLock {
  private tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    this.tails.set(key, next);
    try { return await next; }
    finally { if (this.tails.get(key) === next) this.tails.delete(key); }
  }
}

export function validBet(bet: number): void {
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new AppError('Invalid bet', 400);
}

export async function houseEdge(db: PrismaClient | Prisma.TransactionClient, gameType: string, fallback: number): Promise<number> {
  const config = await db.gameConfig.findUnique({ where: { gameType } });
  const setting = config ? null : await db.systemSetting.findUnique({ where: { key: 'default_house_edge' } });
  const edge = config?.houseEdge ?? (typeof setting?.value === 'number' ? setting.value : fallback);
  if (!Number.isFinite(edge) || edge < 0 || edge >= 100) throw new AppError('Invalid house edge configuration', 409);
  return edge / 100;
}

export async function openWager(tx: Prisma.TransactionClient, userId: string, gameType: string, bet: number): Promise<string> {
  validBet(bet);
  const economy = new EconomyService(tx);
  await economy.assertCanPlay(userId, gameType, BigInt(bet));
  const record = await tx.gameSession.create({ data: {
    userId, gameType, betAmount: BigInt(bet), winAmount: 0n, endedAt: new Date(0), resultData: { status: 'pending' },
  } });
  await economy.deductBalance(userId, BigInt(bet), 'game_bet', gameType, `Wager ${record.id}`);
  return record.id;
}

export async function increaseWager(tx: Prisma.TransactionClient, id: string, userId: string, gameType: string, amount: number): Promise<void> {
  validBet(amount);
  const economy = new EconomyService(tx);
  await economy.assertCanPlay(userId, gameType);
  const config = await tx.gameConfig.findUnique({ where: { gameType } });
  const wager = await tx.gameSession.findUnique({ where: { id } });
  if (!wager) throw new AppError('Wager not found', 404);
  if (config && wager.betAmount + BigInt(amount) > config.maxBet) throw new AppError('Total wager exceeds configured maximum', 400);
  await economy.deductBalance(userId, BigInt(amount), 'game_bet', gameType, `Additional wager ${id}`);
  await tx.gameSession.update({ where: { id }, data: { betAmount: { increment: BigInt(amount) } } });
}

export async function settleWager(tx: Prisma.TransactionClient, id: string, userId: string, gameType: string, payout: number, result: Prisma.InputJsonValue): Promise<void> {
  if (!Number.isSafeInteger(payout) || payout < 0) throw new AppError('Invalid payout', 500);
  const settled = await tx.gameSession.updateMany({
    where: { id, userId, gameType, resultData: { path: ['status'], equals: 'pending' } },
    data: { winAmount: BigInt(payout), endedAt: new Date(), resultData: { status: 'settled', result } },
  });
  if (settled.count !== 1) throw new AppError('Wager already settled', 409);
  if (payout > 0) await new EconomyService(tx).addBalance(userId, BigInt(payout), 'game_win', gameType, `Settlement ${id}`);
}

export async function instantWager<T extends object>(db: PrismaClient, userId: string, gameType: string, bet: number, play: () => Promise<T>, payout: (result: T) => number): Promise<T> {
  return new EconomyService(db).runInTransaction(async tx => {
    const id = await openWager(tx, userId, gameType, bet);
    const result = await play();
    await settleWager(tx, id, userId, gameType, payout(result), result as Prisma.InputJsonValue);
    return result;
  });
}
