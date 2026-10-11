import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MinesService } from '../../domain/games/mines/MinesService.js';
import { CrashService } from '../../domain/games/crash/CrashService.js';
import { LimboService } from '../../domain/games/limbo/LimboService.js';
import { SlotsService } from '../../domain/games/slots/SlotsService.js';
import { RouletteService } from '../../domain/games/roulette/RouletteService.js';
import { BlackjackService } from '../../domain/games/blackjack/BlackjackService.js';
import { VideoPokerService } from '../../domain/games/videopoker/VideoPokerService.js';
import { CrapsService } from '../../domain/games/craps/CrapsService.js';
import { WheelService } from '../../domain/games/wheel/WheelService.js';
import { KenoService, PAYOUTS as KENO_PAYOUTS } from '../../domain/games/keno/KenoService.js';
import { PlinkoService, MULTIPLIERS as PLINKO_PAYOUTS } from '../../domain/games/plinko/PlinkoService.js';
import { runFinancialOperation } from '../../domain/economy/FinancialOperation.js';
import { EconomyService } from '../../domain/economy/EconomyService.js';
import { LevelService } from '../../domain/progression/LevelService.js';
import { TaskService } from '../../domain/progression/TaskService.js';
import { BadgeService } from '../../domain/progression/BadgeService.js';
import { AppError } from '../../domain/auth/AuthService.js';
import { NotificationService } from '../../domain/notification/NotificationService.js';
import { GameLock, instantWager, houseEdge } from '../../domain/games/GameSupport.js';

