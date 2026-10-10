import { PrismaClient } from '@prisma/client';
import { AppError } from '../../auth/AuthService.js';
import { EconomyService } from '../../economy/EconomyService.js';
import { instantWager, validBet } from '../GameSupport.js';
import { randomInt } from 'node:crypto';

interface SlotSymbol {
  id: string;
  name: string;
  payout: number;
}

interface SlotReel {
  symbols: string[];
}

interface SlotConfig {
  name: string;
  reels: number;
  rows: number;
  paylines: number;
  symbols: SlotSymbol[];
  reelStrip: string[][];
  betMin: number;
  betMax: number;
  freeSpinConfig?: {
    scatterSymbol: string;
    scatterCount: number;
    freeSpins: number;
  };
}

interface PaylineResult {
  line: number;
  positions: number[];
  symbol: string;
  payout: number;
}

interface SpinResult {
  reels: string[][];
  paylines: PaylineResult[];
  totalWin: number;
  isFreeSpin?: boolean;
  freeSpinsRemaining?: number;
}

const CLASSIC_SYMBOLS: SlotSymbol[] = [
  { id: 'CHERRY', name: '🍒', payout: 2 },
  { id: 'LEMON', name: '🍋', payout: 3 },
  { id: 'STAR', name: '⭐', payout: 5 },
  { id: 'SEVEN', name: '7️⃣', payout: 10 },
  { id: 'BELL', name: '🔔', payout: 15 },
  { id: 'DIAMOND', name: '💎', payout: 25 },
  { id: 'BAR', name: 'BAR', payout: 50 },
];

const FRUIT_SYMBOLS: SlotSymbol[] = [
  { id: 'CHERRY', name: '🍒', payout: 2 },
  { id: 'LEMON', name: '🍋', payout: 3 },
  { id: 'ORANGE', name: '🍊', payout: 4 },
  { id: 'GRAPE', name: '🍇', payout: 5 },
  { id: 'WATERMELON', name: '🍉', payout: 8 },
  { id: 'STRAWBERRY', name: '🍓', payout: 12 },
  { id: 'APPLE', name: '🍎', payout: 15 },
  { id: 'BANANA', name: '🍌', payout: 20 },
];

const DIAMOND_SYMBOLS: SlotSymbol[] = [
  { id: 'DIAMOND', name: '💎', payout: 5 },
  { id: 'CROWN', name: '👑', payout: 8 },
  { id: 'STAR', name: '⭐', payout: 10 },
  { id: 'BELL', name: '🔔', payout: 12 },
  { id: 'SEVEN', name: '7️⃣', payout: 20 },
  { id: 'TROPHY', name: '🏆', payout: 25 },
  { id: 'MONEY', name: '💰', payout: 30 },
  { id: 'FIRE', name: '🔥', payout: 40 },
  { id: 'TARGET', name: '🎯', payout: 50 },
  { id: 'SLOT', name: '🎰', payout: 100 },
  { id: 'SCATTER', name: '✨', payout: 0 },
];

function buildReelStrip(symbolIds: string[], length: number): string[] {
  const strip: string[] = [];
  for (let i = 0; i < length; i++) {
    strip.push(symbolIds[i % symbolIds.length]);
  }
  return strip;
}

const CLASSIC_REEL_STRIP = buildReelStrip(
  ['CHERRY', 'LEMON', 'CHERRY', 'STAR', 'CHERRY', 'LEMON', 'BELL', 'CHERRY', 'SEVEN', 'LEMON', 'CHERRY', 'DIAMOND', 'LEMON', 'CHERRY', 'BAR', 'CHERRY', 'LEMON', 'STAR'],
  30
);

const FRUIT_REEL_STRIP = buildReelStrip(
  ['CHERRY', 'LEMON', 'ORANGE', 'CHERRY', 'GRAPE', 'LEMON', 'WATERMELON', 'CHERRY', 'STRAWBERRY', 'LEMON', 'ORANGE', 'APPLE', 'CHERRY', 'GRAPE', 'BANANA', 'LEMON', 'WATERMELON', 'CHERRY', 'STRAWBERRY', 'ORANGE'],
  40
);

const DIAMOND_REEL_STRIP = buildReelStrip(
  ['DIAMOND', 'CROWN', 'STAR', 'BELL', 'DIAMOND', 'SEVEN', 'CROWN', 'TROPHY', 'DIAMOND', 'MONEY', 'STAR', 'FIRE', 'BELL', 'TARGET', 'DIAMOND', 'SLOT', 'SCATTER', 'CROWN', 'STAR', 'BELL', 'DIAMOND', 'SEVEN', 'MONEY', 'CROWN', 'TROPHY', 'SCATTER', 'DIAMOND', 'FIRE', 'STAR', 'TARGET'],
  50
);

const CLASSIC_PAYLINES = [
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
];

const FRUIT_PAYLINES = [
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]],
  [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]],
];

const DIAMOND_PAYLINES = [
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]],
  [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]],
  [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2]],
  [[0, 2], [1, 2], [2, 1], [3, 0], [4, 0]],
  [[0, 0], [1, 1], [2, 1], [3, 2], [4, 1]],
  [[0, 2], [1, 1], [2, 1], [3, 0], [4, 1]],
  [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]],
];

