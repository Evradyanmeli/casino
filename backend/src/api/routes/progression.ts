import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BadgeService } from '../../domain/progression/BadgeService.js';
import { TaskService } from '../../domain/progression/TaskService.js';
import { LevelService } from '../../domain/progression/LevelService.js';
import { RaceService } from '../../domain/progression/RaceService.js';
import { NotificationService } from '../../domain/notification/NotificationService.js';
import { z } from 'zod';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function progressionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const notificationService = new NotificationService(app.prisma);
  const levelService = new LevelService(app.prisma, notificationService);
  const badgeService = new BadgeService(app.prisma, notificationService, levelService);
  const taskService = new TaskService(app.prisma, levelService);
  const raceService = new RaceService(app.prisma);

  app.get('/progression/badges', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return badgeService.getAllBadges();
  });

  app.get('/progression/badges/mine', async (request: FastifyRequest, _reply: FastifyReply) => {
    return badgeService.getUserBadges(request.user.sub);
  });

  app.get('/progression/tasks', async (request: FastifyRequest, _reply: FastifyReply) => {
    const [daily, weekly] = await Promise.all([
      taskService.getDailyTasks(request.user.sub),
      taskService.getWeeklyTasks(request.user.sub),
    ]);
    return { daily, weekly };
  });

  app.post<{ Params: { id: string } }>('/progression/tasks/:id/claim', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const result = await taskService.claimTask(request.user.sub, request.params.id, request.headers['idempotency-key'] as string | undefined);
      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/progression/level', async (request: FastifyRequest, _reply: FastifyReply) => {
    return levelService.getUserLevel(request.user.sub);
  });

  app.get('/progression/level/progress', async (request: FastifyRequest, _reply: FastifyReply) => {
    return levelService.getLevelProgress(request.user.sub);
  });

  app.get('/progression/race', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return raceService.getCurrentRace();
  });

  app.get('/progression/race/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
      const race = await raceService.getCurrentRace();
      if (!race) return [];
      return raceService.getLeaderboard(race.id, query.limit);
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/progression/race/my-rank', async (request: FastifyRequest, _reply: FastifyReply) => {
    const race = await raceService.getCurrentRace();
    if (!race) return { rank: 0, xp: 0, prize: 0 };
    return raceService.getUserRank(request.user.sub, race.id);
  });

  app.post('/progression/race/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({ raceId: z.string().min(1).optional() }).parse(request.body ?? {});
      if (!body.raceId) await raceService.getCurrentRace();
      const result = await raceService.claimPrize(request.user.sub, body.raceId, request.headers['idempotency-key'] as string | undefined);
      return { prize: result };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
