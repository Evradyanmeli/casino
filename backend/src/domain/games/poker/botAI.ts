import { Card, rankValue } from './deck.js';
import { evaluateHand, HandRank } from './handEvaluator.js';

interface BotContext {
  holeCards: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  playerBet: number;
  chips: number;
  playersInHand: number;
  currentRaise: number;
  bigBlind: number;
  phase: 'preflop' | 'flop' | 'turn' | 'river';
  skillLevel: 'easy' | 'medium' | 'hard';
}

interface BotDecision {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount: number;
}

function getHandStrength(holeCards: Card[], communityCards: Card[]): number {
  const hand = evaluateHand(holeCards, communityCards);
  return hand.rank;
}

function isPremiumPreflop(holeCards: Card[]): boolean {
  const r1 = rankValue(holeCards[0].rank);
  const r2 = rankValue(holeCards[1].rank);
  const suited = holeCards[0].suit === holeCards[1].suit;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const pair = r1 === r2;

  if (pair && high >= 10) return true;
  if (high >= 12 && low >= 11) return true;
  if (high >= 14 && low >= 10) return true;
  if (high >= 13 && low >= 11 && suited) return true;
  if (high >= 11 && low >= 10 && suited) return true;

  return false;
}

function isGoodPreflop(holeCards: Card[]): boolean {
  const r1 = rankValue(holeCards[0].rank);
  const r2 = rankValue(holeCards[1].rank);
  const suited = holeCards[0].suit === holeCards[1].suit;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const pair = r1 === r2;

  if (pair) return true;
  if (high >= 12 && low >= 10) return true;
  if (high >= 10 && low >= 9 && suited) return true;
  if (high >= 13 && low >= 8) return true;
  if (high >= 11 && low >= 9) return true;

  return false;
}

function isPlayablePreflop(holeCards: Card[]): boolean {
  const r1 = rankValue(holeCards[0].rank);
  const r2 = rankValue(holeCards[1].rank);
  const suited = holeCards[0].suit === holeCards[1].suit;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const gap = high - low;
  const pair = r1 === r2;

  if (pair && low >= 5) return true;
  if (high >= 10) return true;
  if (suited && high >= 8 && gap <= 2) return true;
  if (high >= 9 && low >= 6) return true;
  if (high >= 8 && low >= 8) return true;

  return false;
}

function calculatePotOdds(callAmount: number, pot: number): number {
  if (callAmount <= 0) return 0;
  return callAmount / (pot + callAmount);
}

export function botDecide(context: BotContext): BotDecision {
  const { skillLevel } = context;

  switch (skillLevel) {
    case 'easy':
      return easyBot(context);
    case 'medium':
      return mediumBot(context);
    case 'hard':
      return hardBot(context);
    default:
      return easyBot(context);
  }
}