export default async function gamesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const minesService = new MinesService(app.prisma);
  const crashService = new CrashService(app.prisma, async (roundId, player) => {
    await handleStateProgression(player.userId, 'crash', roundId, player.bet, player.payout);
  });
  app.addHook('onClose', async () => { crashService.close(); });
  const limboService = new LimboService(app.prisma);
  const slotsService = new SlotsService(app.prisma);
  const rouletteService = new RouletteService(app.prisma);
  const economyService = new EconomyService(app.prisma);
  const blackjackService = new BlackjackService(app.prisma, economyService);
  const videoPokerService = new VideoPokerService(app.prisma, economyService);
  const crapsService = new CrapsService(app.prisma);
  const wheelService = new WheelService();
  const kenoService = new KenoService();
  const plinkoService = new PlinkoService();
  const notificationService = new NotificationService(app.prisma);
  const levelService = new LevelService(app.prisma, notificationService);
  const taskService = new TaskService(app.prisma);
  const badgeService = new BadgeService(app.prisma, notificationService, levelService);

  const progressionLock = new GameLock();
  const progression = new Map<string, { bet: number; payout: number }>();
  async function handleProgression(userId: string, gameType: string, totalWin: number, bet: number, play = true) {
    try {
      const xpAmount = Math.floor(totalWin > 0 ? totalWin / 10 : bet / 100);
      await levelService.addXp(userId, xpAmount);
      if (play) await taskService.incrementProgress(userId, 'play_game', gameType);
      if (bet > 0) await taskService.incrementProgress(userId, 'bet', gameType, bet);
      if (totalWin > 0) await taskService.incrementProgress(userId, 'win', gameType, totalWin);
      await badgeService.checkAndAwardBadges(userId);
    } catch {
      // progression errors are non-critical
    }
  }

  async function handleStateProgression(userId: string, gameType: string, id: string, bet: number, payout: number) {
    const key = `${userId}:${gameType}:${id}`;
    await progressionLock.run(key, async () => {
      const previous = progression.get(key);
      const addedBet = Math.max(0, bet - (previous?.bet ?? 0));
      const addedWin = Math.max(0, payout - (previous?.payout ?? 0));
      if (!previous || addedBet || addedWin) {
        await handleProgression(userId, gameType, addedWin, addedBet, !previous);
        progression.set(key, { bet, payout });
        if (!previous) setTimeout(() => progression.delete(key), 86400000).unref();
      }
    });
  }

  // Independent route guard, even for services that own financial transactions.
  app.addHook('preHandler', async (request, reply) => {
    if (request.method !== 'POST' || /\/(cashout|cancel|hit|stand|draw|reveal|roll)$/.test(request.routeOptions.url ?? '')) return;
    const game = request.routeOptions.url?.match(/\/games\/([^/]+)\//)?.[1];
    if (!game) return;
    try { await economyService.assertCanPlay(request.user.sub, game); }
    catch (err) { return handleError(err, reply); }
  });

  app.get('/games/config', async () => {
    const configs = await app.prisma.gameConfig.findMany({ orderBy: { gameType: 'asc' } });
    const defaults = ['slots', 'roulette', 'blackjack', 'videopoker', 'craps', 'wheel', 'keno', 'plinko', 'mines', 'crash', 'limbo'];
    return defaults.map(gameType => {
      const config = configs.find(c => c.gameType === gameType);
      const minBet = Number(config?.minBet ?? 1n);
      const maxBet = Number(config?.maxBet ?? (gameType === 'videopoker' ? 5n : 100000n));
      return { gameType, active: config?.active ?? true, minBet, maxBet,
        houseEdge: config?.houseEdge ?? (gameType === 'mines' ? 2 : ['limbo', 'crash'].includes(gameType) ? 1 : null),
        ...(gameType === 'videopoker' ? { supportedMinBet: 1, supportedMaxBet: 5,
          configurationError: minBet > 5 || maxBet < 1 ? 'Video Poker limits must overlap 1-5' : null } : {}) };
    });
  });

  app.get('/games/blackjack/state', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = z.object({ sessionId: z.string().optional() }).parse(request.query);
      return blackjackService.getState(request.user.sub, query.sessionId);
    } catch (err) { return handleError(err, reply); }
  });
  app.get('/games/videopoker/state', async (request: FastifyRequest) => videoPokerService.getState(request.user.sub));
  app.post('/games/videopoker/cancel', async (request, reply) => {
    try {
      const { sessionId } = z.object({ sessionId: z.string() }).parse(request.body);
      return await videoPokerService.cancel(request.user.sub, sessionId);
    } catch (err) { return handleError(err, reply); }
  });
  app.get('/games/mines/state', async (request: FastifyRequest) => minesService.getState(request.user.sub));
  app.get('/games/craps/state', async (request: FastifyRequest) => crapsService.getState(request.user.sub));

  function handleError(err: any, reply: FastifyReply) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation error', details: err.errors });
    }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    throw err;
  }

  // ─── Mines ─────────────────────────────────────────────────────
  app.post('/games/mines/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        bet: z.coerce.number().int().positive(),
        mineCount: z.coerce.number().int().min(1).max(24),
      });
      const body = schema.parse(request.body);
      const result = await minesService.startGame(request.user.sub, body.bet, body.mineCount, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'mines', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/mines/reveal', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        sessionId: z.string(),
        tileIndex: z.coerce.number().int().min(0).max(24),
      });
      const body = schema.parse(request.body);
      const result = await minesService.revealTile(request.user.sub, body.sessionId, body.tileIndex);
      await handleStateProgression(request.user.sub, 'mines', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/mines/cashout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string() });
      const body = schema.parse(request.body);
      const result = await minesService.cashOut(request.user.sub, body.sessionId);
      await handleStateProgression(request.user.sub, 'mines', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Crash ─────────────────────────────────────────────────────
  app.post('/games/crash/bet', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ bet: z.coerce.number().int().positive().safe(), autoCashout: z.coerce.number().min(1.01).max(1000000).optional() });
      const body = schema.parse(request.body);
      const result = await crashService.placeBet(request.user.sub, body.bet, body.autoCashout, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'crash', result.roundId, body.bet, 0);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/crash/cashout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await crashService.cashOut(request.user.sub);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.get('/games/crash/state', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = crashService.getCurrentState();
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Limbo ─────────────────────────────────────────────────────
  app.post('/games/limbo/play', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        bet: z.coerce.number().int().positive(),
        targetMultiplier: z.coerce.number().min(1.00).max(1000000),
      });
      const body = schema.parse(request.body);
      let performed = false;
      const result = await runFinancialOperation(app.prisma, request.user.sub, 'limbo_play', request.headers['idempotency-key'] as string | undefined, body,
        tx => { performed = true; return new LimboService(tx).play(request.user.sub, body.bet, body.targetMultiplier); });
      if (performed) await handleProgression(request.user.sub, 'limbo', result.payout || 0, body.bet);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Slots ─────────────────────────────────────────────────────
  app.post('/games/slots/spin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        variant: z.enum(['classic', 'fruit', 'diamond']),
        bet: z.coerce.number().int().positive(),
      });
      const body = schema.parse(request.body);
      let performed = false;
      const result = await runFinancialOperation(app.prisma, request.user.sub, 'slots_spin', request.headers['idempotency-key'] as string | undefined, body,
        tx => { performed = true; return new SlotsService(tx).spin(request.user.sub, body.variant, body.bet); });
      if (performed) await handleProgression(request.user.sub, `slots_${body.variant}`, result.totalWin, body.bet * ({ classic: 3, fruit: 5, diamond: 10 }[body.variant]));
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Roulette ──────────────────────────────────────────────────
  app.post('/games/roulette/spin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        bets: z.array(z.object({
          type: z.enum(['straight', 'split', 'street', 'corner', 'sixline', 'column', 'dozen', 'red', 'black', 'odd', 'even', 'low', 'high']),
          positions: z.array(z.coerce.number().int().min(0).max(36)),
          amount: z.coerce.number().int().positive(),
        })).min(1),
      });
      const body = schema.parse(request.body);
      let performed = false;
      const result = await runFinancialOperation(app.prisma, request.user.sub, 'roulette_spin', request.headers['idempotency-key'] as string | undefined, body,
        tx => { performed = true; return new RouletteService(tx).spin(request.user.sub, body.bets); });
      if (performed) await handleProgression(request.user.sub, 'roulette', result.totalWin, body.bets.reduce((s, b) => s + b.amount, 0));
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Blackjack ─────────────────────────────────────────────────
  app.post('/games/blackjack/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ bet: z.coerce.number().int().positive() });
      const body = schema.parse(request.body);
      const result = await blackjackService.startRound(request.user.sub, body.bet, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'blackjack', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/blackjack/hit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string(), handIndex: z.coerce.number().int().min(0) });
      const body = schema.parse(request.body);
      const result = await blackjackService.hit(request.user.sub, body.sessionId, body.handIndex);
      await handleStateProgression(request.user.sub, 'blackjack', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/blackjack/stand', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string(), handIndex: z.coerce.number().int().min(0) });
      const body = schema.parse(request.body);
      const result = await blackjackService.stand(request.user.sub, body.sessionId, body.handIndex);
      await handleStateProgression(request.user.sub, 'blackjack', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/blackjack/double', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string(), handIndex: z.coerce.number().int().min(0) });
      const body = schema.parse(request.body);
      const result = await blackjackService.doubleDown(request.user.sub, body.sessionId, body.handIndex, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'blackjack', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/blackjack/split', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string(), handIndex: z.coerce.number().int().min(0) });
      const body = schema.parse(request.body);
      const result = await blackjackService.split(request.user.sub, body.sessionId, body.handIndex, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'blackjack', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/blackjack/insurance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string(), amount: z.coerce.number().int().positive() });
      const body = schema.parse(request.body);
      const result = await blackjackService.insurance(request.user.sub, body.sessionId, body.amount, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'blackjack', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Video Poker ──────────────────────────────────────────────
  app.post('/games/videopoker/deal', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ bet: z.coerce.number().int().min(1).max(5) });
      const body = schema.parse(request.body);
      const result = await videoPokerService.deal(request.user.sub, body.bet, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'videopoker', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/videopoker/draw', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        sessionId: z.string(),
        held: z.array(z.boolean()).length(5),
      });
      const body = schema.parse(request.body);
      const result = await videoPokerService.draw(request.user.sub, body.sessionId, body.held);
      await handleStateProgression(request.user.sub, 'videopoker', result.sessionId, result.bet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Craps ─────────────────────────────────────────────────────
  app.post('/games/craps/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ bet: z.coerce.number().int().positive() });
      const body = schema.parse(request.body);
      const result = await crapsService.startRound(request.user.sub, body.bet, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'craps', result.sessionId, result.passBet + result.oddsBet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/craps/odds', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string(), oddsBet: z.coerce.number().int().positive() });
      const body = schema.parse(request.body);
      const result = await crapsService.addOdds(request.user.sub, body.sessionId, body.oddsBet, request.headers['idempotency-key'] as string | undefined);
      await handleStateProgression(request.user.sub, 'craps', result.sessionId, result.passBet + result.oddsBet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  app.post('/games/craps/roll', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ sessionId: z.string() });
      const body = schema.parse(request.body);
      const result = await crapsService.roll(request.user.sub, body.sessionId);
      await handleStateProgression(request.user.sub, 'craps', result.sessionId, result.passBet + result.oddsBet, result.payout);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Wheel ─────────────────────────────────────────────────────
  app.post('/games/wheel/spin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ bet: z.coerce.number().int().positive() });
      const body = schema.parse(request.body);
      let performed = false;
      const result = await runFinancialOperation(app.prisma, request.user.sub, 'wheel_spin', request.headers['idempotency-key'] as string | undefined, body,
        tx => { performed = true; return instantWager(tx, request.user.sub, 'wheel', body.bet,
          async () => wheelService.spin(request.user.sub, body.bet, await houseEdge(tx, 'wheel', 5)), r => r.payout, body.bet * 50); });
      if (performed) await handleProgression(request.user.sub, 'wheel', result.payout, body.bet);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Keno ──────────────────────────────────────────────────────
  app.post('/games/keno/play', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        bet: z.coerce.number().int().positive(),
        numbers: z.array(z.coerce.number().int().min(1).max(80)).min(1).max(10),
      });
      const body = schema.parse(request.body);
      let performed = false;
      const result = await runFinancialOperation(app.prisma, request.user.sub, 'keno_play', request.headers['idempotency-key'] as string | undefined, body,
        tx => { performed = true; return instantWager(tx, request.user.sub, 'keno', body.bet,
          () => kenoService.play(request.user.sub, body.bet, body.numbers), r => r.payout,
          body.bet * Math.max(...Object.values(KENO_PAYOUTS[body.numbers.length]))); });
      if (performed) await handleProgression(request.user.sub, 'keno', result.payout, body.bet);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Plinko ────────────────────────────────────────────────────
  app.post('/games/plinko/drop', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        bet: z.coerce.number().int().positive(),
        risk: z.enum(['low', 'medium', 'high']),
        rows: z.coerce.number().int().refine(v => [8, 12, 16].includes(v), { message: 'Rows must be 8, 12, or 16' }),
      });
      const body = schema.parse(request.body);
      let performed = false;
      const result = await runFinancialOperation(app.prisma, request.user.sub, 'plinko_drop', request.headers['idempotency-key'] as string | undefined, body,
        tx => { performed = true; return instantWager(tx, request.user.sub, 'plinko', body.bet,
          () => plinkoService.drop(request.user.sub, body.bet, body.risk, body.rows), r => r.payout,
          Math.ceil(body.bet * Math.max(...PLINKO_PAYOUTS[body.risk][body.rows]))); });
      if (performed) await handleProgression(request.user.sub, 'plinko', result.payout, body.bet);
      return result;
    } catch (err) { return handleError(err, reply); }
  });

  // ─── Game Stats ────────────────────────────────────────────────
  app.get('/games/:game/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { game } = request.params as { game: string };
      const result = await app.prisma.gameSession.groupBy({
        by: ['gameType'],
        where: { userId: request.user.sub, gameType: game, endedAt: { gt: new Date(0) } },
        _count: { id: true },
        _sum: { betAmount: true, winAmount: true },
      });
      const stats = result[0];
      return {
        game,
        playCount: stats?._count?.id || 0,
        totalBet: Number(stats?._sum?.betAmount || 0n),
        totalWin: Number(stats?._sum?.winAmount || 0n),
      };
    } catch (err) { return handleError(err, reply); }
  });
}
