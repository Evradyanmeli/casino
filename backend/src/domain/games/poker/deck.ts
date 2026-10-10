export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ suit, rank });
      }
    }
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(): Card {
    const card = this.cards.pop();
    if (!card) throw new Error('Deck is empty');
    return card;
  }

  get remaining(): number {
    return this.cards.length;
  }

  clone(): Deck {
    const deck = new Deck();
    deck.cards = this.cards.map(card => ({ ...card }));
    return deck;
  }
}

export function compareRanks(a: Rank, b: Rank): number {
  return RANKS.indexOf(a) - RANKS.indexOf(b);
}

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2;
}