function easyBot(context: BotContext): BotDecision {
  const { holeCards, communityCards, pot, currentBet, playerBet, chips, currentRaise, bigBlind, phase } = context;
  const callAmount = currentBet - playerBet;
  const rand = Math.random();

  if (callAmount >= chips) {
    if (rand < 0.4) return { action: 'call', amount: chips };
    return { action: 'fold', amount: 0 };
  }

  const toCall = currentBet - playerBet;

  if (phase === 'preflop') {
    if (isPremiumPreflop(holeCards)) {
      if (rand < 0.3 && toCall <= bigBlind * 3) {
        const raiseAmount = Math.min(bigBlind * 3, chips);
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call', amount: toCall };
    }
    if (isGoodPreflop(holeCards)) {
      if (rand < 0.7) return { action: 'call', amount: toCall };
      return { action: 'fold', amount: 0 };
    }
    if (rand < 0.3) return { action: 'call', amount: toCall };
    return { action: 'fold', amount: 0 };
  }

  const hand = evaluateHand(holeCards, communityCards);

  if (hand.rank >= HandRank.ONE_PAIR) {
    if (rand < 0.5) {
      const minRaise = Math.max(currentRaise * 2, bigBlind * 2);
      const raiseAmount = Math.min(minRaise, chips);
      return { action: 'raise', amount: raiseAmount };
    }
    return { action: 'call', amount: toCall };
  }

  if (rand < 0.3) return { action: 'call', amount: toCall };
  return { action: 'fold', amount: 0 };
}

function mediumBot(context: BotContext): BotDecision {
  const { holeCards, communityCards, pot, currentBet, playerBet, chips, currentRaise, bigBlind, phase, playersInHand } = context;
  const callAmount = currentBet - playerBet;
  const toCall = Math.max(callAmount, 0);
  const rand = Math.random();

  if (callAmount >= chips) {
    const hand = evaluateHand(holeCards, communityCards);
    if (hand.rank >= HandRank.THREE_OF_A_KIND || (hand.rank >= HandRank.ONE_PAIR && playersInHand <= 2)) {
      return { action: 'call', amount: chips };
    }
    if (rand < 0.3) return { action: 'call', amount: chips };
    return { action: 'fold', amount: 0 };
  }

  if (phase === 'preflop') {
    if (isPremiumPreflop(holeCards)) {
      if (toCall <= bigBlind || rand < 0.6) {
        const raiseAmount = Math.min(bigBlind * (3 + Math.floor(rand * 2)), chips);
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call', amount: toCall };
    }
    if (isGoodPreflop(holeCards)) {
      if (toCall <= bigBlind && rand < 0.4) {
        const raiseAmount = Math.min(bigBlind * 2, chips);
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call', amount: toCall };
    }
    if (isPlayablePreflop(holeCards) && toCall <= bigBlind) {
      return { action: 'call', amount: toCall };
    }
    return { action: 'fold', amount: 0 };
  }

  const hand = evaluateHand(holeCards, communityCards);

  if (hand.rank >= HandRank.FLUSH || hand.rank === HandRank.STRAIGHT) {
    const bet = Math.min(pot * (0.5 + rand * 0.5), chips);
    return { action: 'raise', amount: Math.max(bet, toCall) };
  }

  if (hand.rank === HandRank.THREE_OF_A_KIND || hand.rank === HandRank.TWO_PAIR) {
    if (toCall <= bigBlind * 2 || rand < 0.5) {
      const bet = Math.min(pot * (0.3 + rand * 0.3), chips);
      return { action: 'raise', amount: Math.max(bet, toCall) };
    }
    return { action: 'call', amount: toCall };
  }

  if (hand.rank === HandRank.ONE_PAIR) {
    if (toCall > bigBlind * 2 && rand > 0.4) return { action: 'fold', amount: 0 };
    if (toCall <= bigBlind) {
      const bet = Math.min(bigBlind, chips);
      return { action: 'raise', amount: bet };
    }
    return { action: 'call', amount: toCall };
  }

  if (hand.rank === HandRank.HIGH_CARD) {
    const potOdds = calculatePotOdds(toCall, pot);
    if (potOdds < 0.15 && playersInHand <= 2 && rand < 0.3) {
      return { action: 'call', amount: toCall };
    }
    return { action: 'fold', amount: 0 };
  }

  return { action: 'fold', amount: 0 };
}

function hardBot(context: BotContext): BotDecision {
  const { holeCards, communityCards, pot, currentBet, playerBet, chips, currentRaise, bigBlind, phase, playersInHand } = context;
  const toCall = Math.max(currentBet - playerBet, 0);
  const rand = Math.random();

  if (toCall >= chips) {
    const hand = evaluateHand(holeCards, communityCards);
    if (hand.rank >= HandRank.FLUSH) return { action: 'call', amount: chips };
    if (hand.rank >= HandRank.THREE_OF_A_KIND && rand < 0.6) return { action: 'call', amount: chips };
    if (playersInHand <= 2 && rand < 0.3) return { action: 'call', amount: chips };
    return { action: 'fold', amount: 0 };
  }

  if (phase === 'preflop') {
    if (isPremiumPreflop(holeCards)) {
      const raiseAmount = Math.min(bigBlind * (3 + Math.floor(rand * 4)), chips);
      return { action: 'raise', amount: raiseAmount };
    }
    if (isGoodPreflop(holeCards)) {
      if (toCall <= bigBlind) {
        const raiseAmount = Math.min(bigBlind * (2 + Math.floor(rand * 2)), chips);
        return { action: 'raise', amount: raiseAmount };
      }
      if (rand < 0.3) {
        const raiseAmount = Math.min(bigBlind * 4, chips);
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call', amount: toCall };
    }
    if (isPlayablePreflop(holeCards) && toCall <= bigBlind) {
      return { action: 'call', amount: toCall };
    }
    if (rand < 0.15) {
      const raiseAmount = Math.min(bigBlind * 3, chips);
      return { action: 'raise', amount: raiseAmount };
    }
    return { action: 'fold', amount: 0 };
  }

  const hand = evaluateHand(holeCards, communityCards);

  if (hand.rank === HandRank.ROYAL_FLUSH || hand.rank === HandRank.STRAIGHT_FLUSH) {
    return { action: 'all-in', amount: chips };
  }

  if (hand.rank >= HandRank.FLUSH) {
    const bet = Math.min(pot * (0.66 + rand * 0.34), chips);
    return { action: 'raise', amount: Math.max(bet, toCall) };
  }

  if (hand.rank === HandRank.STRAIGHT || hand.rank === HandRank.FOUR_OF_A_KIND) {
    const bet = Math.min(pot * (0.5 + rand * 0.5), chips);
    return { action: 'raise', amount: Math.max(bet, toCall) };
  }

  if (hand.rank === HandRank.FULL_HOUSE || hand.rank === HandRank.THREE_OF_A_KIND) {
    if (toCall <= bigBlind * 2) {
      const bet = Math.min(pot * (0.4 + rand * 0.3), chips);
      return { action: 'raise', amount: Math.max(bet, toCall) };
    }
    const potOdds = calculatePotOdds(toCall, pot);
    if (potOdds < 0.25) return { action: 'call', amount: toCall };
    return { action: 'fold', amount: 0 };
  }

  if (hand.rank === HandRank.TWO_PAIR) {
    if (toCall <= bigBlind) {
      const bet = Math.min(pot * 0.5, chips);
      return { action: 'raise', amount: Math.max(bet, bigBlind) };
    }
    const potOdds = calculatePotOdds(toCall, pot);
    if (potOdds < 0.2) return { action: 'call', amount: toCall };
    return { action: 'fold', amount: 0 };
  }

  if (hand.rank === HandRank.ONE_PAIR) {
    if (toCall > bigBlind * 3) return { action: 'fold', amount: 0 };
    if (toCall <= bigBlind && rand < 0.4) {
      const bet = Math.min(bigBlind * 3, chips);
      return { action: 'raise', amount: bet };
    }
    const potOdds = calculatePotOdds(toCall, pot);
    if (potOdds < 0.2 && playersInHand <= 3) return { action: 'call', amount: toCall };
    if (rand < 0.1) {
      const bet = Math.min(bigBlind * 4, chips);
      return { action: 'raise', amount: bet };
    }
    return { action: 'fold', amount: 0 };
  }

  if (hand.rank === HandRank.HIGH_CARD) {
    if (phase === 'river') return { action: 'fold', amount: 0 };
    const potOdds = calculatePotOdds(toCall, pot);
    if (potOdds < 0.1 && playersInHand <= 2 && rand < 0.2) {
      return { action: 'call', amount: toCall };
    }
    if (rand < 0.08) {
      const bet = Math.min(pot * 0.75, chips);
      return { action: 'raise', amount: Math.max(bet, bigBlind * 2) };
    }
    return { action: 'fold', amount: 0 };
  }

  return { action: 'fold', amount: 0 };
}
