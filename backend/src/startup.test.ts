import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Private configuration guards', () => {
  it.each([
    { JWT_SECRET: '', COOKIE_SECRET: 'c'.repeat(64) },
    { JWT_SECRET: 'j'.repeat(64), COOKIE_SECRET: '' },
    { JWT_SECRET: 'short', COOKIE_SECRET: 'short' },
  ])('rejects missing or weak application secrets before connecting to the database', (secrets) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/app.ts'], {
      env: { ...process.env, DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/invalid', ...secrets },
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Set JWT_SECRET and COOKIE_SECRET');
  });

  it.each([
    { NODE_ENV: 'production', message: 'Demo seed is disabled in production.' },
    { NODE_ENV: 'development', message: 'Set SEED_ADMIN_PASSWORD and SEED_PLAYER_PASSWORD' },
  ])('rejects unsafe demo seeding before writing to the database', ({ NODE_ENV, message }) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/seed.ts'], {
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/invalid',
        NODE_ENV,
        SEED_ADMIN_PASSWORD: '',
        SEED_PLAYER_PASSWORD: '',
      },
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });
});
