import { randomInt } from 'node:crypto';
import { AppError } from '../../auth/AuthService.js';

interface KenoState {
  sessionId: string;
  playerNumbers: number[];
  drawnNumbers: number[];
  matchCount: number;
  payout: number;
  bet: number;
  state: 'betting' | 'result';
}

const PAYOUTS: Record<number, Record<number, number>> = {
  1: { 1: 3 },
  2: { 2: 12, 1: 2 },
  3: { 3: 42, 2: 2 },
  4: { 4: 120, 3: 5, 2: 1 },
  5: { 5: 600, 4: 15, 3: 2 },
  6: { 6: 1500, 5: 50, 4: 5, 3: 1 },
  7: { 7: 5000, 6: 150, 5: 15, 4: 3, 3: 1 },
  8: { 8: 10000, 7: 500, 6: 50, 5: 10, 4: 2 },
  9: { 9: 25000, 8: 1500, 7: 150, 6: 30, 5: 5, 4: 1 },
  10: { 10: 50000, 9: 5000, 8: 500, 7: 50, 6: 10, 5: 2 },
};

function drawNumbers(count: number, max: number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = randomInt(pool.length);
    drawn.push(pool[idx]);
    pool[idx] = pool[pool.length - 1];
    pool.pop();
  }
  return drawn.sort((a, b) => a - b);
}

let sessionCounter = 0;

export class KenoService {
  async play(userId: string, bet: number, numbers: number[]): Promise<KenoState> {
    if (numbers.length < 1 || numbers.length > 10) throw new AppError('Pick 1-10 numbers', 400);
    if (new Set(numbers).size !== numbers.length) throw new AppError('Duplicate numbers', 400);
    if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > 80)) throw new AppError('Numbers must be 1-80', 400);

    sessionCounter++;
    const drawn = drawNumbers(20, 80);
    const playerSet = new Set(numbers);
    const matchCount = drawn.filter(n => playerSet.has(n)).length;
    const picks = numbers.length;
    const multiplier = PAYOUTS[picks]?.[matchCount] ?? 0;

    return {
      sessionId: `keno-${userId}-${sessionCounter}`,
      playerNumbers: numbers,
      drawnNumbers: drawn,
      matchCount,
      payout: Math.floor(bet * multiplier),
      bet,
      state: 'result',
    };
  }
}
