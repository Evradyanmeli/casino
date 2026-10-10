import { PrismaClient } from '@prisma/client';
import { AppError } from '../../auth/AuthService.js';
import { instantWager, validBet } from '../GameSupport.js';
import { randomInt } from 'node:crypto';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

interface RouletteBet {
  type: 'straight' | 'split' | 'street' | 'corner' | 'sixline' | 'column' | 'dozen' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high';
  positions: number[];
  amount: number;
}

interface BetResult {
  type: string;
  positions: number[];
  amount: number;
  payout: number;
  won: boolean;
}

interface RouletteResult {
  number: number;
  color: 'red' | 'black' | 'green';
  bets: BetResult[];
  totalWin: number;
}

const PAYOUTS: Record<string, number> = {
  straight: 36,
  split: 18,
  street: 12,
  corner: 9,
  sixline: 6,
  column: 3,
  dozen: 3,
  red: 2,
  black: 2,
  odd: 2,
  even: 2,
  low: 2,
  high: 2,
};

const VALID_BET_TYPES = new Set(Object.keys(PAYOUTS));

function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

export function validateBet(bet: RouletteBet): void {
  if (!VALID_BET_TYPES.has(bet.type)) {
    throw new AppError(`Invalid bet type: ${bet.type}`, 400);
  }

  validBet(bet.amount);
  if (!Array.isArray(bet.positions)) throw new AppError('Invalid positions', 400);

  const validPositions = bet.positions.every((p: number) => Number.isInteger(p) && p >= 0 && p <= 36);

  if (!validPositions || new Set(bet.positions).size !== bet.positions.length) {
    throw new AppError(`Invalid positions in bet: ${bet.positions.join(',')}`, 400);
  }

  const p = [...bet.positions].sort((a, b) => a - b);
  const street = (a: number[]) => a.length === 3 && a[0] > 0 && a[0] % 3 === 1 && a[1] === a[0] + 1 && a[2] === a[0] + 2;
  switch (bet.type) {
    case 'straight':
      if (bet.positions.length !== 1) throw new AppError('Straight bet requires exactly 1 position', 400);
      break;
    case 'split':
      if (p.length !== 2 || !(p[0] === 0 ? p[1] >= 1 && p[1] <= 3 :
        p[1] - p[0] === 3 || (p[1] - p[0] === 1 && Math.floor((p[0] - 1) / 3) === Math.floor((p[1] - 1) / 3)))) throw new AppError('Invalid split geometry', 400);
      break;
    case 'street':
      if (!street(p) && p.join(',') !== '0,1,2' && p.join(',') !== '0,2,3') throw new AppError('Invalid street geometry', 400);
      break;
    case 'corner':
      if (p.join(',') !== '0,1,2,3' && !(p.length === 4 && p[0] > 0 && p[0] % 3 !== 0 && p[1] === p[0] + 1 && p[2] === p[0] + 3 && p[3] === p[0] + 4)) throw new AppError('Invalid corner geometry', 400);
      break;
    case 'sixline':
      if (p.length !== 6 || !street(p.slice(0, 3)) || !street(p.slice(3)) || p[3] !== p[0] + 3) throw new AppError('Invalid sixline geometry', 400);
      break;
    case 'column':
    case 'dozen':
      if (p.length !== 1 || p[0] > 2) throw new AppError('Column/dozen requires one index (0-2)', 400);
      break;
    case 'red':
    case 'black':
    case 'odd':
    case 'even':
    case 'low':
    case 'high':
      if (p.length !== 0) throw new AppError('Outside bets require empty positions', 400);
      break;
  }
}

export function checkBetWon(bet: RouletteBet, result: number): boolean {
  const color = getColor(result);

  switch (bet.type) {
    case 'straight':
    case 'split':
    case 'street':
    case 'corner':
    case 'sixline':
      return bet.positions.includes(result);
    case 'column': {
      if (result === 0) return false;
      const col = (result - 1) % 3;
      return bet.positions.includes(col);
    }
    case 'dozen': {
      if (result === 0) return false;
      const dozen = Math.ceil(result / 12) - 1;
      return bet.positions.includes(dozen);
    }
    case 'red':
      return color === 'red';
    case 'black':
      return color === 'black';
    case 'odd':
      return result !== 0 && result % 2 === 1;
    case 'even':
      return result !== 0 && result % 2 === 0;
    case 'low':
      return result >= 1 && result <= 18;
    case 'high':
      return result >= 19 && result <= 36;
    default:
      return false;
  }
}

export class RouletteService {
  constructor(private prisma: PrismaClient) {}

  async spin(userId: string, bets: RouletteBet[]): Promise<RouletteResult> {
    if (!Array.isArray(bets) || bets.length === 0) {
      throw new AppError('At least one bet is required', 400);
    }

    for (const bet of bets) {
      validateBet(bet);
    }

    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
    return instantWager(this.prisma, userId, 'roulette', totalBet, async () => {
    const resultNumber = randomInt(37);
    const color = getColor(resultNumber);

    const betResults: BetResult[] = [];
    let totalWin = 0;

    for (const bet of bets) {
      const won = checkBetWon(bet, resultNumber);
      const multiplier = PAYOUTS[bet.type] || 0;
      const payout = won ? bet.amount * multiplier : 0;
      
      betResults.push({
        type: bet.type,
        positions: bet.positions,
        amount: bet.amount,
        payout,
        won,
      });

      totalWin += payout;
    }

    return {
      number: resultNumber,
      color,
      bets: betResults,
      totalWin,
    };
    }, result => result.totalWin);
  }
}

export { RouletteBet, RouletteResult, BetResult, RED_NUMBERS, PAYOUTS, getColor };
