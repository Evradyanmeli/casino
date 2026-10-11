import { Prisma, PrismaClient } from '@prisma/client';
import { EconomyService } from '../economy/EconomyService.js';
import { AppError } from '../auth/AuthService.js';
import { openEscrow, saveEscrow } from './Escrow.js';
import { ResponsibleGamingService } from '../rg/ResponsibleGamingService.js';

interface WagerBank { houseUserId: string; escrowId?: string; reserved: number; maximumPayout: number; }

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

export async function openWager(tx: Prisma.TransactionClient, userId: string, gameType: string, bet: number, maximumPayout: number): Promise<string> {
  validBet(bet);
  if (!Number.isSafeInteger(maximumPayout) || maximumPayout < 0) throw new AppError('Maximum payout exceeds safe limits', 400);
  const economy = new EconomyService(tx);
  const house = await tx.user.findFirst({ where: { email: 'admin@casino.com', role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  if (!house || house.id === userId) throw new AppError('Caisse distincte du joueur requise', 503);
  await tx.user.updateMany({ where: { id: house.id }, data: { balance: { increment: 0n } } });
  const reserved = Math.max(0, maximumPayout - bet);
  if (await economy.getBalance(house.id) < BigInt(reserved)) throw new AppError(`Caisse insuffisante pour couvrir le gain maximal de ${maximumPayout} GC`, 409);
  await economy.assertCanPlay(userId, gameType, BigInt(bet));
  const record = await tx.gameSession.create({ data: {
    userId, gameType, betAmount: BigInt(bet), winAmount: 0n, endedAt: new Date(0), resultData: { status: 'pending' },
  } });
  await economy.deductBalance(userId, BigInt(bet), 'game_bet', gameType, `Wager ${record.id}`);
  const escrowId = reserved > 0 ? await openEscrow(tx, house.id, reserved, 'game_house_reserve', record.id, `Engagement maximal ${gameType}`) : undefined;
  const bank: WagerBank = { houseUserId: house.id, reserved, maximumPayout, ...(escrowId ? { escrowId } : {}) };
  await tx.gameSession.update({ where: { id: record.id }, data: { resultData: { status: 'pending', bank: bank as unknown as Prisma.InputJsonObject } } });
  return record.id;
}

export async function increaseWager(tx: Prisma.TransactionClient, id: string, userId: string, gameType: string, amount: number): Promise<void> {
  validBet(amount);
  const economy = new EconomyService(tx);
  let wager = await tx.gameSession.findUnique({ where: { id } });
  if (!wager || wager.userId !== userId || wager.gameType !== gameType) throw new AppError('Wager not found', 404);
  let data = wager.resultData as unknown as { status: string; bank: WagerBank };
  if (data.status !== 'pending' || !data.bank) throw new AppError('Wager cannot be increased', 409);
  await tx.user.updateMany({ where: { id: data.bank.houseUserId }, data: { balance: { increment: 0n } } });
  wager = await tx.gameSession.findUniqueOrThrow({ where: { id } });
  data = wager.resultData as unknown as { status: string; bank: WagerBank };
  if (data.status !== 'pending' || !data.bank) throw new AppError('Wager cannot be increased', 409);
  await economy.assertCanPlay(userId, gameType);
  const allowed = await new ResponsibleGamingService(tx).canPlaceBet(userId, amount);
  if (!allowed.allowed) throw new AppError(allowed.reason ?? 'Loss limit reached', 403);
  const config = await tx.gameConfig.findUnique({ where: { gameType } });
  if (config && wager.betAmount + BigInt(amount) > config.maxBet) throw new AppError('Total wager exceeds configured maximum', 400);
  const total = Number(wager.betAmount) + amount;
  if (!Number.isSafeInteger(total)) throw new AppError('Total wager exceeds safe limits', 400);
  const maximumPayout = Math.ceil(data.bank.maximumPayout / Number(wager.betAmount) * total);
  if (!Number.isSafeInteger(maximumPayout)) throw new AppError('Maximum payout exceeds safe limits', 400);
  const reserved = Math.max(0, maximumPayout - total);
  const extra = reserved - data.bank.reserved;
  if (extra > 0) {
    if (await economy.getBalance(data.bank.houseUserId) < BigInt(extra)) throw new AppError('Caisse insuffisante pour la mise supplementaire', 409);
    if (data.bank.escrowId) {
      await economy.deductBalance(data.bank.houseUserId, BigInt(extra), 'game_house_reserve', id, 'Engagement supplementaire');
      await saveEscrow(tx, data.bank.escrowId, reserved);
    } else data.bank.escrowId = await openEscrow(tx, data.bank.houseUserId, extra, 'game_house_reserve', id, 'Engagement supplementaire');
  }
  await economy.deductBalance(userId, BigInt(amount), 'game_bet', gameType, `Additional wager ${id}`);
  await tx.gameSession.update({ where: { id }, data: { betAmount: { increment: BigInt(amount) },
    resultData: { status: 'pending', bank: { ...data.bank, reserved, maximumPayout } as unknown as Prisma.InputJsonObject } } });
}

export async function settleWager(tx: Prisma.TransactionClient, id: string, userId: string, gameType: string, payout: number, result: Prisma.InputJsonValue): Promise<void> {
  if (!Number.isSafeInteger(payout) || payout < 0) throw new AppError('Invalid payout', 500);
  let wager = await tx.gameSession.findUnique({ where: { id } });
  if (!wager || wager.userId !== userId || wager.gameType !== gameType) throw new AppError('Wager not found', 404);
  let data = wager.resultData as unknown as { status: string; bank?: WagerBank };
  if (data.status !== 'pending') throw new AppError('Wager already settled', 409);
  if (!data.bank) throw new AppError('Legacy wager requires interruption recovery', 409);
  await tx.user.updateMany({ where: { id: data.bank.houseUserId }, data: { balance: { increment: 0n } } });
  wager = await tx.gameSession.findUniqueOrThrow({ where: { id } });
  data = wager.resultData as unknown as { status: string; bank?: WagerBank };
  if (data.status !== 'pending') throw new AppError('Wager already settled', 409);
  if (!data.bank) throw new AppError('Legacy wager requires interruption recovery', 409);
  const bank = data.bank;
  if (payout > bank.maximumPayout) throw new AppError('Payout exceeds reserved liability', 500);
  const settled = await tx.gameSession.updateMany({
    where: { id, userId, gameType, resultData: { path: ['status'], equals: 'pending' } },
    data: { winAmount: BigInt(payout), endedAt: new Date(), resultData: { status: 'settled', result, bank: bank as unknown as Prisma.InputJsonObject } },
  });
  if (settled.count !== 1) throw new AppError('Wager already settled', 409);
  if (bank.escrowId) await saveEscrow(tx, bank.escrowId, 0, true);
  if (payout > 0) await new EconomyService(tx).addBalance(userId, BigInt(payout), 'game_win', gameType, `Settlement ${id}`);
  const returned = Number(wager.betAmount) + bank.reserved - payout;
  if (returned > 0) await new EconomyService(tx).addBalance(bank.houseUserId, BigInt(returned), 'game_house_settlement', id, `Reglement maison ${gameType}`);
}

export async function instantWager<T extends object>(db: PrismaClient | Prisma.TransactionClient, userId: string, gameType: string, bet: number, play: () => Promise<T>, payout: (result: T) => number, maximumPayout: number): Promise<T> {
  return new EconomyService(db).runInTransaction(async tx => {
    const id = await openWager(tx, userId, gameType, bet, maximumPayout);
    const result = await play();
    await settleWager(tx, id, userId, gameType, payout(result), result as Prisma.InputJsonValue);
    return result;
  });
}