const CONFIGS: Record<string, SlotConfig> = {
  classic: {
    name: 'Classic',
    reels: 3,
    rows: 3,
    paylines: 3,
    symbols: CLASSIC_SYMBOLS,
    reelStrip: [CLASSIC_REEL_STRIP, CLASSIC_REEL_STRIP, CLASSIC_REEL_STRIP],
    betMin: 1,
    betMax: 100,
  },
  fruit: {
    name: 'Fruit',
    reels: 5,
    rows: 3,
    paylines: 5,
    symbols: FRUIT_SYMBOLS,
    reelStrip: [FRUIT_REEL_STRIP, FRUIT_REEL_STRIP, FRUIT_REEL_STRIP, FRUIT_REEL_STRIP, FRUIT_REEL_STRIP],
    betMin: 1,
    betMax: 100,
  },
  diamond: {
    name: 'Diamond',
    reels: 5,
    rows: 3,
    paylines: 10,
    symbols: DIAMOND_SYMBOLS,
    reelStrip: [DIAMOND_REEL_STRIP, DIAMOND_REEL_STRIP, DIAMOND_REEL_STRIP, DIAMOND_REEL_STRIP, DIAMOND_REEL_STRIP],
    betMin: 1,
    betMax: 500,
    freeSpinConfig: {
      scatterSymbol: 'SCATTER',
      scatterCount: 3,
      freeSpins: 10,
    },
  },
};

function getPaylines(variant: string): number[][][] {
  switch (variant) {
    case 'classic': return CLASSIC_PAYLINES;
    case 'fruit': return FRUIT_PAYLINES;
    case 'diamond': return DIAMOND_PAYLINES;
    default: return CLASSIC_PAYLINES;
  }
}

function randomIndex(strip: string[]): number {
  return randomInt(strip.length);
}

function getReelWindow(strip: string[], startIndex: number, rows: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < rows; i++) {
    result.push(strip[(startIndex + i) % strip.length]);
  }
  return result;
}

export class SlotsService {
  constructor(private prisma: PrismaClient) {}

  async spin(userId: string, variant: string, betPerLine: number): Promise<SpinResult> {
    const config = CONFIGS[variant];
    if (!config) throw new AppError('Invalid slot variant', 400);
    validBet(betPerLine);

    if (betPerLine < config.betMin || betPerLine > config.betMax) {
      throw new AppError(`Bet must be between ${config.betMin} and ${config.betMax}`, 400);
    }

    const totalBet = betPerLine * config.paylines;
    return instantWager(this.prisma, userId, `slots_${variant}`, totalBet, async () => {
    const result = this.doSpin(config, variant, betPerLine);
    
    if (variant === 'diamond' && result.isFreeSpin) {
      result.freeSpinsRemaining = config.freeSpinConfig!.freeSpins;
    }

    return result;
    }, result => result.totalWin);
  }

  async freeSpin(userId: string, variant: string): Promise<SpinResult> {
    throw new AppError('Free spin entitlement is not implemented', 409);
  }

  private doSpin(config: SlotConfig, variant: string, betPerLine: number): SpinResult {
    const reels: string[][] = [];
    for (let r = 0; r < config.reels; r++) {
      const strip = config.reelStrip[r];
      const startIndex = randomIndex(strip);
      const window = getReelWindow(strip, startIndex, config.rows);
      reels.push(window);
    }

    const paylines = getPaylines(variant);
    const symbolMap = new Map(config.symbols.map(s => [s.id, s]));
    const results: PaylineResult[] = [];
    let totalWin = 0;
    let isFreeSpin = false;

    for (let li = 0; li < paylines.length; li++) {
      const line = paylines[li];
      const positions: number[] = [];
      const symbolsOnLine: string[] = [];

      for (const [col, row] of line) {
        if (col < reels.length && row < reels[col].length) {
          symbolsOnLine.push(reels[col][row]);
          positions.push(col * config.rows + row);
        }
      }

      if (symbolsOnLine.length >= 3) {
        const firstSymbol = symbolsOnLine[0];
        let consecutive = 1;

        for (let i = 1; i < symbolsOnLine.length; i++) {
          if (symbolsOnLine[i] === firstSymbol) {
            consecutive++;
          } else {
            break;
          }
        }

        if (consecutive >= 3) {
          const symbolDef = symbolMap.get(firstSymbol);
          if (symbolDef && symbolDef.payout > 0) {
            const linePayout = symbolDef.payout * consecutive * betPerLine;
            results.push({
              line: li + 1,
              positions: positions.slice(0, consecutive),
              symbol: firstSymbol,
              payout: linePayout,
            });
            totalWin += linePayout;
          }
        }
      }
    }

    if (variant === 'diamond') {
      const scatterSymbol = config.freeSpinConfig!.scatterSymbol;
      let scatterCount = 0;
      for (const reel of reels) {
        for (const sym of reel) {
          if (sym === scatterSymbol) scatterCount++;
        }
      }
      if (scatterCount >= config.freeSpinConfig!.scatterCount) {
        isFreeSpin = true;
      }
    }

    return {
      reels,
      paylines: results,
      totalWin,
      isFreeSpin,
    };
  }

  getConfig(variant: string) {
    const config = CONFIGS[variant];
    if (!config) return null;
    return {
      name: config.name,
      reels: config.reels,
      rows: config.rows,
      paylines: config.paylines,
      symbols: config.symbols,
      betMin: config.betMin,
      betMax: config.betMax,
    };
  }
}

export { CONFIGS, SlotConfig, SlotSymbol, SpinResult, PaylineResult };
