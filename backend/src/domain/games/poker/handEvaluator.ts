import { Card, Rank, compareRanks, rankValue } from './deck.js';

export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export interface EvaluatedHand {
  rank: HandRank;
  score: number[];
  cards: Card[];
  handName: string;
}

const HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: 'Hauteur',
  [HandRank.ONE_PAIR]: 'Paire',
  [HandRank.TWO_PAIR]: 'Double Paire',
  [HandRank.THREE_OF_A_KIND]: 'Brelan',
  [HandRank.STRAIGHT]: 'Quinte',
  [HandRank.FLUSH]: 'Couleur',
  [HandRank.FULL_HOUSE]: 'Full',
  [HandRank.FOUR_OF_A_KIND]: 'Carré',
  [HandRank.STRAIGHT_FLUSH]: 'Quinte Flush',
  [HandRank.ROYAL_FLUSH]: 'Quinte Flush Royale',
};

function getRankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  }
  return counts;
}

function getSuits(cards: Card[]): Set<string> {
  return new Set(cards.map(c => c.suit));
}

function isFlush(cards: Card[]): boolean {
  return getSuits(cards).size === 1;
}

function getSortedRanks(cards: Card[]): number[] {
  return cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
}

function isStraight(values: number[]): { isStraight: boolean; high: number } | null {
  const sorted = [...new Set(values)].sort((a, b) => b - a);
  if (sorted.length < 5) return null;

  for (let i = 0; i <= sorted.length - 5; i++) {
    if (sorted[i] - sorted[i + 4] === 4) {
      return { isStraight: true, high: sorted[i] };
    }
  }

  if (sorted.includes(14) && sorted.includes(2) && sorted.includes(3) && sorted.includes(4) && sorted.includes(5)) {
    return { isStraight: true, high: 5 };
  }

  return null;
}

function findBestStraightFlush(cards: Card[]): EvaluatedHand | null {
  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as const) {
    const suited = cards.filter(c => c.suit === suit).map(c => rankValue(c.rank)).sort((a, b) => b - a);
    if (suited.length < 5) continue;

    for (let i = 0; i <= suited.length - 5; i++) {
      if (suited[i] - suited[i + 4] === 4) {
        const highCard = suited[i];
        if (highCard === 14) {
          return { rank: HandRank.ROYAL_FLUSH, score: [14], cards: [], handName: 'Quinte Flush Royale' };
        }
        return { rank: HandRank.STRAIGHT_FLUSH, score: [highCard], cards: [], handName: `Quinte Flush au ${highCard}` };
      }
    }

    if (suited.includes(14) && suited.includes(2) && suited.includes(3) && suited.includes(4) && suited.includes(5)) {
      return { rank: HandRank.STRAIGHT_FLUSH, score: [5], cards: [], handName: 'Quinte Flush au 5' };
    }
  }
  return null;
}

function evaluateFourOfAKind(counts: Map<Rank, number>): EvaluatedHand | null {
  for (const [rank, count] of counts) {
    if (count === 4) {
      const kickers = [...counts.keys()]
        .filter(r => r !== rank)
        .sort((a, b) => compareRanks(b, a))
        .map(r => rankValue(r));
      return { rank: HandRank.FOUR_OF_A_KIND, score: [rankValue(rank), ...kickers.slice(0, 1)], cards: [], handName: `Carré de ${rank}` };
    }
  }
  return null;
}

function evaluateFullHouse(counts: Map<Rank, number>): EvaluatedHand | null {
  let three: Rank | null = null;
  let pair: Rank | null = null;

  for (const [rank, count] of counts) {
    if (count >= 3 && (!three || compareRanks(rank, three) > 0)) three = rank;
  }

  if (!three) return null;

  for (const [rank, count] of counts) {
    if (rank !== three && count >= 2 && (!pair || compareRanks(rank, pair) > 0)) pair = rank;
  }

  if (three && pair) {
    return { rank: HandRank.FULL_HOUSE, score: [rankValue(three), rankValue(pair)], cards: [], handName: `Full ${three} par ${pair}` };
  }

  if (three && !pair) {
    for (const [rank, count] of counts) {
      if (rank !== three && count === 3 && (!pair || compareRanks(rank, pair) > 0)) pair = rank;
    }
    if (pair) {
      const high = compareRanks(three, pair) > 0 ? three : pair;
      const low = compareRanks(three, pair) > 0 ? pair : three;
      return { rank: HandRank.FULL_HOUSE, score: [rankValue(high), rankValue(low)], cards: [], handName: `Full ${high} par ${low}` };
    }
  }

  return null;
}

