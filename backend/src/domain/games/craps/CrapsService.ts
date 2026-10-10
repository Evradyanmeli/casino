import { randomInt, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { EconomyService } from '../../economy/EconomyService.js';
import { AppError } from '../../auth/AuthService.js';
import { GameLock, openWager, increaseWager, settleWager } from '../GameSupport.js';

interface CrapsState {
  sessionId: string; phase: 'comeout' | 'point' | 'resolved'; point: number | null;
  dice: [number, number] | null; diceTotal: number | null; passBet: number; oddsBet: number;
  payout: number; state: 'won' | 'lost' | 'playing';
}
interface Session { userId: string; wagerId: string; state: CrapsState; }
function rollDice(): [number, number] { return [randomInt(1, 7), randomInt(1, 7)]; }
function calculatePayoff(passBet: number, oddsBet: number, point: number): number {
  const multipliers: Record<number, number> = { 4: 2, 5: 3 / 2, 6: 6 / 5, 8: 6 / 5, 9: 3 / 2, 10: 2 };
  return passBet * 2 + oddsBet + Math.floor(oddsBet * multipliers[point]);
}

export class CrapsService {
  private sessions = new Map<string, Session>();
  private lock = new GameLock();
  constructor(private prisma: PrismaClient) {}
  private publish(s: Session): CrapsState {
    this.sessions.set(s.state.sessionId, s);
    if (s.state.state !== 'playing') setTimeout(() => this.sessions.delete(s.state.sessionId), 600000).unref();
    return structuredClone(s.state);
  }
  async startRound(userId: string, passBet: number): Promise<CrapsState> {
    return this.lock.run(userId, async () => {
      if ([...this.sessions.values()].some(s => s.userId === userId && s.state.state === 'playing')) throw new AppError('A Craps session is already active', 409);
      const dice = rollDice();
      const total = dice[0] + dice[1];
      const won = total === 7 || total === 11;
      const lost = total === 2 || total === 3 || total === 12;
      const s: Session = { userId, wagerId: '', state: {
        sessionId: randomUUID(), dice, diceTotal: total, phase: won || lost ? 'resolved' : 'point',
        point: won || lost ? null : total, passBet, oddsBet: 0, payout: won ? passBet * 2 : 0, state: won ? 'won' : lost ? 'lost' : 'playing',
      } };
      await new EconomyService(this.prisma).runInTransaction(async tx => {
        s.wagerId = await openWager(tx, userId, 'craps', passBet);
        if (won || lost) await settleWager(tx, s.wagerId, userId, 'craps', s.state.payout, s.state as unknown as Prisma.InputJsonValue);
      });
      return this.publish(s);
    });
  }
  private async action(userId: string, id: string, odds?: number): Promise<CrapsState> {
    return this.lock.run(userId, async () => {
      const original = this.sessions.get(id);
      if (!original || original.userId !== userId) throw new AppError('Session not found', 404);
      if (original.state.state !== 'playing') {
        if (odds !== undefined) throw new AppError('Round already resolved', 400);
        return structuredClone(original.state);
      }
      const s = structuredClone(original);
      const state = s.state;
      await new EconomyService(this.prisma).runInTransaction(async tx => {
        if (odds !== undefined) {
          if (state.oddsBet + odds > state.passBet * 3) throw new AppError('Odds maximum is 3x the pass bet', 400);
          await increaseWager(tx, s.wagerId, userId, 'craps', odds);
          state.oddsBet += odds;
        } else {
          state.dice = rollDice();
          state.diceTotal = state.dice[0] + state.dice[1];
          if (state.diceTotal === state.point) { state.state = 'won'; state.payout = calculatePayoff(state.passBet, state.oddsBet, state.point!); }
          else if (state.diceTotal === 7) state.state = 'lost';
          if (state.state !== 'playing') {
            state.phase = 'resolved';
            await settleWager(tx, s.wagerId, userId, 'craps', state.payout, state as unknown as Prisma.InputJsonValue);
          }
        }
      });
      return this.publish(s);
    });
  }
  getState(userId: string): CrapsState | null {
    const s = [...this.sessions.values()].find(s => s.userId === userId && s.state.state === 'playing');
    return s ? structuredClone(s.state) : null;
  }
  addOdds(userId: string, id: string, odds: number) { return this.action(userId, id, odds); }
  roll(userId: string, id: string) { return this.action(userId, id); }
}
