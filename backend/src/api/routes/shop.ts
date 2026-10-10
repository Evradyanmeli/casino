import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ShopService } from '../../domain/shop/ShopService.js';
import { AppError } from '../../domain/auth/AuthService.js';

export default async function shopRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const shopService = new ShopService(app.prisma);

  app.get('/shop/packages', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const packages = shopService.getPackages();
      return packages;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/shop/purchase/:packageId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { packageId } = request.params as { packageId: string };
      const result = await shopService.purchasePackage(request.user.sub, packageId);
      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
