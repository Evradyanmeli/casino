import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default fp(async function authMiddleware(app: FastifyInstance) {
  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
      const payload = request.user as { sub?: string; type?: string; role?: string };
      if (payload.type !== 'access' && !(payload.type === undefined && ['USER', 'ADMIN'].includes(payload.role ?? ''))) {
        throw new Error('Access token required');
      }
    } catch {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });
});