function evaluateFlush(cards: Card[]): EvaluatedHand | null {
  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as const) {
    const suited = cards.filter(c => c.suit === suit);
    if (suited.length >= 5) {
      const sorted = suited.map(c => rankValue(c.rank)).sort((a, b) => b - a).slice(0, 5);
      return { rank: HandRank.FLUSH, score: sorted, cards: suited.slice(0, 5), handName: 'Couleur' };
    }
  }
  return null;
}

function evaluateStraight(cards: Card[]): EvaluatedHand | null {
  const values = cards.map(c => rankValue(c.rank));
  const straight = isStraight(values);
  if (straight) {
    return { rank: HandRank.STRAIGHT, score: [straight.high], cards: [], handName: `Quinte au ${straight.high}` };
  }
  return null;
}

function evaluateThreeOfAKind(counts: Map<Rank, number>): EvaluatedHand | null {
  for (const [rank, count] of counts) {
    if (count === 3) {
      const kickers = [...counts.keys()]
        .filter(r => r !== rank)
        .sort((a, b) => compareRanks(b, a))
        .map(r => rankValue(r));
      return { rank: HandRank.THREE_OF_A_KIND, score: [rankValue(rank), ...kickers.slice(0, 2)], cards: [], handName: `Brelan de ${rank}` };
    }
  }
  return null;
}

function evaluateTwoPair(counts: Map<Rank, number>): EvaluatedHand | null {
  const pairs: Rank[] = [];
  for (const [rank, count] of counts) {
    if (count === 2) pairs.push(rank);
  }
  if (pairs.length >= 2) {
    pairs.sort((a, b) => compareRanks(b, a));
    const kickers = [...counts.keys()]
      .filter(r => r !== pairs[0] && r !== pairs[1])
      .sort((a, b) => compareRanks(b, a))
      .map(r => rankValue(r));
    return {
      rank: HandRank.TWO_PAIR,
      score: [rankValue(pairs[0]), rankValue(pairs[1]), ...kickers.slice(0, 1)],
      cards: [],
      handName: `Double Paire ${pairs[0]} et ${pairs[1]}`,
    };
  }
  return null;
}

function evaluateOnePair(counts: Map<Rank, number>): EvaluatedHand | null {
  for (const [rank, count] of counts) {
    if (count === 2) {
      const kickers = [...counts.keys()]
        .filter(r => r !== rank)
        .sort((a, b) => compareRanks(b, a))
        .map(r => rankValue(r));
      return { rank: HandRank.ONE_PAIR, score: [rankValue(rank), ...kickers.slice(0, 3)], cards: [], handName: `Paire de ${rank}` };
    }
  }
  return null;
}

function evaluateHighCard(cards: Card[]): EvaluatedHand {
  const sorted = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a).slice(0, 5);
  return { rank: HandRank.HIGH_CARD, score: sorted, cards: cards.slice(0, 5), handName: 'Hauteur' };
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    const sorted = allCards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
    return { rank: HandRank.HIGH_CARD, score: sorted, cards: allCards, handName: 'Hauteur' };
  }

  const straightFlush = findBestStraightFlush(allCards);
  if (straightFlush) return straightFlush;

  const counts = getRankCounts(allCards);

  const four = evaluateFourOfAKind(counts);
  if (four) return four;

  const fullHouse = evaluateFullHouse(counts);
  if (fullHouse) return fullHouse;

  const flush = evaluateFlush(allCards);
  if (flush) return flush;

  const straight = evaluateStraight(allCards);
  if (straight) return straight;

  const three = evaluateThreeOfAKind(counts);
  if (three) return three;

  const twoPair = evaluateTwoPair(counts);
  if (twoPair) return twoPair;

  const onePair = evaluateOnePair(counts);
  if (onePair) return onePair;

  return evaluateHighCard(allCards);
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.score.length, b.score.length); i++) {
    if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
  }
  return 0;
}

export function getHandName(handRank: HandRank): string {
  return HAND_NAMES[handRank];
}

export function getWinner(hands: { userId: string; holeCards: Card[]; communityCards: Card[] }[]): { userId: string; hand: EvaluatedHand }[] {
  const evaluated = hands.map(h => ({
    userId: h.userId,
    hand: evaluateHand(h.holeCards, h.communityCards),
  }));

  evaluated.sort((a, b) => compareHands(a.hand, b.hand));
  const best = evaluated[evaluated.length - 1];

  const winners = evaluated.filter(e => compareHands(e.hand, best.hand) === 0);
  return winners;
}
