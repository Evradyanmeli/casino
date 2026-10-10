import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { NotificationService } from '../../domain/notification/NotificationService.js';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().safe().min(0).optional(),
      });
      const query = schema.parse(request.query);
      const service = new NotificationService(app.prisma);
      return service.getNotifications(request.user.sub, query.limit ?? 20, query.offset ?? 0);
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

  app.get('/notifications/unread-count', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = new NotificationService(app.prisma);
      const count = await service.getUnreadCount(request.user.sub);
      return { count };
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/notifications/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const service = new NotificationService(app.prisma);
      await service.markAsRead(request.user.sub, id);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/notifications/read-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = new NotificationService(app.prisma);
      await service.markAllAsRead(request.user.sub);
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
}
