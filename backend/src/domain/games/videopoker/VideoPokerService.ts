import { PrismaClient } from '@prisma/client';
import { EconomyService } from '../../economy/EconomyService.js';
import { AppError } from '../../auth/AuthService.js';
import type { Card } from '../blackjack/BlackjackService.js';
import { GameLock, openWager, settleWager } from '../GameSupport.js';
import { runFinancialOperation } from '../../economy/FinancialOperation.js';
import { randomInt } from 'node:crypto';

interface VPSession {
  deck: Card[];
  hand: Card[];
  held: boolean[];
  bet: number;
  payout: number;
  handName: string;
  phase: 'deal' | 'draw' | 'complete';
  userId: string;
  sessionId: string;
  wagerId: string;
}

export interface VPState {
  sessionId: string;
  hand: Card[];
  held: boolean[];
  bet: number;
  payout: number;
  handName: string;
  phase: string;
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const RANK_ORDER: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function isRoyalFlush(ranks: string[], suits: string[]): boolean {
  const royal = ['10', 'J', 'Q', 'K', 'A'];
  return suits.every(s => s === suits[0]) && royal.every(r => ranks.includes(r));
}

function isStraightFlush(ranks: string[], suits: string[]): boolean {
  return suits.every(s => s === suits[0]) && isStraight(ranks);
}

function isFourOfAKind(rankCounts: Map<string, number>): boolean {
  return [...rankCounts.values()].some(c => c === 4);
}

function isFullHouse(rankCounts: Map<string, number>): boolean {
  const values = [...rankCounts.values()];
  return values.includes(3) && values.includes(2);
}

function isFlush(suits: string[]): boolean {
  return suits.every(s => s === suits[0]);
}

function isStraight(ranks: string[]): boolean {
  const nums = ranks.map(r => RANK_ORDER[r]).sort((a, b) => a - b);
  if (nums[4] - nums[0] === 4 && new Set(nums).size === 5) return true;
  if (nums[0] === 2 && nums[1] === 3 && nums[2] === 4 && nums[3] === 5 && nums[4] === 14) return true;
  return false;
}

function isThreeOfAKind(rankCounts: Map<string, number>): boolean {
  return [...rankCounts.values()].includes(3);
}

function isTwoPair(rankCounts: Map<string, number>): boolean {
  return [...rankCounts.values()].filter(c => c === 2).length === 2;
}

function isJacksOrBetter(ranks: string[], rankCounts: Map<string, number>): boolean {
  const pairs = [...rankCounts.entries()].filter(([, c]) => c === 2).map(([r]) => r);
  return pairs.some(r => RANK_ORDER[r] >= 11);
}

function evaluateHand(hand: Card[]): { handName: string; multiplier: number } {
  const ranks = hand.map(c => c.rank);
  const suits = hand.map(c => c.suit);
  const rankCounts = new Map<string, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
  }

  if (isRoyalFlush(ranks, suits)) return { handName: 'Quinte Flush Royale', multiplier: 250 };
  if (isStraightFlush(ranks, suits)) return { handName: 'Quinte Flush', multiplier: 50 };
  if (isFourOfAKind(rankCounts)) return { handName: 'Carré', multiplier: 25 };
  if (isFullHouse(rankCounts)) return { handName: 'Full', multiplier: 9 };
  if (isFlush(suits)) return { handName: 'Couleur', multiplier: 6 };
  if (isStraight(ranks)) return { handName: 'Quinte', multiplier: 4 };
  if (isThreeOfAKind(rankCounts)) return { handName: 'Brelan', multiplier: 3 };
  if (isTwoPair(rankCounts)) return { handName: 'Deux Paires', multiplier: 2 };
  if (isJacksOrBetter(ranks, rankCounts)) return { handName: 'Paire (Valet ou +)', multiplier: 1 };
  return { handName: 'Rien', multiplier: 0 };
}

export class VideoPokerService {
  private sessions = new Map<string, VPSession>();
  private sessionCounter = 0;
  private lock = new GameLock();

  constructor(
    private prisma: PrismaClient,
    private economyService: EconomyService,
  ) {}

  private nextSessionId(): string {
    this.sessionCounter++;
    return `vp-${this.sessionCounter}-${Date.now()}`;
  }

