import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ResponsibleGamingService } from '../../domain/rg/ResponsibleGamingService.js';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function responsibleGamingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const rg = new ResponsibleGamingService(app.prisma);

  app.get('/responsible-gaming/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await rg.getSettings(request.user.sub);
      return settings;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put('/responsible-gaming/deposit-limit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        daily: z.number().int().safe().positive().nullable().optional(),
        weekly: z.number().int().safe().positive().nullable().optional(),
        monthly: z.number().int().safe().positive().nullable().optional(),
        enabled: z.boolean().optional(),
      });
      const body = schema.parse(request.body);
      await rg.updateDepositLimit(request.user.sub, body.daily, body.weekly, body.monthly, body.enabled);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put('/responsible-gaming/loss-limit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        daily: z.number().int().safe().positive().nullable().optional(),
        weekly: z.number().int().safe().positive().nullable().optional(),
        monthly: z.number().int().safe().positive().nullable().optional(),
        enabled: z.boolean().optional(),
      });
      const body = schema.parse(request.body);
      await rg.updateLossLimit(request.user.sub, body.daily, body.weekly, body.monthly, body.enabled);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put('/responsible-gaming/session-limit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        minutes: z.number().int().safe().positive().max(2147483647).nullable().optional(),
        enabled: z.boolean().optional(),
      });
      const body = schema.parse(request.body);
      await rg.updateSessionLimit(request.user.sub, body.minutes, body.enabled);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/responsible-gaming/self-exclude', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ days: z.number().int().safe().positive().max(36500) });
      const body = schema.parse(request.body);
      await rg.setSelfExclusion(request.user.sub, body.days);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/responsible-gaming/cancel-self-exclude', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await rg.cancelSelfExclusion(request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put('/responsible-gaming/reality-check', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        intervalMinutes: z.number().int().safe().positive().max(2147483647).nullable().optional(),
        enabled: z.boolean().optional(),
      });
      const body = schema.parse(request.body);
      await rg.enableRealityCheck(request.user.sub, body.intervalMinutes, body.enabled);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
