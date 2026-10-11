import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { EconomyService } from '../../domain/economy/EconomyService.js';
import { DailyRewardService } from '../../domain/economy/DailyRewardService.js';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function economyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = new EconomyService(app.prisma);
      const balance = await service.getBalance(request.user.sub);
      return { balance: Number(balance) };
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/daily-reward', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = new DailyRewardService(app.prisma);
      const result = await service.claimDailyReward(request.user.sub, request.headers['idempotency-key'] as string | undefined);
      return result;
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        filter: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().safe().min(0).optional(),
      });
      const query = schema.parse(request.query);
      const service = new EconomyService(app.prisma);
      const transactions = await service.getTransactions(request.user.sub, query.filter, query.limit ?? 20, query.offset ?? 0);
      return { transactions: transactions.map(t => ({ ...t, amount: Number(t.amount) })) };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: err.errors });
      }
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/daily-info', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = new DailyRewardService(app.prisma);
      const info = await service.getDailyReward(request.user.sub);
      return info;
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
}
