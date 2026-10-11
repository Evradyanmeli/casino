import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { AuthService } from './AuthService.js';
import authRoutes from '../../api/routes/auth.js';
import { testDatabase } from '../admin/testSupport.js';

const dependency = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../infrastructure/database/prisma.js', () => ({ get prisma() { return dependency.db; } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'test-hash'), compare: vi.fn(async () => true) } }));
afterEach(() => { vi.clearAllMocks(); });

describe('AuthService issuance policy', () => {
  it('creates the email welcome credit and its explicit journal in one transaction', async () => {
    const ctx = testDatabase({ systemSetting: [{ key: 'welcome_bonus', value: 1234 }] });
    dependency.db = ctx.db;
    const user = await new AuthService().register('player@example.test', 'Player', 'password', '1990-01-01');
    expect(user.balance).toBe(1234n);
    expect(ctx.state.transaction[0]).toMatchObject({ userId: user.id, type: 'welcome_bonus', amount: 1234n });
    expect(ctx.mocks.$transaction).toHaveBeenCalledOnce();
    ctx.mocks.transaction.create.mockRejectedValueOnce(new Error('journal failed'));
    await expect(new AuthService().register('another@example.test', 'Another', 'password', '1990-01-01')).rejects.toThrow('journal failed');
    expect(ctx.state.user).toHaveLength(1);
    expect(ctx.state.transaction).toHaveLength(1);
  });

  it('supports zero welcome bonus without fabricating a transaction', async () => {
    const ctx = testDatabase({ systemSetting: [{ key: 'welcome_bonus', value: 0 }] });
    dependency.db = ctx.db;
    expect((await new AuthService().register('player@example.test', 'Player', 'password', '1990-01-01')).balance).toBe(0n);
    expect(ctx.state.transaction).toEqual([]);
  });

  it('refuses client-supplied Google identity even for a matching existing email', async () => {
    const ctx = testDatabase({ user: [{ id: 'victim', email: 'victim@example.test', googleId: null }] });
    dependency.db = ctx.db;
    await expect(new AuthService().loginWithGoogle('unverified', 'victim@example.test', 'Attacker')).rejects.toMatchObject({ statusCode: 503 });
    expect(ctx.mocks.user.findFirst).not.toHaveBeenCalled();
    expect(ctx.mocks.user.create).not.toHaveBeenCalled();
    expect(ctx.mocks.user.update).not.toHaveBeenCalled();
    expect(ctx.state.transaction).toEqual([]);
  });
});

describe('Auth HTTP financial access boundary', () => {
  it('returns honest 503 responses without identity writes, account lookup or reset secrets', async () => {
    const ctx = testDatabase({ user: [{ id: 'victim', email: 'victim@example.test' }] });
    dependency.db = ctx.db;
    const app = Fastify();
    app.decorate('prisma', ctx.db);
    await app.register(jwt, { secret: 'isolated-test-signing-key-not-used-by-any-server' });
    await app.register(authRoutes);
    const sign = vi.spyOn(app.jwt, 'sign');
    try {
      for (const email of ['victim@example.test', 'absent@example.test']) {
        const response = await app.inject({ method: 'POST', url: '/reset-password', payload: { email } });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({ error: 'Password reset email delivery is not configured' });
      }
      for (const payload of [{ googleId: 'spoofed', email: 'victim@example.test', pseudo: 'Attacker' }, {}]) {
        expect((await app.inject({ method: 'POST', url: '/google', payload })).statusCode).toBe(503);
      }
      expect(sign).not.toHaveBeenCalled();
      expect(ctx.mocks.user.findUnique).not.toHaveBeenCalled();
      expect(ctx.mocks.user.create).not.toHaveBeenCalled();
      expect(ctx.mocks.user.update).not.toHaveBeenCalled();
      expect(ctx.state.transaction).toEqual([]);
    } finally { await app.close(); }
  });

  it('signs distinct explicit access and refresh types on login, registration and refresh', async () => {
    const ctx = testDatabase({ user: [{ id: 'existing', email: 'existing@example.test', pseudo: 'Existing',
      role: 'USER', status: 'ACTIVE', balance: 1000n, passwordHash: 'test-hash' }] });
    dependency.db = ctx.db;
    const app = Fastify();
    app.decorate('prisma', ctx.db);
    await app.register(jwt, { secret: 'isolated-test-signing-key-not-used-by-any-server' });
    await app.register(authRoutes);
    try {
      const login = await app.inject({ method: 'POST', url: '/login', payload: { email: 'existing@example.test', password: 'password' } });
      expect(login.statusCode).toBe(200);
      const registration = await app.inject({ method: 'POST', url: '/register', payload: {
        email: 'new@example.test', pseudo: 'NewPlayer', password: 'password', birthDate: '1990-01-01',
      } });
      expect(registration.statusCode).toBe(201);
      const refreshed = await app.inject({ method: 'POST', url: '/refresh', payload: { refreshToken: login.json().refreshToken } });
      expect(refreshed.statusCode).toBe(200);
      for (const response of [login, registration, refreshed]) {
        const access = app.jwt.verify<any>(response.json().accessToken);
        const refresh = app.jwt.verify<any>(response.json().refreshToken);
        expect(access.type).toBe('access');
        expect(access.exp - access.iat).toBe(15 * 60);
        expect(refresh.type).toBe('refresh');
        expect(refresh.role).toBeUndefined();
        expect(refresh.exp - refresh.iat).toBe(7 * 86400);
      }
      expect((await app.inject({ method: 'POST', url: '/refresh', payload: { refreshToken: login.json().accessToken } })).statusCode).toBe(401);
    } finally { await app.close(); }
  });
});
