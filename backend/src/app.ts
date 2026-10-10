import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { prisma } from './infrastructure/database/prisma.js';
import authMiddleware from './api/middleware/auth.js';
import { recoverInterruptedFunds } from './domain/games/Escrow.js';

const jwtSecret = process.env.JWT_SECRET;
const cookieSecret = process.env.COOKIE_SECRET;
if (!jwtSecret || !cookieSecret || jwtSecret.length < 32 || cookieSecret.length < 32) {
  throw new Error('Set JWT_SECRET and COOKIE_SECRET to independent random values of at least 32 characters.');
}

const app = Fastify({ logger: true });

app.decorate('prisma', prisma);

await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true });
await app.register(jwt, { secret: jwtSecret });
await app.register(cookie, { secret: cookieSecret });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(helmet, { contentSecurityPolicy: false });

await app.register(authMiddleware);
app.log.info(await recoverInterruptedFunds(prisma), 'Interrupted wagers recovered');

app.register(import('./api/routes/auth.js'), { prefix: '/api/v1/auth' });
app.register(import('./api/routes/user.js'), { prefix: '/api/v1/users' });
app.register(import('./api/routes/economy.js'), { prefix: '/api/v1/economy' });
app.register(import('./api/routes/notifications.js'), { prefix: '/api/v1' });
app.register(import('./api/routes/games.js'), { prefix: '/api/v1' });
app.register(import('./api/routes/progression.js'), { prefix: '/api/v1' });
app.register(import('./api/routes/admin.js'), { prefix: '/api/v1' });
app.register(import('./api/routes/shop.js'), { prefix: '/api/v1' });
app.register(import('./api/routes/rg.js'), { prefix: '/api/v1' });

app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

await app.register(import('./infrastructure/socket/socket.js'));

const port = parseInt(process.env.PORT || '3000');
try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app, prisma };
