import { Prisma, PrismaClient } from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../../auth/AuthService.js';
import { EconomyService } from '../../economy/EconomyService.js';
import { GameLock, houseEdge, openWager, settleWager } from '../GameSupport.js';

interface MinesCell { revealed: boolean; isMine: boolean; index: number; }
export interface MinesState {
  sessionId: string; grid: MinesCell[][]; mineCount: number; revealedCount: number;
  bet: number; multiplier: number; state: 'betting' | 'playing' | 'won' | 'lost'; payout: number;
}
interface Session { state: MinesState; userId: string; wagerId: string; edge: number; }

export function calcMultiplier(mineCount: number, revealedCount: number, edge = 0.02): number {
  let survival = 1;
  for (let i = 0; i < revealedCount; i++) survival *= (25 - mineCount - i) / (25 - i);
  return revealedCount === 0 ? 1 : (1 - edge) / survival;
}
function generateGrid(mineCount: number): MinesCell[][] {
  const positions = Array.from({ length: 25 }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const mines = new Set(positions.slice(0, mineCount));
  const flat = Array.from({ length: 25 }, (_, index) => ({ index, revealed: false, isMine: mines.has(index) }));
  return Array.from({ length: 5 }, (_, row) => flat.slice(row * 5, row * 5 + 5));
}

export class MinesService {
  private sessions = new Map<string, Session>();
  private lock = new GameLock();
  constructor(private prisma: PrismaClient) {}

  private publicState(s: MinesState): MinesState {
    const result = structuredClone(s);
    if (result.state === 'playing') for (const row of result.grid) for (const cell of row) if (!cell.revealed) cell.isMine = false;
    return result;
  }

  getState(userId: string): MinesState | null {
    const s = [...this.sessions.values()].find(s => s.userId === userId && s.state.state === 'playing');
    return s ? this.publicState(s.state) : null;
  }

  async startGame(userId: string, bet: number, mineCount: number): Promise<MinesState> {
    return this.lock.run(userId, async () => {
      if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) throw new AppError('Mine count must be between 1 and 24', 400);
      if ([...this.sessions.values()].some(s => s.userId === userId && s.state.state === 'playing')) throw new AppError('A Mines session is already active', 409);
      const session: Session = { userId, wagerId: '', edge: 0.02, state: {
        sessionId: randomUUID(), grid: generateGrid(mineCount), mineCount, revealedCount: 0,
        bet, multiplier: 1, state: 'playing', payout: 0,
      } };
      await new EconomyService(this.prisma).runInTransaction(async tx => {
        session.edge = await houseEdge(tx, 'mines', 2);
        session.wagerId = await openWager(tx, userId, 'mines', bet);
      });
      this.sessions.set(session.state.sessionId, session);
      return this.publicState(session.state);
    });
  }

  private async action(userId: string, id: string, tileIndex?: number): Promise<MinesState> {
    return this.lock.run(userId, async () => {
      const original = this.sessions.get(id);
      if (!original || original.userId !== userId) throw new AppError('Session not found', 404);
      if (original.state.state !== 'playing') return this.publicState(original.state);
      const s = structuredClone(original);
      const state = s.state;
      await new EconomyService(this.prisma).runInTransaction(async tx => {
        if (tileIndex === undefined) {
          if (!state.revealedCount) throw new AppError('Cannot cash out before revealing a tile', 400);
          state.state = 'won';
        } else {
          if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex > 24) throw new AppError('Invalid tile index', 400);
          const cell = state.grid[Math.floor(tileIndex / 5)][tileIndex % 5];
          if (cell.revealed) throw new AppError('Tile already revealed', 400);
          cell.revealed = true;
          if (cell.isMine) state.state = 'lost';
          else {
            state.revealedCount++;
            state.multiplier = calcMultiplier(state.mineCount, state.revealedCount, s.edge);
            if (state.revealedCount === 25 - state.mineCount) state.state = 'won';
          }
        }
        if (state.state !== 'playing') {
          state.payout = state.state === 'won' ? Math.floor(state.bet * state.multiplier) : 0;
          for (const row of state.grid) for (const cell of row) if (cell.isMine) cell.revealed = true;
          await settleWager(tx, s.wagerId, userId, 'mines', state.payout, state as unknown as Prisma.InputJsonValue);
        }
      });
      this.sessions.set(id, s);
      if (state.state !== 'playing') setTimeout(() => this.sessions.delete(id), 600000).unref();
      return this.publicState(state);
    });
  }
  revealTile(userId: string, id: string, index: number) { return this.action(userId, id, index); }
  cashOut(userId: string, id: string) { return this.action(userId, id); }
}
