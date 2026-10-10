import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../auth/AuthService.js';

export class NotificationService {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async getNotifications(userId: string, limit = 20, offset = 0) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0)
      throw new AppError('Pagination invalide', 400);
    const [notifications, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.getUnreadCount(userId),
    ]);
    const parsed = notifications.map(n => {
      try {
        const { title, message } = JSON.parse(n.content);
        return { ...n, title, message };
      } catch {
        return { ...n, title: n.content, message: '' };
      }
    });
    return { notifications: parsed, total, unread };
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    if (!result.count) throw new AppError('Notification introuvable', 404);
    return result;
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async createNotification(userId: string, type: string, content: string) {
    return this.prisma.notification.create({
      data: { userId, type, content },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }
}