  async deal(userId: string, bet: number, key?: string): Promise<VPState> {
    return this.lock.run(userId, async () => {
    let staged: VPSession | undefined;
    const result = await runFinancialOperation(this.prisma, userId, 'videopoker_deal', key, { bet }, async tx => {
    if (!Number.isInteger(bet) || bet < 1 || bet > 5) throw new AppError('Mise invalide (1-5)', 400);
    if ([...this.sessions.values()].some(s => s.userId === userId && s.phase === 'deal')) throw new AppError('Une main est deja active; terminer avec draw', 409);
    const config = await this.prisma.gameConfig.findUnique({ where: { gameType: 'videopoker' } });
    if (config && (config.minBet > 5n || config.maxBet < 1n)) throw new AppError('Configuration Video Poker incompatible: fixer minBet/maxBet dans 1-5', 409);

    const deck = shuffle(createDeck());
    const hand: Card[] = [];
    for (let i = 0; i < 5; i++) {
      hand.push(deck.pop()!);
    }

    const session: VPSession = {
      deck,
      hand,
      held: [false, false, false, false, false],
      bet,
      payout: 0,
      handName: '',
      phase: 'deal',
      userId,
      sessionId: this.nextSessionId(),
      wagerId: '',
    };
    session.wagerId = await openWager(tx, userId, 'videopoker', bet, bet * (bet === 5 ? 800 : 250));
    staged = session;

    return {
      sessionId: session.sessionId,
      hand: session.hand,
      held: session.held,
      bet: session.bet,
      payout: 0,
      handName: '',
      phase: 'deal',
    };
    });
    if (staged) this.sessions.set(staged.sessionId, staged);
    return result;
    });
  }

  async draw(userId: string, sessionId: string, holds: boolean[]): Promise<VPState> {
    return this.lock.run(userId, async () => {
    const original = this.sessions.get(sessionId);
    if (!original) throw new AppError('Session introuvable', 404);
    if (original.userId !== userId) throw new AppError('Non autorisé', 403);
    if (holds.length !== 5 || holds.some(h => typeof h !== 'boolean')) throw new AppError('Tableau de maintien invalide', 400);
    const session = structuredClone(original);
    if (session.phase === 'complete') return this.toState(session);

    session.held = holds;

    for (let i = 0; i < 5; i++) {
      if (!holds[i]) {
        session.hand[i] = session.deck.pop()!;
      }
    }

    const result = evaluateHand(session.hand);
    const multiplier = result.handName === 'Quinte Flush Royale' && session.bet === 5 ? 800 : result.multiplier;
    session.payout = session.bet * multiplier;
    session.handName = result.handName;
    session.phase = 'complete';

    await this.economyService.runInTransaction(async tx => {
      await settleWager(tx, session.wagerId, userId, 'videopoker', session.payout, {
        hand: session.hand.map(c => `${c.rank}${c.suit}`), handName: session.handName, held: session.held,
      });
    });
    this.sessions.set(sessionId, session);
    setTimeout(() => this.sessions.delete(sessionId), 600000).unref();
    return this.toState(session);
    });
  }

  getState(userId: string): VPState | null {
    const s = [...this.sessions.values()].find(s => s.userId === userId && s.phase === 'deal');
    return s ? this.toState(s) : null;
  }

  async cancel(userId: string, sessionId: string): Promise<VPState> {
    return this.lock.run(userId, async () => {
      const original = this.sessions.get(sessionId);
      if (!original || original.userId !== userId) throw new AppError('Session introuvable', 404);
      if (original.phase === 'complete') return this.toState(original);
      const session = structuredClone(original);
      session.phase = 'complete';
      session.payout = 0;
      session.handName = 'Main abandonnee';
      await this.economyService.runInTransaction(tx => settleWager(tx, session.wagerId, userId, 'videopoker', 0, { cancelled: true }));
      this.sessions.set(sessionId, session);
      setTimeout(() => this.sessions.delete(sessionId), 600000).unref();
      return this.toState(session);
    });
  }

  private toState(session: VPSession): VPState {
    return {
      sessionId: session.sessionId,
      hand: structuredClone(session.hand),
      held: [...session.held],
      bet: session.bet,
      payout: session.payout,
      handName: session.handName,
      phase: session.phase,
    };
  }
}
