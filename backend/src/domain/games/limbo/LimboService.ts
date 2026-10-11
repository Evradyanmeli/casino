import { PrismaClient } from '@prisma/client';
import { AppError } from '../../auth/AuthService.js';
import { EconomyService } from '../../economy/EconomyService.js';
import { houseEdge, openWager, settleWager } from '../GameSupport.js';
import { randomInt, randomUUID } from 'node:crypto';

export interface LimboState {
  sessionId: string;
  targetMultiplier: number;
  resultMultiplier: number;
  won: boolean;
  bet: number;
  payout: number;
  state: 'betting' | 'result';
}

export class LimboService {
  constructor(private prisma: PrismaClient | import('@prisma/client').Prisma.TransactionClient) {}

  async play(userId: string, bet: number, targetMultiplier: number): Promise<LimboState> {
    if (!Number.isFinite(targetMultiplier) || targetMultiplier < 1.00 || targetMultiplier > 1000000) {
      throw new AppError('Target multiplier must be between 1.00 and 1,000,000', 400);
    }

    const economy = new EconomyService(this.prisma);
    return economy.runInTransaction(async tx => {
    const id = await openWager(tx, userId, 'limbo', bet, Math.floor(bet * targetMultiplier));
    const edge = await houseEdge(tx, 'limbo', 1);
    const resultMultiplier = (1 - edge) / ((randomInt(1, 2 ** 48 - 1) / (2 ** 48)));

    const won = resultMultiplier >= targetMultiplier;
    const payout = won ? Math.floor(bet * targetMultiplier) : 0;

    await settleWager(tx, id, userId, 'limbo', payout, { targetMultiplier, resultMultiplier, won });

    return {
      sessionId: randomUUID(),
      targetMultiplier,
      resultMultiplier: Math.floor(resultMultiplier * 100) / 100,
      won,
      bet,
      payout,
      state: 'result',
    };
    });
  }
}
