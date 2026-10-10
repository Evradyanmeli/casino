import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../../domain/user/UserService.js';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function userRoutes(app: FastifyInstance) {
  const userService = new UserService(app.prisma);

  app.addHook('onRequest', app.authenticate);

  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const profile = await userService.getProfile(request.user.sub);
      reply.send(profile);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.put('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        pseudo: z.string().min(3).max(20).optional(),
        avatar: z.string().url().optional(),
        customAvatar: z.string().optional(),
      });

      const data = schema.parse(request.body);
      const result = await userService.updateProfile(request.user.sub, data);
      reply.send(result);
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

  app.get('/me/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await userService.getStats(request.user.sub);
      reply.send(stats);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/me/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        type: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().safe().min(0).optional(),
      });

      const query = schema.parse(request.query);
      const result = await userService.getTransactions(request.user.sub, query);
      reply.send(result);
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
}
