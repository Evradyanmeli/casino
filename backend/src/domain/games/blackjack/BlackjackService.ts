import { Prisma, PrismaClient } from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
import { EconomyService } from '../../economy/EconomyService.js';
import { AppError } from '../../auth/AuthService.js';
import { GameLock, openWager, increaseWager, settleWager } from '../GameSupport.js';
import { runFinancialOperation } from '../../economy/FinancialOperation.js';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
}
interface Hand {
  cards: Card[]; value: number; isBlackjack: boolean; isBusted: boolean;
  isStanding: boolean; isDoubled: boolean; isSplit: boolean; bet: number; payout: number;
}
interface Session {
  sessionId: string; userId: string; wagerId: string; shoe: Card[]; dealerCards: Card[];
  hands: Hand[]; state: 'playing' | 'complete'; insuranceBet: number;
  insurancePayout: number; insuranceAvailable: boolean;
}
export interface GameState {
  sessionId: string; hands: Hand[]; dealerCards: Card[]; dealerValue: number;
  dealerHidden: boolean; state: string; activeHandIndex: number;
  insuranceAvailable: boolean; insuranceBet: number; insurancePayout: number;
  bet: number; payout: number;
}
const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function cardValue(card: Card): number {
  return card.rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(card.rank) ? 10 : Number(card.rank);
}
export function handValue(cards: Card[]): number {
  let value = cards.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = cards.filter(c => c.rank === 'A').length;
  while (value > 21 && aces-- > 0) value -= 10;
  return value;
}
function createShoe(): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < 6; d++) for (const suit of SUITS) for (const rank of RANKS) shoe.push({ suit, rank });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}
function makeHand(cards: Card[], bet: number, isSplit = false): Hand {
  const value = handValue(cards);
  return { cards, bet, value, isSplit, isBlackjack: !isSplit && cards.length === 2 && value === 21,
    isBusted: value > 21, isStanding: value >= 21, isDoubled: false, payout: 0 };
}

export class BlackjackService {
  private sessions = new Map<string, Session>();
  private lock = new GameLock();
  constructor(private prisma: PrismaClient, private economyService: EconomyService) {}

  private toGameState(s: Session): GameState {
    const hidden = s.state !== 'complete';
    return structuredClone({ sessionId: s.sessionId, hands: s.hands,
      dealerCards: hidden ? s.dealerCards.slice(0, 1) : s.dealerCards,
      dealerValue: handValue(hidden ? s.dealerCards.slice(0, 1) : s.dealerCards),
      dealerHidden: hidden, state: s.state,
      activeHandIndex: s.hands.findIndex(h => !h.isStanding && !h.isBusted),
      insuranceAvailable: s.insuranceAvailable, insuranceBet: s.insuranceBet, insurancePayout: s.insurancePayout,
      bet: s.hands.reduce((v, h) => v + h.bet, s.insuranceBet),
      payout: s.hands.reduce((v, h) => v + h.payout, s.insurancePayout) });
  }

  getState(userId: string, sessionId?: string): GameState | null {
    const s = sessionId ? this.sessions.get(sessionId) : [...this.sessions.values()].find(s => s.userId === userId && s.state === 'playing');
    if (!s) return null;
    if (s.userId !== userId) throw new AppError('Non autorise', 403);
    return this.toGameState(s);
  }

  private publish(s: Session): void {
    this.sessions.set(s.sessionId, s);
    if (s.state === 'complete') setTimeout(() => this.sessions.delete(s.sessionId), 600000).unref();
  }

  async startRound(userId: string, bet: number, key?: string): Promise<GameState> {
    return this.lock.run(userId, async () => {
      let staged: Session | undefined;
      const result = await runFinancialOperation(this.prisma, userId, 'blackjack_start', key, { bet }, async tx => {
      if ([...this.sessions.values()].some(s => s.userId === userId && s.state === 'playing')) throw new AppError('Une main est deja active; reprendre cette session', 409);
      const s: Session = { userId, sessionId: randomUUID(), wagerId: '', shoe: createShoe(), dealerCards: [], hands: [],
        state: 'playing', insuranceBet: 0, insurancePayout: 0, insuranceAvailable: false };
      s.dealerCards = [s.shoe.pop()!, s.shoe.pop()!];
      s.hands = [makeHand([s.shoe.pop()!, s.shoe.pop()!], bet)];
      s.insuranceAvailable = s.dealerCards[0].rank === 'A' && bet >= 2;
      s.wagerId = await openWager(tx, userId, 'blackjack', bet, bet * 3);
      if (!s.insuranceAvailable && (s.hands[0].isBlackjack || handValue(s.dealerCards) === 21)) await this.resolve(s, tx);
      staged = s;
      return this.toGameState(s);
      });
      if (staged) this.publish(staged);
      return result;
    });
  }

