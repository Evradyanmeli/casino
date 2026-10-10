import api from './api';
import { useBalanceStore } from '@/store/balanceStore';
export const GAME_BALANCE_ERROR = 'game-balance-error';

// Also refresh after a rejection: a timed-out request may have been settled.
async function gamePost<T>(url: string, data?: unknown): Promise<{ data: T }> {
  try {
    return await api.post<T>(url, data);
  } finally {
    try {
      await useBalanceStore.getState().syncBalance();
    } catch (err: any) {
      // Keep a successful game/session result usable even if its balance refresh fails.
      window.dispatchEvent(new CustomEvent(GAME_BALANCE_ERROR, {
        detail: `Solde non actualise : ${err.message || 'synchronisation impossible'}. Ne rejouez pas la mise pour cette raison.`,
      }));
    }
  }
}

export interface MinesCell {
  revealed: boolean;
  isMine?: boolean;
  index: number;
}

export interface MinesState {
  sessionId: string;
  grid: MinesCell[][];
  mineCount: number;
  revealedCount: number;
  bet: number;
  multiplier: number;
  state: 'betting' | 'playing' | 'won' | 'lost';
  payout: number;
}

export interface CrashPlayer {
  userId: string;
  bet: number;
  cashedOutAt: number | null;
  payout: number;
}

export interface CrashState {
  sessionId: string;
  roundId: string;
  multiplier: number;
  state: 'waiting' | 'running' | 'crashed';
  crashPoint?: number;
  players: CrashPlayer[];
}

export interface LimboState {
  sessionId: string;
  targetMultiplier: number;
  resultMultiplier: number;
  won: boolean;
  bet: number;
  payout: number;
  state: 'betting' | 'result';
}

export interface SlotSymbol {
  id: string;
  name: string;
  payout: number;
}

export interface PaylineResult {
  line: number;
  positions: number[];
  symbol: string;
  payout: number;
}

export interface SpinResult {
  reels: string[][];
  paylines: PaylineResult[];
  totalWin: number;
  isFreeSpin?: boolean;
  freeSpinsRemaining?: number;
}

export interface RouletteBetResult {
  type: string;
  positions: number[];
  amount: number;
  payout: number;
  won: boolean;
}

export interface RouletteResult {
  number: number;
  color: string;
  bets: RouletteBetResult[];
  totalWin: number;
}

export interface BlackjackCard {
  rank: string;
  suit: string;
  value: number;
  isRed?: boolean;
}

export interface BlackjackHand {
  cards: BlackjackCard[];
  bet: number;
  isDoubled: boolean;
  isSplit: boolean;
  value: number;
  isBlackjack: boolean;
  isBusted: boolean;
  payout: number;
}

export interface BlackjackState {
  sessionId: string;
  state: string;
  hands: BlackjackHand[];
  dealerCards: BlackjackCard[];
  dealerHidden: boolean;
  dealerValue: number;
  payout: number;
  activeHandIndex: number;
  insuranceAvailable: boolean;
  insuranceBet: number;
  insurancePayout: number;
  bet: number;
}

export interface CrapsState {
  passBet: number;
  sessionId: string;
  phase: string;
  point: number | null;
  dice: [number, number];
  diceTotal: number;
  payout: number;
  state: string;
  oddsBet: number;
}

export interface KenoState {
  drawnNumbers: number[];
  matchCount: number;
  payout: number;
}

export interface PlinkoResult {
  slot: number;
  multiplier: number;
  payout: number;
  path: number[];
  multipliers: number[];
}

export interface VPState {
  sessionId: string;
  phase: string;
  hand: { suit: string; rank: string }[];
  held: boolean[];
  handName: string;
  bet: number;
  payout: number;
}

export interface WheelState {
  segments: { multiplier: number; color: string; weight: number }[];
  result: { index: number; segment: { multiplier: number } };
  payout: number;
  multiplier?: number;
}

export interface GameStats {
  game: string;
  playCount: number;
  totalBet: number;
  totalWin: number;
}

