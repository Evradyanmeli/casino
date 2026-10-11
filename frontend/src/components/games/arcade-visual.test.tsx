import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MinesGame from './MinesGame';
import CrashGame from './CrashGame';
import LimboGame from './LimboGame';
import PlinkoGame, { plinkoBallPosition } from './PlinkoGame';
import { PLINKO_MULTIPLIERS } from './gameMath';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/store/balanceStore', () => ({
  useBalanceStore: () => ({ balance: 1000, syncBalance: vi.fn() }),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: 'me' } }),
}));
vi.mock('@/services/games', () => ({
  GAME_BALANCE_ERROR: 'game-balance-error',
  minesApi: {
    getState: vi.fn(),
    start: vi.fn(),
    reveal: vi.fn(),
    cashOut: vi.fn(),
  },
  crashApi: { getState: vi.fn(), placeBet: vi.fn(), cashOut: vi.fn() },
  limboApi: { play: vi.fn() },
  gamesApi: { plinko: { drop: vi.fn() } },
}));

describe('Server-path Plinko geometry', () => {
  for (const risk of ['low', 'medium', 'high']) {
    for (const rows of [8, 12, 16]) {
      it(`${risk}/${rows} lands at every authoritative bucket, including both edges`, () => {
        for (let slot = 0; slot <= rows; slot++) {
          // Exercise both early and late right turns for the same final slot.
          for (const path of [
            Array.from({ length: rows }, (_, i) => (i < slot ? 1 : 0)),
            Array.from({ length: rows }, (_, i) => (i >= rows - slot ? 1 : 0)),
          ]) {
            const result = {
              path,
              slot,
              multipliers: PLINKO_MULTIPLIERS[risk][rows],
            };
            expect(plinkoBallPosition(rows, result, 0)).toEqual({
              x: (rows + 1) * 25,
              y: 40,
            });
            let rightTurns = 0;
            for (let branch = 0; branch <= rows; branch++) {
              const point = plinkoBallPosition(
                rows,
                result,
                branch / (rows + 1),
              );
              expect(point.x).toBeCloseTo(
                (rows + 1) * 25 + (rightTurns - branch / 2) * 50,
                8,
              );
              expect(point.y).toBeCloseTo(40 + branch * 30, 8);
              rightTurns += path[branch] ?? 0;
            }
            const final = plinkoBallPosition(rows, result, 1);
            expect(final).toEqual({
              x: slot * 50 + 25,
              y: 40 + rows * 30 + 35,
            });
            expect(plinkoBallPosition(rows, result, 2)).toEqual(final);
            for (let frame = 0; frame <= 100; frame++) {
              const point = plinkoBallPosition(rows, result, frame / 100);
              expect(point.x).toBeGreaterThanOrEqual(25);
              expect(point.x).toBeLessThanOrEqual((rows + 1) * 50 - 25);
              expect(Number.isFinite(point.y)).toBe(true);
            }
          }
        }
      });
    }
  }

  it('does not invent a slot from the path or mutate the server payload', () => {
    const result = {
      path: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]) as unknown as number[],
      slot: 8,
    };
    expect(plinkoBallPosition(8, result, 1)).toEqual({ x: 425, y: 315 });
    expect(result.path).toEqual(Array(8).fill(0));
  });
});

describe('Arcade presentation', () => {
  it.each([
    ['Mines', MinesGame],
    ['Crash', CrashGame],
    ['Limbo', LimboGame],
    ['Plinko', PlinkoGame],
  ] as const)(
    '%s uses the shared header and a stage without an internal fullscreen shell or wallet',
    (title, Game) => {
      const html = renderToStaticMarkup(<Game />);
      expect(html).toContain(title);
      expect(html).toContain('casino-stage');
      expect(html).toContain('casino-panel');
      expect(html).not.toContain('min-h-screen');
      expect(html).not.toContain('Solde:');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).not.toContain('Retour brut');
    },
  );

  it('renders all 25 accessible Mines cells with touch sizing and no restored-tile animation', () => {
    const html = renderToStaticMarkup(<MinesGame />);
    expect(html.match(/aria-label="Case \d+, masquee"/g)).toHaveLength(25);
    expect(html).toContain('grid-cols-5');
    expect(html).toContain('min-h-[44px]');
    expect(html).not.toContain('animate-flip-tile');
  });

  it('keeps the exact default Plinko paytable accessible outside the canvas', () => {
    const html = renderToStaticMarkup(<PlinkoGame />);
    expect(html).toContain('Multiplicateurs par case');
    for (const [slot, multiplier] of PLINKO_MULTIPLIERS.medium[12].entries()) {
      expect(html).toContain(`Case ${slot + 1}<span`);
      expect(html).toContain(`>${multiplier}x</span>`);
    }
    expect(html).toContain('aria-label="Plateau Plinko');
  });
});
