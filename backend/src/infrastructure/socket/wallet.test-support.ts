import type { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import { SerialQueue } from './SerialQueue.js';

// In-memory transaction double, including rollback; never instantiates Prisma.
export function walletFixture() {
  const users = new Map<string, any>(['a', 'b', 'c', 'd'].map(id => [id, { id, pseudo: id.toUpperCase(), status: 'ACTIVE', role: 'USER', balance: 1000n }]));
  users.set('house', { id: 'house', pseudo: 'House', email: 'admin@casino.com', role: 'ADMIN', status: 'ACTIVE', balance: 6000n });
  const journal: any[] = [];
  const sessions: any[] = [];
  const limits = new Map<string, any>();
  const tx: any = {
    user: {
      findFirst: vi.fn(async ({ where }: any) => [...users.values()].find(user => Object.entries(where).every(([key, value]) => user[key] === value)) ?? null),
      findUnique: vi.fn(async ({ where }: any) => {
        const user = users.get(where.id);
        return user ? { ...user } : null;
      }),
      findMany: vi.fn(async () => [...users.values()].map(user => ({ ...user }))),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user || user.balance < (where.balance?.gte ?? 0n) || user.balance > (where.balance?.lte ?? BigInt(Number.MAX_SAFE_INTEGER))) return { count: 0 };
        user.balance += data.balance.increment ?? -(data.balance.decrement ?? 0n);
        return { count: 1 };
      }),
    },
    transaction: {
      create: vi.fn(async ({ data }: any) => { journal.push(data); return data; }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rows = journal.filter(row => where.AND.every((condition: any) =>
          row.metadata?.[condition.metadata.path[0]] === condition.metadata.equals));
        rows.forEach(row => Object.assign(row, structuredClone(data)));
        return { count: rows.length };
      }),
    },
    gameSession: { create: vi.fn(async ({ data }: any) => { sessions.push(data); return data; }) },
    responsibleLimit: { findUnique: vi.fn(async ({ where }: any) => limits.get(where.userId) ?? null) },
    gameConfig: { findUnique: vi.fn(async () => null) },
    chatMessage: {
      create: vi.fn(async ({ data }: any) => ({ ...data, id: 'message-1', createdAt: new Date('2026-10-08T12:00:00Z') })),
      findMany: vi.fn(async () => []),
    },
  };
  const queue = new SerialQueue();
  const db = {
    ...tx,
    $transaction: vi.fn(async (work: (client: any) => Promise<any>) => queue.run('db', async () => {
      const before = structuredClone(users);
      const journalCount = journal.length;
      const journalBefore = structuredClone(journal);
      const sessionCount = sessions.length;
      try {
        return await work(tx);
      } catch (error) {
        users.clear();
        for (const [id, user] of before) users.set(id, user);
        journal.splice(0, journal.length, ...journalBefore);
        sessions.length = sessionCount;
        throw error;
      }
    })),
  } as unknown as PrismaClient;
  return { db, tx, users, limits, journal, sessions };
}
