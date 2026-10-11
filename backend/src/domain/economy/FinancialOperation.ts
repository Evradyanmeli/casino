import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AppError } from '../auth/AuthService.js';

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}

export async function runFinancialOperation<T>(db: PrismaClient, actorId: string, scope: string, key: string | undefined,
  payload: unknown, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (key === undefined) return db.$transaction(work);
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new AppError('Invalid idempotency key', 400);
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
  return db.$transaction(async tx => {
    // The unique operation row serializes replays, including requests on different instances.
    const operation = await tx.financialOperation.upsert({ where: { actorId_scope_key: { actorId, scope, key } },
      create: { actorId, scope, key, fingerprint }, update: { updatedAt: new Date() } });
    if (operation.fingerprint !== fingerprint) throw new AppError('Idempotency key already used for a different operation', 409);
    if (operation.result !== null) return operation.result as T;
    const result = await work(tx);
    const json = JSON.parse(JSON.stringify(result));
    if (json === null || json === undefined) throw new AppError('Financial operation must return a JSON result', 500);
    // Return the database representation, including its JSON numeric precision, on every attempt.
    const saved = await tx.financialOperation.update({ where: { id: operation.id }, data: { result: json } });
    return saved.result as T;
  });
}