  private async action(userId: string, id: string, action: 'hit' | 'stand' | 'double' | 'split' | 'insurance', index = 0, amount = 0, key?: string): Promise<GameState> {
    return this.lock.run(userId, async () => {
      let staged: Session | undefined;
      const result = await runFinancialOperation(this.prisma, userId, `blackjack_${action}`, key, { id, index, amount }, async tx => {
        const existing = this.sessions.get(id);
        if (!existing) throw new AppError('Session introuvable', 404);
        if (existing.userId !== userId) throw new AppError('Non autorise', 403);
        if (existing.state === 'complete') return this.toGameState(existing);
        const s = staged = structuredClone(existing);
        if (action === 'insurance') {
          if (!s.insuranceAvailable || !Number.isSafeInteger(amount) || amount <= 0 || amount > Math.floor(s.hands[0].bet / 2)) throw new AppError('Assurance non disponible ou montant invalide', 400);
          await increaseWager(tx, s.wagerId, userId, 'blackjack', amount);
          s.insuranceBet = amount;
          s.insuranceAvailable = false;
          if (handValue(s.dealerCards) === 21 || s.hands[0].isBlackjack) await this.resolve(s, tx);
          return this.toGameState(s);
        }
        s.insuranceAvailable = false;
        // Peek before taking any extra wager. Insurance closes on the first normal action.
        if (handValue(s.dealerCards) === 21 || s.hands[0].isBlackjack) { await this.resolve(s, tx); return this.toGameState(s); }
        if (!Number.isInteger(index) || index < 0 || index >= s.hands.length) throw new AppError('Main invalide', 400);
        const hand = s.hands[index];
        if (hand.isStanding || hand.isBusted) throw new AppError('Main deja terminee', 400);
        if (action === 'split') {
          if (hand.cards.length !== 2 || cardValue(hand.cards[0]) !== cardValue(hand.cards[1]) || s.hands.length >= 4) throw new AppError('Split non autorise', 400);
          await increaseWager(tx, s.wagerId, userId, 'blackjack', hand.bet);
          const aces = hand.cards[0].rank === 'A';
          const hands = hand.cards.map(c => makeHand([c, s.shoe.pop()!], hand.bet, true));
          if (aces) hands.forEach(h => { h.isStanding = true; });
          s.hands.splice(index, 1, ...hands);
        } else if (action === 'stand') hand.isStanding = true;
        else {
          if (action === 'double') {
            if (hand.cards.length !== 2) throw new AppError('Double seulement sur deux cartes', 400);
            await increaseWager(tx, s.wagerId, userId, 'blackjack', hand.bet);
            hand.bet *= 2;
            hand.isDoubled = true;
          }
          hand.cards.push(s.shoe.pop()!);
          hand.value = handValue(hand.cards);
          hand.isBusted = hand.value > 21;
          hand.isStanding = hand.value >= 21 || hand.isDoubled;
        }
        if (s.hands.every(h => h.isStanding)) {
          // Dealer stands on all 17s; no unnecessary draws when every hand busted.
          if (s.hands.some(h => !h.isBusted)) while (handValue(s.dealerCards) < 17) s.dealerCards.push(s.shoe.pop()!);
          await this.resolve(s, tx);
        }
        return this.toGameState(s);
      });
      if (staged) this.publish(staged);
      return result;
    });
  }

  private async resolve(s: Session, tx: Prisma.TransactionClient): Promise<void> {
    const dealerValue = handValue(s.dealerCards);
    const dealerBJ = s.dealerCards.length === 2 && dealerValue === 21;
    for (const h of s.hands) {
      h.isStanding = true;
      h.payout = h.isBusted ? 0 : h.isBlackjack ? (dealerBJ ? h.bet : Math.floor(h.bet * 2.5)) :
        dealerBJ ? 0 : dealerValue > 21 || h.value > dealerValue ? h.bet * 2 : h.value === dealerValue ? h.bet : 0;
    }
    s.insurancePayout = dealerBJ ? s.insuranceBet * 3 : 0;
    s.insuranceAvailable = false;
    s.state = 'complete';
    const result = this.toGameState(s);
    await settleWager(tx, s.wagerId, s.userId, 'blackjack', result.payout, result as unknown as Prisma.InputJsonValue);
  }

  hit(userId: string, id: string, index: number) { return this.action(userId, id, 'hit', index); }
  stand(userId: string, id: string, index: number) { return this.action(userId, id, 'stand', index); }
  doubleDown(userId: string, id: string, index: number, key?: string) { return this.action(userId, id, 'double', index, 0, key); }
  split(userId: string, id: string, index: number, key?: string) { return this.action(userId, id, 'split', index, 0, key); }
  insurance(userId: string, id: string, amount: number, key?: string) { return this.action(userId, id, 'insurance', 0, amount, key); }
}
