import { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';

type Row = Record<string, any>;
type State = Record<string, Row[]>;

// An isolated transactional double: no Prisma connection or shared database is opened.
export function testDatabase(initial: State = {}) {
  const models = ['user', 'transaction', 'gameSession', 'auditLog', 'systemSetting', 'gameConfig',
       'notification', 'chatMessage', 'task', 'userTask', 'badge', 'userBadge', 'race', 'raceEntry', 'responsibleLimit',
       'financialOperation', 'dailyReward'];
  let state: State = Object.fromEntries(models.map(model => [model, structuredClone(initial[model] ?? [])]));
  state.gameSession = state.gameSession.map(row => ({ endedAt: row.createdAt ?? new Date(), ...row }));
  let serial = 0;
  const relation = (model: string, row: Row, key: string) => {
    if (key === 'task') return state.task.find(t => t.id === row.taskId);
    if (key === 'race') return state.race.find(r => r.id === row.raceId);
    if (key === 'user') return state.user.find(u => u.id === row.userId);
    if (key === 'admin') return state.user.find(u => u.id === row.adminId);
    if (model === 'user' && key === 'transactions') return state.transaction.filter(t => t.userId === row.id);
    if (model === 'user' && key === 'gameSessions') return state.gameSession.filter(t => t.userId === row.id);
    return row[key];
  };
  const matches = (model: string, row: Row, where: Row = {}): boolean => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((w: Row) => matches(model, row, w));
    if (key === 'AND') return value.every((w: Row) => matches(model, row, w));
    if (key === 'NOT') return !(Array.isArray(value) ? value : [value]).some((w: Row) => matches(model, row, w));
    if (key.includes('_') && typeof value === 'object' && !(key in row)) return matches(model, row, value);
    const actual = relation(model, row, key);
    if (value instanceof Date) return actual?.getTime() === value.getTime();
    if (value === null) return actual == null;
    if (typeof value !== 'object') return actual === value;
    if ('path' in value) return value.path.reduce((v: any, part: string) => v?.[part], actual) === value.equals;
    return Object.entries(value).every(([op, expected]: [string, any]) => {
      if (op === 'gte') return actual != null && actual >= expected;
      if (op === 'gt') return actual != null && actual > (expected?._field ? row[expected._field] : expected);
      if (op === 'lte') return actual != null && actual <= expected;
      if (op === 'lt') return actual != null && actual < expected;
      if (op === 'not') return actual !== expected;
      if (op === 'in') return expected.includes(actual);
      if (op === 'notIn') return !expected.includes(actual);
      if (op === 'contains') return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      if (op === 'mode') return true;
      return actual && matches(key, actual, { [op]: expected });
    });
  });
  const project = (model: string, row: Row, args: Row = {}) => {
    const result: Row = args.select ? {} : structuredClone(row);
    for (const [key, selection] of Object.entries(args.select ?? args.include ?? {})) {
      if (!selection) continue;
      const value = relation(model, row, key);
      if (Array.isArray(value)) result[key] = value.map(v => project(key, v, selection === true ? {} : selection as Row));
      else if (value && typeof selection === 'object') result[key] = project(key, value, selection as Row);
      else result[key] = structuredClone(value);
    }
    return result;
  };
  const apply = (row: Row, data: Row) => {
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && ('increment' in val || 'decrement' in val)) {
        const delta = val.increment ?? -val.decrement;
        row[key] += typeof row[key] === 'bigint' ? BigInt(delta) : delta;
      } else row[key] = structuredClone(val);
    }
  };
  const client: Record<string, any> = {};
  for (const model of models) {
    const findRows = (args: Row = {}) => {
      let rows = state[model].filter(row => matches(model, row, args.where));
      const sorts = args.orderBy ? Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy] : [];
      rows = [...rows].sort((a, b) => {
        for (const sort of sorts) {
          const [key, order] = Object.entries(sort)[0];
          if (a[key] === b[key]) continue;
          return (a[key] < b[key] ? -1 : 1) * (order === 'desc' ? -1 : 1);
        }
        return 0;
      });
      return rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
    };
    const find = (args: Row) => {
      const row = findRows(args)[0];
      return row ? project(model, row, args) : null;
    };
    const update = (args: Row) => {
      const row = state[model].find(r => matches(model, r, args.where));
      if (!row) throw new Error('Missing row');
      apply(row, args.data);
      return project(model, row, args);
    };
    const create = (args: Row) => {
      const row: Row = { id: `${model}-${++serial}`, createdAt: new Date(), endedAt: new Date(), ...structuredClone(args.data) };
      if (model === 'userTask') Object.assign(row, { progress: 0, completed: false, claimed: false, completedAt: null }, args.data);
      if (model === 'raceEntry') Object.assign(row, { xp: 0, rank: null, prize: 0, claimed: false }, args.data);
      if (model === 'financialOperation') Object.assign(row, { result: null }, args.data);
      state[model].push(row);
      return project(model, row, args);
    };
    client[model] = {
      fields: { betAmount: { _field: 'betAmount' } },
      findUnique: vi.fn(async args => find(args)),
      findUniqueOrThrow: vi.fn(async args => { const row = find(args); if (!row) throw new Error('Missing row'); return row; }),
      findFirst: vi.fn(async args => find(args)),
      findMany: vi.fn(async (args = {}) => findRows(args).map(row => project(model, row, args))),
      count: vi.fn(async (args = {}) => findRows(args).length),
      create: vi.fn(async args => create(args)),
      createMany: vi.fn(async args => {
        let count = 0;
        for (const data of Array.isArray(args.data) ? args.data : [args.data]) {
          if (args.skipDuplicates && state[model].some(row => row.userId === data.userId && row.badgeId === data.badgeId)) continue;
          create({ data }); count++;
        }
        return { count };
      }),
      update: vi.fn(async args => update(args)),
      updateMany: vi.fn(async args => {
        const rows = state[model].filter(row => matches(model, row, args.where));
        rows.forEach(row => apply(row, args.data));
        return { count: rows.length };
      }),
      upsert: vi.fn(async args => state[model].some(row => matches(model, row, args.where))
        ? update({ ...args, data: args.update }) : create({ ...args, data: args.create })),
      delete: vi.fn(async args => {
        const index = state[model].findIndex(row => matches(model, row, args.where));
        if (index < 0) throw new Error('Missing row');
        return state[model].splice(index, 1)[0];
      }),
      deleteMany: vi.fn(async args => {
        const rows = state[model].filter(row => !matches(model, row, args.where));
        const count = state[model].length - rows.length;
        state[model] = rows;
        return { count };
      }),
      aggregate: vi.fn(async (args = {}) => {
        const rows = findRows(args);
        const result: Row = {};
        if (args._count) result._count = rows.length;
        if (args._sum) result._sum = Object.fromEntries(Object.keys(args._sum).map(key => [key,
          rows.length ? rows.reduce((sum, row) => sum + row[key], typeof rows[0][key] === 'bigint' ? 0n : 0) : null]));
        if (args._max) result._max = Object.fromEntries(Object.keys(args._max).map(key => [key,
          rows.length ? rows.reduce((max, row) => row[key] > max ? row[key] : max, rows[0][key]) : null]));
        return result;
      }),
      groupBy: vi.fn(async () => []),
    };
  }
  let pending = Promise.resolve();
  const db: Record<string, any> = { ...client, $transaction: vi.fn((work: (tx: any) => Promise<any>) => {
    const run = pending.then(async () => {
      const before = structuredClone(state);
      try { return await work(client); } catch (err) { state = before; throw err; }
    });
    pending = run.then(() => undefined, () => undefined);
    return run;
  }) };
  return { db: db as unknown as PrismaClient, mocks: db, get state() { return state; } };
}

export const admin = { id: 'admin-actor', role: 'ADMIN', status: 'ACTIVE', balance: 5000n, xp: 0, level: 1 };
export const player = { id: 'player', role: 'USER', status: 'ACTIVE', balance: 1000n, xp: 0, level: 1 };
