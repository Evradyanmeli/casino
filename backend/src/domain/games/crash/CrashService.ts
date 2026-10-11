import { Prisma, PrismaClient } from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../../auth/AuthService.js';
import { EconomyService } from '../../economy/EconomyService.js';
import { GameLock, houseEdge, openWager, settleWager, validBet } from '../GameSupport.js';
import { runFinancialOperation } from '../../economy/FinancialOperation.js';

interface CrashPlayer {
  userId: string; bet: number; cashedOutAt: number | null; payout: number; autoCashout?: number;
}
interface InternalPlayer extends CrashPlayer { wagerId: string; settled: boolean; }
export interface CrashState {
  sessionId: string; roundId: string; multiplier: number; state: 'waiting' | 'running' | 'crashed';
  crashPoint?: number; players: CrashPlayer[];
}
interface Round {
  id: string; state: CrashState['state']; multiplier: number; crashPoint: number;
  startedAt: number; players: InternalPlayer[];
}

export class CrashService {
  private round: Round | null = null;
  private lock = new GameLock();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private failures = 0;
  constructor(private prisma: PrismaClient, private onSettled?: (roundId: string, player: CrashPlayer) => Promise<void>) {}

  private publicState(r = this.round!): CrashState {
    return { sessionId: 'crash-main', roundId: r.id, state: r.state, multiplier: r.multiplier,
      ...(r.state === 'crashed' ? { crashPoint: r.crashPoint } : {}),
      players: r.players.map(({ wagerId, settled, ...player }) => structuredClone(player)) };
  }

  getCurrentState(): CrashState {
    if (!this.round) this.reset();
    return this.publicState();
  }

  private reset(): void {
    if (this.timer) clearTimeout(this.timer);
    this.round = { id: randomUUID(), state: 'waiting', multiplier: 1, crashPoint: 1, startedAt: 0, players: [] };
    this.schedule(5000);
  }

  private schedule(delay: number): void {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick().then(() => { this.failures = 0; }).catch(() => {
        // Keep the last committed state and retry with bounded backoff, never drop wagers.
        this.schedule(Math.min(10000, 1000 * 2 ** Math.min(this.failures++, 4)));
      });
    }, delay);
    this.timer.unref();
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async notify(r: Round, players: InternalPlayer[]): Promise<void> {
    for (const p of players) {
      try { await this.onSettled?.(r.id, { userId: p.userId, bet: p.bet, payout: p.payout, cashedOutAt: p.cashedOutAt, autoCashout: p.autoCashout }); }
      catch { /* Progression is non-financial and must not retry settlement. */ }
    }
  }

  private async pay(tx: Prisma.TransactionClient, r: Round, p: InternalPlayer, at: number | null): Promise<void> {
    p.cashedOutAt = at;
    p.payout = at === null ? 0 : Math.floor(p.bet * at);
    await settleWager(tx, p.wagerId, p.userId, 'crash', p.payout, { roundId: r.id, cashedOutAt: at, multiplier: at,
      ...(at === null ? { crashPoint: r.crashPoint } : {}) });
    p.settled = true;
  }

  private async tick(): Promise<void> {
    await this.lock.run('round', async () => {
      if (this.closed || !this.round) return;
      if (this.round.state === 'crashed') { this.reset(); return; }
      const r = structuredClone(this.round);
      if (r.state === 'waiting') {
        const edge = await houseEdge(this.prisma, 'crash', 1);
        // Exponential growth and a 1000x cap bound running time to about 35 seconds.
        r.crashPoint = Math.min(1000, Math.max(1, Math.floor((1 - edge) / (randomInt(1, 2 ** 48 - 1) / (2 ** 48)) * 100) / 100));
        r.state = 'running';
        r.startedAt = Date.now();
        this.round = r;
        this.schedule(100);
        return;
      }
      const next = Math.min(1000, Math.exp((Date.now() - r.startedAt) / 5000));
      const payable = r.players.filter(p => !p.settled && p.autoCashout !== undefined && p.autoCashout <= next && p.autoCashout < r.crashPoint);
      const crashed = next >= r.crashPoint;
      const losing = crashed ? r.players.filter(p => !p.settled && !payable.includes(p)) : [];
      if (payable.length || losing.length) await new EconomyService(this.prisma).runInTransaction(async tx => {
        for (const p of payable) await this.pay(tx, r, p, p.autoCashout!);
        for (const p of losing) await this.pay(tx, r, p, null);
      });
      r.multiplier = crashed ? r.crashPoint : Math.floor(next * 100) / 100;
      if (crashed) r.state = 'crashed';
      this.round = r;
      this.schedule(crashed ? 3000 : 100);
      await this.notify(r, [...payable, ...losing]);
    });
  }

  async placeBet(userId: string, bet: number, autoCashout?: number, key?: string): Promise<CrashState> {
    validBet(bet);
    if (autoCashout !== undefined && (!Number.isFinite(autoCashout) || autoCashout < 1.01 || autoCashout > 1000000)) throw new AppError('Auto cashout must be between 1.01 and 1000000', 400);
    this.getCurrentState();
    return this.lock.run('round', async () => {
      const r = structuredClone(this.round!);
      let performed = false;
      const result = await runFinancialOperation(this.prisma, userId, 'crash_bet', key, { bet, autoCashout }, async tx => {
      if (r.state !== 'waiting') throw new AppError('Cannot place bet during active round', 400);
      if (r.players.some(p => p.userId === userId)) throw new AppError('Bet already placed for this round', 409);
      const wagerId = await openWager(tx, userId, 'crash', bet, bet * 1000);
      r.players.push({ userId, bet, autoCashout, cashedOutAt: null, payout: 0, wagerId, settled: false });
      performed = true;
      return this.publicState(r);
      });
      if (performed) this.round = r;
      return result;
    });
  }

  async cashOut(userId: string): Promise<CrashState> {
    return this.lock.run('round', async () => {
      if (!this.round) throw new AppError('Game session not found', 404);
      const r = structuredClone(this.round);
      const p = r.players.find(p => p.userId === userId);
      if (!p) throw new AppError('No bet found for this user', 404);
      if (p.settled && p.cashedOutAt !== null) return this.publicState();
      // Use the same elapsed-time clock as the timer, not a stale polling multiplier.
      const current = Math.floor(Math.min(1000, Math.exp((Date.now() - r.startedAt) / 5000)) * 100) / 100;
      if (r.state !== 'running' || p.settled || current >= r.crashPoint) throw new AppError('Game is not running or has crashed', 400);
      const at = p.autoCashout !== undefined && p.autoCashout <= current ? p.autoCashout : current;
      await new EconomyService(this.prisma).runInTransaction(async tx => { await this.pay(tx, r, p, at); });
      this.round = r;
      await this.notify(r, [p]);
      return this.publicState();
    });
  }
}
