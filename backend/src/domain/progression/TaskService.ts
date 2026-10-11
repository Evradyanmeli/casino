import { PrismaClient, UserTask } from '@prisma/client';
import { LevelService } from './LevelService.js';
import { EconomyService } from '../economy/EconomyService.js';
import { AppError } from '../auth/AuthService.js';
import { runFinancialOperation } from '../economy/FinancialOperation.js';

export class TaskService {
  constructor(private prisma: PrismaClient, private levelService?: LevelService) {}

  async getDailyTasks(userId: string): Promise<(UserTask & { task: any })[]> {
    await this.ensureTasksExist(userId, 'daily');
    return this.prisma.userTask.findMany({ where: { userId, task: { type: 'daily' } }, include: { task: true } });
  }

  async getWeeklyTasks(userId: string): Promise<(UserTask & { task: any })[]> {
    await this.ensureTasksExist(userId, 'weekly');
    return this.prisma.userTask.findMany({ where: { userId, task: { type: 'weekly' } }, include: { task: true } });
  }

  async claimTask(userId: string, userTaskId: string, key?: string): Promise<{ xp: number; coins: number; leveledUp: boolean; newLevel: number }> {
    return runFinancialOperation(this.prisma, userId, 'task_reward', key, { userTaskId }, async tx => {
      const ut = await tx.userTask.findUnique({ where: { id: userTaskId }, include: { task: true } });
      if (!ut || ut.userId !== userId) throw new AppError('Task not found', 404);
      const now = new Date();
      const claimed = await tx.userTask.updateMany({ where: { id: userTaskId, userId, completed: true, claimed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, data: { claimed: true } });
      if (!claimed.count) throw new AppError('Task incomplete, expired or already claimed', 400);
      const reward = ut.task.reward as { xp: number; coins: number };
      if (!Number.isSafeInteger(reward.xp) || reward.xp < 0 || reward.xp > 2147483647 ||
        !Number.isSafeInteger(reward.coins) || reward.coins < 0) throw new AppError('Invalid task reward', 400);
      const level = await new LevelService(tx).addXp(userId, reward.xp);
      if (reward.coins > 0) await new EconomyService(tx).addBalance(userId, BigInt(reward.coins), 'task_reward', ut.id, ut.task.title);
      return { xp: reward.xp, coins: reward.coins, leveledUp: level.leveledUp, newLevel: level.newLevel };
    });
  }

  async incrementProgress(userId: string, action: string, game?: string, count: number = 1): Promise<void> {
    if (!Number.isSafeInteger(count) || count < 0) throw new AppError('Invalid task progress', 400);
    // The persisted daily template uses daily_login; auth publishes login.
    const event = action === 'login' ? 'daily_login' : action === 'bet' ? 'bet_amount' : action === 'win' ? 'win_amount' : action;
    await this.ensureTasksExist(userId, 'daily');
    await this.ensureTasksExist(userId, 'weekly');
    const now = new Date();
    const tasks = await this.prisma.userTask.findMany({ where: { userId, completed: false, claimed: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, include: { task: true } });
    for (const task of tasks) {
      const cond = task.task.condition as { action: string; game?: string; count: number };
      const normalizedGame = game?.startsWith('slots_') ? 'slots' : game;
      if (cond.action !== event || (cond.game && cond.game !== normalizedGame)) continue;
      if (!Number.isSafeInteger(cond.count) || cond.count < 1 || cond.count > 2147483647) throw new AppError('Invalid task target', 400);
      // Compare-and-set prevents concurrent games from overwriting each other's progress.
      let current: UserTask | null = task;
      while (current && !current.completed && !current.claimed) {
        const progress = event === 'win_streak' && count === 0 ? 0
          : current.progress + Math.min(count, Math.max(0, cond.count - current.progress));
        const completed = progress >= cond.count;
        const changed = await this.prisma.userTask.updateMany({ where: { id: current.id, progress: current.progress,
          completed: false, claimed: false, expiresAt: current.expiresAt,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          data: { progress, completed, completedAt: completed ? new Date() : null } });
        if (changed.count) break;
        current = await this.prisma.userTask.findUnique({ where: { id: current.id } });
        if (current?.expiresAt && current.expiresAt <= new Date()) break;
      }
    }
  }

  private async ensureTasksExist(userId: string, type: 'daily' | 'weekly'): Promise<void> {
    const templates = await this.prisma.task.findMany({ where: { type } });
    const now = new Date();
    for (const t of templates) {
      const hours = t.expiresIn && t.expiresIn > 0 ? t.expiresIn : type === 'daily' ? 24 : 168;
      const expiresAt = new Date(now.getTime() + hours * 3600000);
      await this.prisma.userTask.upsert({ where: { userId_taskId: { userId, taskId: t.id } },
        create: { userId, taskId: t.id, expiresAt }, update: {} });
      await this.prisma.userTask.updateMany({ where: { userId, taskId: t.id, expiresAt: { lte: now } },
        data: { progress: 0, completed: false, claimed: false, completedAt: null, expiresAt } });
    }
  }
}
