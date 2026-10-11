import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EconomyService } from '../economy/EconomyService.js';
import { AppError } from '../auth/AuthService.js';

// The debit itself holds the recoverable balance; no second monetary entry is created.
export async function openEscrow(tx: Prisma.TransactionClient, userId: string, amount: number, type: string, reference: string, description: string): Promise<string> {
  const id = randomUUID();
  await new EconomyService(tx).deductBalance(userId, BigInt(amount), type, reference, description,
    { escrowId: id, escrowStatus: 'active', escrowAmount: String(amount) });
  return id;
}

export async function saveEscrow(tx: Prisma.TransactionClient, id: string, amount: number, closed = false): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new AppError('Invalid escrow balance', 500);
  const updated = await tx.transaction.updateMany({ where: { AND: [
    { metadata: { path: ['escrowId'], equals: id } },
    { metadata: { path: ['escrowStatus'], equals: 'active' } },
  ] }, data: { metadata: { escrowId: id, escrowStatus: closed ? 'closed' : 'active', escrowAmount: String(amount) } } });
  if (updated.count !== 1) throw new AppError('Escrow already closed or missing', 409);
}

// Startup runs before accepting connections. Interrupted rounds are refunded, never guessed.
export async function recoverInterruptedFunds(db: PrismaClient): Promise<{ wagers: number; escrows: number }> {
  const result = { wagers: 0, escrows: 0 };
  const pending = await db.gameSession.findMany({ where: { resultData: { path: ['status'], equals: 'pending' } } });
  for (const interrupted of pending) {
    const recovered = await db.$transaction(async tx => {
      const bank = (interrupted.resultData as { bank?: { houseUserId: string; escrowId?: string; reserved: number } }).bank;
      // Match settlement's lock order and release the house reserve with the stake refund.
      if (bank) await tx.user.updateMany({ where: { id: bank.houseUserId }, data: { balance: { increment: 0n } } });
      const wager = await tx.gameSession.findUniqueOrThrow({ where: { id: interrupted.id } });
      const currentBank = (wager.resultData as { bank?: typeof bank }).bank;
      const changed = await tx.gameSession.updateMany({ where: { id: wager.id, resultData: { path: ['status'], equals: 'pending' } },
        data: { resultData: { status: 'refunded', reason: 'server_restart', ...(currentBank ? { bank: currentBank } : {}) }, endedAt: new Date(0) } });
      if (!changed.count) return { wagers: 0, escrows: 0 };
      if (currentBank?.escrowId) {
        await saveEscrow(tx, currentBank.escrowId, 0, true);
        if (currentBank.reserved > 0) await new EconomyService(tx).addBalance(currentBank.houseUserId,
          BigInt(currentBank.reserved), 'refund', currentBank.escrowId, 'Partie interrompue : reserve maison liberee');
      }
      await new EconomyService(tx).addBalance(wager.userId, wager.betAmount, 'refund', wager.id, 'Partie interrompue : mise remboursee');
      return { wagers: 1, escrows: currentBank?.escrowId ? 1 : 0 };
    });
    result.wagers += recovered.wagers;
    result.escrows += recovered.escrows;
  }
  const escrows = await db.transaction.findMany({ where: { metadata: { path: ['escrowStatus'], equals: 'active' } } });
  for (const interrupted of escrows) {
    const recovered = await db.$transaction(async tx => {
      await tx.user.updateMany({ where: { id: interrupted.userId }, data: { balance: { increment: 0n } } });
      const entry = await tx.transaction.findUniqueOrThrow({ where: { id: interrupted.id } });
      const metadata = entry.metadata as { escrowId: string; escrowAmount: string; escrowStatus: string };
      if (metadata.escrowStatus !== 'active') return false;
      const amount = Number(metadata.escrowAmount);
      await saveEscrow(tx, metadata.escrowId, amount, true);
      if (amount > 0) await new EconomyService(tx).addBalance(entry.userId, BigInt(amount), 'refund', metadata.escrowId, 'Table interrompue : jetons rembourses');
      return true;
    });
    if (recovered) result.escrows++;
  }
  return result;
}
