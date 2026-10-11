import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService, AppError } from '../../domain/auth/AuthService.js';
import { TaskService } from '../../domain/progression/TaskService.js';

export default async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService();

  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        pseudo: z.string().min(3).max(20),
        password: z.string().min(8),
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, { message: 'Invalid date format (use YYYY-MM-DD)' }),
      });

      const data = schema.parse(request.body);
      const user = await authService.register(data.email, data.pseudo, data.password, data.birthDate);
      await app.prisma.systemSetting.upsert({ where: { key: `session_started:${user.id}` }, create: { key: `session_started:${user.id}`, value: Date.now() }, update: { value: Date.now() } });
      await new TaskService(app.prisma).incrementProgress(user.id, 'login').catch(err => app.log.error(err));

      const accessToken = app.jwt.sign({ sub: user.id, role: user.role, type: 'access' }, { expiresIn: '15m' });
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          pseudo: user.pseudo,
          role: user.role,
          balance: user.balance.toString(),
        },
        accessToken,
        refreshToken,
      });
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

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      });

      const data = schema.parse(request.body);
      const user = await authService.login(data.email, data.password);
      await app.prisma.systemSetting.upsert({ where: { key: `session_started:${user.id}` }, create: { key: `session_started:${user.id}`, value: Date.now() }, update: { value: Date.now() } });
      await new TaskService(app.prisma).incrementProgress(user.id, 'login').catch(err => app.log.error(err));

      const accessToken = app.jwt.sign({ sub: user.id, role: user.role, type: 'access' }, { expiresIn: '15m' });
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          pseudo: user.pseudo,
          role: user.role,
          balance: user.balance.toString(),
        },
        accessToken,
        refreshToken,
      });
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

  app.post('/google', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(503).send({ error: 'Google authentication is not configured' });
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        refreshToken: z.string().min(1),
      });

      const data = schema.parse(request.body);
      const payload = app.jwt.verify<{ sub: string; type: string }>(data.refreshToken);

      if (payload.type !== 'refresh') {
        return reply.status(401).send({ error: 'Invalid refresh token' });
      }

      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 'ACTIVE') {
        return reply.status(401).send({ error: 'User not found or inactive' });
      }

      const accessToken = app.jwt.sign({ sub: user.id, role: user.role, type: 'access' }, { expiresIn: '15m' });
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      reply.send({ accessToken, refreshToken });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });

      schema.parse(request.body);
      return reply.status(503).send({ error: 'Password reset email delivery is not configured' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: err.errors });
      }
      throw err;
    }
  });
}
