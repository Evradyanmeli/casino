import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import path from 'node:path';

// Render the real components in Chromium. Only the transport and wallet are replaced.
const fixture = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { MemoryRouter } from 'react-router-dom';
  import { SlotsGame } from '/src/components/games/SlotsGame.tsx';
  import { RouletteGame } from '/src/components/games/RouletteGame.tsx';
  import WheelGame from '/src/components/games/WheelGame.tsx';
  import KenoGame from '/src/components/games/KenoGame.tsx';
  import CrapsGame from '/src/components/games/CrapsGame.tsx';
  import '/src/index.css';
  const games = { slots: SlotsGame, roulette: RouletteGame, wheel: WheelGame, keno: KenoGame, craps: CrapsGame };
  const Component = games[new URLSearchParams(location.search).get('game')];
  const root = createRoot(document.getElementById('root'));
  window.__unmount = () => root.unmount();
  root.render(React.createElement(MemoryRouter, null, React.createElement(Component)));
`;

const fakeTransport = `
  export const GAME_BALANCE_ERROR = 'game-balance-error';
  const outcome = () => {
    window.__calls = (window.__calls || 0) + 1;
    return Promise.resolve(window.__outcome);
  };
  export const gamesApi = {
    slotsSpin: outcome, rouletteSpin: outcome,
    wheel: { spin: outcome }, keno: { play: outcome },
    craps: { getState: () => Promise.resolve(window.__restored || null), start: outcome, roll: outcome, addOdds: outcome }
  };
