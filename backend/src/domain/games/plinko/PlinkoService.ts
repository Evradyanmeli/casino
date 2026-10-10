import { randomInt } from 'node:crypto';

export const MULTIPLIERS: Record<string, Record<number, number[]>> = {
  low: {
    8: [10, 3, 1.4, 0.6, 0.4, 0.6, 1.4, 3, 10],
    12: [20, 5, 2, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 2, 5, 20],
    16: [50, 10, 3, 1.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.5, 1.5, 3, 10, 50],
  },
  medium: {
    8: [18, 5, 1.8, 0.6, 0.3, 0.6, 1.8, 5, 18],
    12: [35, 8, 2.5, 1, 0.4, 0.2, 0.2, 0.2, 0.4, 1, 2.5, 8, 35],
    16: [88, 15, 4, 2, 0.5, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.5, 2, 4, 15, 88],
  },
  high: {
    8: [30, 8, 2.5, 0.6, 0.2, 0.6, 2.5, 8, 30],
    12: [60, 12, 3.5, 1, 0.3, 0.1, 0.1, 0.1, 0.3, 1, 3.5, 12, 60],
    16: [150, 25, 6, 2.5, 0.5, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 2.5, 6, 25, 150],
  },
};

export class PlinkoService {
  async drop(userId: string, bet: number, risk: 'low' | 'medium' | 'high', rows: number): Promise<{
    slot: number;
    multiplier: number;
    payout: number;
    path: number[];
    multipliers: number[];
  }> {
    const validRows = [8, 12, 16];
    if (!validRows.includes(rows)) throw new Error('Rows must be 8, 12, or 16');
    if (!['low', 'medium', 'high'].includes(risk)) throw new Error('Risk must be low, medium, or high');

    const path: number[] = [];
    let slot = 0;
    for (let i = 0; i < rows; i++) {
      const dir = randomInt(2);
      path.push(dir);
      slot += dir;
    }

    const table = MULTIPLIERS[risk][rows];
    const multiplier = table[slot];
    const payout = Math.floor(bet * multiplier);

    return { slot, multiplier, payout, path, multipliers: [...table] };
  }
}
