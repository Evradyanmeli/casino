import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AdminService } from '../../domain/admin/AdminService.js';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return reply.status(403).send({ error: 'Accès réservé aux administrateurs' });
    }
  });

  const adminService = new AdminService(app.prisma);

  app.get('/admin/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = z.object({ period: z.enum(['24h', '7d', '30d']).default('24h') }).parse(request.query);
      const stats = await adminService.getDashboardStats(query.period);
      return stats;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/users', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        page: z.coerce.number().int().safe().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      });
      const query = schema.parse(request.query);
      const result = await adminService.getUsers(query.page, query.limit, query.search);
      return result;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await adminService.getUserDetails(id);
      return user;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/admin/users/:id/ban', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await adminService.toggleUserBan(id, request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/admin/users/:id/adjust-balance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const schema = z.object({
        amount: z.number().int().safe().refine(n => n !== 0),
        reason: z.string().trim().min(1).max(1000),
      });
      const body = schema.parse(request.body);
      await adminService.adjustUserBalance(id, body.amount, body.reason, request.user.sub,
        request.headers['idempotency-key'] as string | undefined);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/games/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ game: z.string().optional() });
      const query = schema.parse(request.query);
      const stats = await adminService.getGameStats(query.game);
      return stats;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/games/recent', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const games = await adminService.getRecentGames();
      return games;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/settings', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await adminService.getSettings();
      return settings;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put('/admin/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const setting = z.object({ key: z.string().trim().min(1).max(100), value: z.any().refine(v => v !== undefined && v !== null) });
      const schema = z.union([setting, z.object({ settings: z.array(setting).min(1).max(100) })]);
      const body = schema.parse(request.body);
      const settings = 'settings' in body ? body.settings : [body];
      await adminService.updateSettings(settings.map(s => ({ key: s.key, value: s.value })), request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.delete('/admin/settings/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      await adminService.deleteSetting(key, request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/economy/house-balance', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await adminService.getHouseBalance();
      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/admin/economy/house-recharge', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ amount: z.number().int().safe().positive() });
      const body = schema.parse(request.body);
      await adminService.rechargeHouse(body.amount, request.user.sub, request.headers['idempotency-key'] as string | undefined);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/games/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configs = await adminService.getGameConfigs();
      return configs;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put('/admin/games/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        gameType: z.string(),
        houseEdge: z.number().min(0).max(100).optional(),
        minBet: z.number().int().safe().positive().optional(),
        maxBet: z.number().int().safe().positive().optional(),
        active: z.boolean().optional(),
      });
      const body = schema.parse(request.body);
      const result = await adminService.updateGameConfig(body.gameType, body, request.user.sub);
      return result;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/chat/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ room: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() });
      const query = schema.parse(request.query);
      const messages = await adminService.getChatMessages(query.room, query.limit ?? 50);
      return messages;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.delete('/admin/chat/messages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await adminService.deleteChatMessage(id, request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/admin/chat/ban/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.params as { userId: string };
      await adminService.banUserFromChat(userId, request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/admin/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({ title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(10000), type: z.string().trim().min(1).max(50).optional() });
      const body = schema.parse(request.body);
      await adminService.createAnnouncement(body.title, body.content, body.type, request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/admin/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        adminId: z.string().optional(),
        action: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        offset: z.coerce.number().int().safe().min(0).optional(),
      });
      const query = schema.parse(request.query);
      const result = await adminService.getAuditLogs(query);
      return result;
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.errors });
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