`;

let server: ViteDevServer;
let browser: Browser;
let base: string;

const TEST_OUTCOMES: Record<string, unknown> = {
  slots: { reels: Array.from({ length: 3 }, () => ['CHERRY', 'STAR', 'BAR']), paylines: [], totalWin: 0 },
  roulette: { number: 0, color: 'green', totalWin: 0, bets: [{ amount: 25, won: false }] },
  wheel: { segments: [{ multiplier: 0, weight: 1, color: '#152030' }], result: { index: 0, segment: { multiplier: 0 } }, payout: 0 },
  keno: { drawnNumbers: [1, 2, 3], matchCount: 1, payout: 0 },
  craps: { sessionId: 's', passBet: 10, oddsBet: 0, point: null, phase: 'resolved', dice: [1, 1], diceTotal: 2, payout: 0, state: 'lost' },
};
const PLAY_BUTTONS: Record<string, string> = { slots: 'Lancer · 30 GC', roulette: 'Lancer', wheel: 'Tourner la roue', keno: 'Lancer le tirage', craps: 'Miser et lancer' };

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(),
    configFile: false,
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    server: { port: 0, host: '127.0.0.1' },
    plugins: [{
      name: 'spin-visual-fixture',
      enforce: 'pre',
      resolveId(id) { if (id === '/__spin_fixture__.tsx') return id; },
      load(id) {
        if (id === '/__spin_fixture__.tsx') return fixture;
        if (id.endsWith('/src/services/games.ts')) return fakeTransport;
        if (id.endsWith('/src/store/balanceStore.ts')) return 'export const useBalanceStore = () => ({ balance: 100000 });';
      },
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith('/__spin_test__')) { next(); return; }
          response.setHeader('Content-Type', 'text/html');
          response.end('<html><body style="margin:0;background:#0a1422;padding:16px"><div id="root"></div><script type="module" src="/__spin_fixture__.tsx"></script></body></html>');
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30000);

afterAll(async () => { await browser?.close(); await server?.close(); });

async function open(game: string, outcome: unknown, reducedMotion = false, restored: unknown = null): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.addInitScript(({ result, state }) => {
    Object.assign(window, { __outcome: result, __restored: state, __calls: 0 });
  }, { result: outcome, state: restored });
  await page.goto(`${base}/__spin_test__?game=${game}`);
  await page.locator('h1, h2').first().waitFor();
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  return page;
}

async function text(page: Page): Promise<string> { return (await page.locator('body').textContent()) ?? ''; }

describe('Server-authoritative spin visuals', () => {
  it('locks Slots controls, staggers real reels, highlights server positions and records the original net', async () => {
    const outcome = {
      reels: [['BAR', 'BAR', 'BAR'], ['BAR', 'BAR', 'BAR'], ['BAR', 'BAR', 'BAR']],
      paylines: [{ line: 1, positions: [0, 3, 6], symbol: 'BAR', payout: 15 }], totalWin: 15,
      isFreeSpin: true, freeSpinsRemaining: 10,
    };
    const page = await open('slots', outcome);
    try {
      await page.getByRole('button', { name: 'Lancer · 30 GC' }).click();
      expect(await page.getByRole('button', { name: 'Fruits', exact: true }).isDisabled()).toBe(true);
      expect(await page.getByRole('button', { name: 'Mise de 25 GC par ligne' }).isDisabled()).toBe(true);
      expect(await text(page)).not.toContain('Retour brut');
      await page.clock.runFor(650);
      expect(await page.locator('[aria-label="BAR"]').count()).toBe(3);
      expect(await text(page)).not.toContain('Retour brut');
      await page.clock.runFor(359);
      expect(await text(page)).not.toContain('Retour brut');
      await page.clock.runFor(1);
      await page.getByText('Resultat net : -15 GC', { exact: true }).waitFor();
      expect(await page.locator('[data-winning="true"]').count()).toBe(3);
      expect(await page.getByRole('button', { name: 'Fruits', exact: true }).isDisabled()).toBe(false);
      expect(await text(page)).toContain('ne sont pas encore disponibles');
      await page.getByRole('button', { name: 'Mise de 25 GC par ligne' }).click();
      expect(await text(page)).toContain('mise 30');
      expect(await text(page)).not.toContain('Gagné');
    } finally { await page.close(); }
  });

  it('draws all 37 Roulette pockets in wheel order and aligns repeated results with the fixed ball', async () => {
    const result = { number: 32, color: 'red', totalWin: 0, bets: [{ type: 'straight', positions: [0], amount: 25, won: false, payout: 0 }] };
    const page = await open('roulette', result);
    try {
      const pockets = page.locator('[data-pocket]');
      expect(await pockets.count()).toBe(37);
      expect(await pockets.evaluateAll(nodes => nodes.slice(0, 4).map(node => node.getAttribute('data-pocket')))).toEqual(['0', '32', '15', '19']);
      expect(await page.locator('[data-pocket="0"] path').first().getAttribute('fill')).toBe('#236c50');
      expect(await page.locator('[data-pocket="32"] path').first().getAttribute('fill')).toBe('#a02e39');
      for (const number of [32, 15, 0, 32]) {
        await page.evaluate(value => { (window as any).__outcome.number = value; }, number);
        await page.getByRole('button', { name: 'Miser 25 GC sur 0', exact: true }).click();
        await page.getByRole('button', { name: 'Lancer', exact: true }).click();
        expect(await text(page)).not.toContain('Retour brut');
        expect(await page.getByRole('button', { name: 'Jeton de 100 GC' }).isDisabled()).toBe(true);
        await page.clock.runFor(3599);
        expect(await text(page)).not.toContain('Retour brut');
        await page.clock.runFor(1);
        await page.getByText('Resultat net : -25 GC', { exact: true }).waitFor();
        const rotation = await page.locator('svg[aria-label^="Numero"]').evaluate(node => Number((node as SVGElement).style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]));
        const wheelIndex = [0, 32, 15].indexOf(number);
        const offset = (rotation + wheelIndex * 360 / 37) % 360;
        // Chromium serializes inline angles to six significant digits, below 0.01 degrees here.
        expect(Math.min(offset, 360 - offset)).toBeLessThan(0.01);
        expect(await page.getByRole('button', { name: 'Jeton de 100 GC' }).isDisabled()).toBe(false);
      }
    } finally { await page.close(); }
  });

  it('uses actual Wheel segments for labels and legend, and publishes at the end of the rotation', async () => {
    const segments = [{ multiplier: 7, color: '#448877', weight: 2 }, { multiplier: 0, color: '#112233', weight: 3 }];
    const page = await open('wheel', { segments, result: { index: 0, segment: { multiplier: 7 } }, payout: 70 });
    try {
      await page.getByRole('button', { name: 'Tourner la roue' }).click();
      await page.locator('[data-multiplier="7"]').waitFor();
      expect(await page.getByLabel('Multiplicateurs de la roue').textContent()).toBe('7x0x');
      await page.clock.runFor(3199);
      expect(await text(page)).not.toContain('Retour brut');
      await page.clock.runFor(1);
      await page.getByText('Resultat net : +60 GC', { exact: true }).waitFor();
      const rotation = await page.locator('svg[aria-label="Secteurs ponderes de la roue"]').evaluate(node => Number((node.parentElement as HTMLElement).style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]));
      expect((rotation + 72) % 360).toBeCloseTo(0, 6);
    } finally { await page.close(); }
  });

  it('keeps Keno payout and new-round controls hidden until the last server number is revealed', async () => {
    const page = await open('keno', { drawnNumbers: [1, 2, 3, 4], matchCount: 1, payout: 2 });
    try {
      await page.getByRole('button', { name: 'Numero 1', exact: true }).click();
      await page.getByRole('button', { name: 'Lancer le tirage' }).click();
      expect(await page.getByLabel('Votre mise · GC').isDisabled()).toBe(true);
      await page.clock.runFor(399);
      expect(await text(page)).not.toContain('Retour brut');
      expect(await page.getByRole('button', { name: 'Nouveau tirage' }).count()).toBe(0);
      expect(await page.getByRole('button', { name: /Numero 4.*tire/ }).count()).toBe(0);
      await page.clock.runFor(1);
      await page.getByText('Resultat net : -3 GC', { exact: true }).waitFor();
      expect(await page.getByRole('button', { name: /Numero 4.*tire/ }).count()).toBe(1);
      expect(await page.getByRole('button', { name: 'Nouveau tirage' }).isEnabled()).toBe(true);
    } finally { await page.close(); }
  });

  it('shows a point puck rather than a third die and stages the final Craps faces', async () => {
    const restored = { sessionId: 's', passBet: 10, oddsBet: 0, point: 10, phase: 'point', dice: [4, 6], diceTotal: 10, payout: 0, state: 'playing' };
    const page = await open('craps', { ...restored, phase: 'resolved', dice: [5, 5], diceTotal: 10, payout: 20, state: 'won' }, false, restored);
    try {
      await page.getByRole('button', { name: 'Lancer les des' }).waitFor();
      expect(await page.getByLabel('Point etabli : 10').count()).toBe(1);
      expect(await page.getByLabel('Des : 4 et 6').count()).toBe(1);
      await page.getByRole('button', { name: 'Lancer les des' }).click();
      expect(await page.getByRole('button', { name: 'Ajouter Odds' }).isDisabled()).toBe(true);
      await page.clock.runFor(749);
      expect(await text(page)).not.toContain('Retour brut');
      await page.clock.runFor(1);
      await page.getByText('Resultat net : +10 GC', { exact: true }).waitFor();
      expect(await page.getByLabel('Des : 5 et 5').count()).toBe(1);
    } finally { await page.close(); }
  });

  it.each(['slots', 'roulette', 'wheel', 'keno', 'craps'])('%s respects reduced motion and fits a narrow viewport', async game => {
    const page = await open(game, TEST_OUTCOMES[game], true);
    try {
      await page.setViewportSize({ width: 320, height: 720 });
      if (game === 'roulette') await page.getByRole('button', { name: 'Miser 25 GC sur 0', exact: true }).click();
      if (game === 'keno') await page.getByRole('button', { name: 'Numero 1', exact: true }).click();
      await page.getByRole('button', { name: PLAY_BUTTONS[game], exact: true }).click();
      await page.getByText(/Resultat net :/).waitFor();
      expect(await page.locator('[aria-busy="true"]').count()).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally { await page.close(); }
  });

  it.each(['slots', 'roulette', 'wheel', 'keno', 'craps'])('%s cancels visual completion timers on unmount', async game => {
    const page = await open(game, TEST_OUTCOMES[game]);
    try {
      await page.evaluate(() => {
        const pending = new Set<number>();
        (window as any).__timers = pending;
        const schedule = window.setTimeout.bind(window);
        const cancel = window.clearTimeout.bind(window);
        window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: any[]) => {
          const id = schedule(handler, delay, ...args);
          if (delay && delay >= 100 && delay <= 4000) pending.add(id);
          return id;
        }) as typeof window.setTimeout;
        window.clearTimeout = id => { if (typeof id === 'number') pending.delete(id); cancel(id); };
      });
      if (game === 'roulette') await page.getByRole('button', { name: 'Miser 25 GC sur 0', exact: true }).click();
      if (game === 'keno') await page.getByRole('button', { name: 'Numero 1', exact: true }).click();
      await page.getByRole('button', { name: PLAY_BUTTONS[game], exact: true }).click();
      expect(await page.evaluate(() => (window as any).__timers.size)).toBeGreaterThan(0);
      await page.evaluate(() => (window as any).__unmount());
      expect(await page.evaluate(() => (window as any).__timers.size)).toBe(0);
      await page.clock.runFor(5000);
    } finally { await page.close(); }
  });
});