export const minesApi = {
  getState: () => api.get<MinesState | null>('/games/mines/state').then(r => r.data),
  start: (bet: number, mineCount: number) =>
    gamePost<MinesState>('/games/mines/start', { bet, mineCount }).then(r => r.data),

  reveal: (sessionId: string, tileIndex: number) =>
    gamePost<MinesState>('/games/mines/reveal', { sessionId, tileIndex }).then(r => r.data),

  cashOut: (sessionId: string) =>
    gamePost<MinesState>('/games/mines/cashout', { sessionId }).then(r => r.data),
};

export const crashApi = {
  placeBet: (bet: number, autoCashout?: number) =>
    gamePost<CrashState>('/games/crash/bet', { bet, autoCashout: autoCashout || undefined }).then(r => r.data),

  cashOut: () =>
    gamePost<CrashState>('/games/crash/cashout').then(r => r.data),

  getState: () =>
    api.get<CrashState>('/games/crash/state').then(r => r.data),
};

export const limboApi = {
  play: (bet: number, targetMultiplier: number) =>
    gamePost<LimboState>('/games/limbo/play', { bet, targetMultiplier }).then(r => r.data),
};

export const gamesApi = {
  blackjackState: () => api.get<BlackjackState | null>('/games/blackjack/state').then(r => r.data),
  vpState: () => api.get<VPState | null>('/games/videopoker/state').then(r => r.data),
  slotsSpin: (variant: string, bet: number) =>
    gamePost<SpinResult>('/games/slots/spin', { variant, bet }).then(r => r.data),
  rouletteSpin: (bets: { type: string; positions: number[]; amount: number }[]) =>
    gamePost<RouletteResult>('/games/roulette/spin', { bets }).then(r => r.data),
  getGameStats: (game: string) =>
    api.get<GameStats>(`/games/${game}/stats`).then(r => r.data),
  blackjackStart: (bet: number) =>
    gamePost<BlackjackState>('/games/blackjack/start', { bet }).then(r => r.data),
  blackjackHit: (sessionId: string, handIndex: number) =>
    gamePost<BlackjackState>('/games/blackjack/hit', { sessionId, handIndex }).then(r => r.data),
  blackjackStand: (sessionId: string, handIndex: number) =>
    gamePost<BlackjackState>('/games/blackjack/stand', { sessionId, handIndex }).then(r => r.data),
  blackjackDouble: (sessionId: string, handIndex: number) =>
    gamePost<BlackjackState>('/games/blackjack/double', { sessionId, handIndex }).then(r => r.data),
  blackjackSplit: (sessionId: string, handIndex: number) =>
    gamePost<BlackjackState>('/games/blackjack/split', { sessionId, handIndex }).then(r => r.data),
  blackjackInsurance: (sessionId: string, amount: number) =>
    gamePost<BlackjackState>('/games/blackjack/insurance', { sessionId, amount }).then(r => r.data),
  craps: {
    getState: () => api.get<CrapsState | null>('/games/craps/state').then(r => r.data),
    start: (bet: number) =>
      gamePost<CrapsState>('/games/craps/start', { bet }).then(r => r.data),
    addOdds: (sessionId: string, oddsBet: number) =>
      gamePost<CrapsState>('/games/craps/odds', { sessionId, oddsBet }).then(r => r.data),
    roll: (sessionId: string) =>
      gamePost<CrapsState>('/games/craps/roll', { sessionId }).then(r => r.data),
  },
  keno: {
    play: (bet: number, numbers: number[]) =>
      gamePost<KenoState>('/games/keno/play', { bet, numbers }).then(r => r.data),
  },
  plinko: {
    drop: (bet: number, risk: string, rows: number) =>
      gamePost<PlinkoResult>('/games/plinko/drop', { bet, risk, rows }).then(r => r.data),
  },
  vpDeal: (bet: number) =>
    gamePost<VPState>('/games/videopoker/deal', { bet }).then(r => r.data),
  vpDraw: (sessionId: string, held: boolean[]) =>
    gamePost<VPState>('/games/videopoker/draw', { sessionId, held }).then(r => r.data),
  vpCancel: (sessionId: string) =>
    gamePost<VPState>('/games/videopoker/cancel', { sessionId }).then(r => r.data),
  wheel: {
    spin: (bet: number) =>
      gamePost<WheelState>('/games/wheel/spin', { bet }).then(r => r.data),
  },
};
