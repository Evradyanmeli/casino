import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, type Browser, type Page } from 'playwright';
import path from 'node:path';

// A browser fixture exercises the actual components and CSS without a backend,
// authenticated app shell, or any financial/socket commands leaving the browser.
const runtime = `
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Blackjack from '/src/components/games/BlackjackGame.tsx';
import VideoPoker from '/src/components/games/VideoPokerGame.tsx';
import Poker from '/src/components/games/PokerPage.tsx';
import Bingo from '/src/components/games/BingoPage.tsx';
import { gamesApi } from '/src/services/games.ts';
import { usePokerStore } from '/src/store/pokerStore.ts';
import { useBingoStore } from '/src/store/bingoStore.ts';
import { useAuthStore } from '/src/store/authStore.ts';
import { useBalanceStore } from '/src/store/balanceStore.ts';
import { getPokerSocket } from '/src/services/pokerSocket.ts';
import { getBingoSocket } from '/src/services/bingoSocket.ts';
import '/src/index.css';
getPokerSocket().disconnect();
getBingoSocket().disconnect();
const t = window.tableTest = { drawCalls: [], leaveCalls: [], leaveResult: false, route: '/game', root: null };
gamesApi.blackjackState = async () => t.state;
gamesApi.blackjackStart = async () => { t.bjCalls = (t.bjCalls || 0) + 1; return t.bjResult; };
gamesApi.vpState = async () => t.state;
gamesApi.vpDraw = (sessionId, held) => {
  t.drawCalls.push({ sessionId, held });
  return new Promise((resolve, reject) => { t.releaseDraw = () => resolve(t.vpResult); t.rejectDraw = () => reject(new Error('Tirage refuse')); });
};
useBalanceStore.setState({ balance: 1000, syncBalance: async () => {} });
useAuthStore.setState({ user: { id: 'me', username: 'Moi' }, isAuthenticated: true, isLoading: false });
function RouteObserver() { const location = useLocation(); useEffect(() => { t.route = location.pathname; }, [location]); return null; }
t.mount = async (kind, state) => {
  if (t.root) t.root.unmount();
  t.drawCalls = []; t.leaveCalls = []; t.route = '/game'; t.state = state;
  usePokerStore.getState().reset(); useBingoStore.getState().reset();
  if (kind === 'Poker') usePokerStore.setState({ ...state, standUp: async id => { t.leaveCalls.push(['standUp', id]); return t.leaveResult; }, leaveTable: async id => { t.leaveCalls.push(['leaveTable', id]); return t.leaveResult; } });
  if (kind === 'Bingo') useBingoStore.setState(state);
  t.root = createRoot(document.getElementById('root'));
  t.root.render(React.createElement(MemoryRouter, { initialEntries: ['/game'] }, React.createElement(RouteObserver), React.createElement({ Blackjack, VideoPoker, Poker, Bingo }[kind])));
  await new Promise(resolve => setTimeout(resolve, 60));
  if (kind === 'Poker') usePokerStore.setState({ loading: false });
};
`;

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    plugins: [react(), {
      name: 'table-visual-fixture',
      resolveId: id => id === '/__table_visual_runtime__.js' ? '\0table-visual-runtime' : undefined,
      load: id => id === '\0table-visual-runtime' ? runtime : undefined,
      configureServer: vite => {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== '/__table_visual__.html') return next();
          res.setHeader('Content-Type', 'text/html');
          void vite.transformIndexHtml('/__table_visual__.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main class="casino-game" style="padding:12px"><div id="root"></div></main><script type="module" src="/__table_visual_runtime__.js"></script></body></html>').then(html => res.end(html)).catch(next);
        });
      },
    }],
    optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom', 'zustand', 'lucide-react', 'axios', 'socket.io-client'] },
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Browser fixture did not start');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const warmup = await browser.newPage();
  try {
    await warmup.goto(`${origin}/__table_visual__.html`);
    await warmup.waitForFunction(() => !!(window as any).tableTest?.mount, undefined, { timeout: 20000 });
  } finally { await warmup.close(); }
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function mount(kind: string, state: unknown, width = 320, reducedMotion = false): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${origin}/__table_visual__.html`);
  await page.waitForFunction(() => !!(window as any).tableTest?.mount);
  await page.evaluate(async ({ kind, state }) => (window as any).tableTest.mount(kind, state), { kind, state });
  return page;
}

const hand = ['A', 'K', 'Q', 'J', '10'].map(rank => ({ rank, suit: 'hearts' }));
const vpState = (bet = 1) => ({ sessionId: 'vp', phase: 'deal', hand, held: [false, false, false, false, false], handName: '', bet, payout: 0 });
const bingoCard = { id: 'card', numbers: Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r === 2 && c === 2 ? 0 : c * 15 + r + 1)), marked: Array.from({ length: 5 }, () => Array(5).fill(true)) };
const bingoState = (winnerId: string) => ({ isInRoom: true, currentRoom: { id: 'bingo', ticketPrice: 10 }, myCard: bingoCard, phase: 'complete', winner: { userId: winnerId, username: 'Gagnant', prize: 40 }, calledNumbers: bingoCard.numbers.flat().filter(Boolean), lastCalledNumber: 31, ballCount: 50 });
const pokerPlayers = [5, 0, 4, 2, 1, 3].map(seat => ({ userId: seat === 0 ? 'me' : `p${seat}`, username: `Joueur${seat}NomTresLong`, seat, chips: 123456, currentBet: 20, totalBet: 20, folded: seat === 4, isAllIn: false, isBot: false }));
const pokerState = { table: { id: 'table', name: 'Table six joueurs', phase: 'flop', smallBlind: 5, bigBlind: 10 }, isAtTable: true, mySeat: 0, players: pokerPlayers, phase: 'flop', dealerIndex: 1, currentPlayerIndex: 3, communityCards: hand.slice(0, 3), pot: 120, myCards: hand.slice(0, 2), isMyTurn: true, currentRaise: 20 };

describe('Card and table presentation', () => {
  it('waits for Blackjack cards before settlement and rejects duplicate deal clicks', async () => {
    const page = await mount('Blackjack', null, 390);
    try {
      await page.clock.install();
      await page.clock.pauseAt(Date.now() + 1000);
      await page.evaluate(() => {
        const t = (window as any).tableTest;
        t.bjResult = { sessionId: 'bj', state: 'complete', hands: [{ cards: [{ rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }], bet: 10, value: 21, isBlackjack: true, isBusted: false, payout: 25 }], dealerCards: [{ rank: '10', suit: 'clubs' }, { rank: '8', suit: 'hearts' }], dealerHidden: false, dealerValue: 18, activeHandIndex: -1, insuranceAvailable: false, insuranceBet: 0, insurancePayout: 0 };
        const deal = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Distribuer')!;
        deal.click(); deal.click();
      });
      await page.locator('[aria-label="A hearts"]').waitFor();
      expect(await page.evaluate(() => (window as any).tableTest.bjCalls)).toBe(1);
      expect(await page.getByText('Nouvelle partie').count()).toBe(0);
      await page.clock.runFor(699);
      expect(await page.getByText('Nouvelle partie').count()).toBe(0);
      await page.clock.runFor(1);
      await page.getByRole('button', { name: 'Nouvelle partie' }).waitFor();
      expect(await page.getByText('Resultat net : +15 GC', { exact: true }).count()).toBe(1);
    } finally { await page.close(); }
  });
  it('includes Blackjack insurance in the displayed gross and net result', async () => {
    const page = await mount('Blackjack', { sessionId: 'bj', state: 'complete', hands: [{ cards: hand.slice(0, 2), bet: 10, value: 20, isBlackjack: false, isBusted: false, payout: 0 }], dealerCards: hand.slice(0, 2), dealerHidden: false, dealerValue: 21, activeHandIndex: 0, insuranceAvailable: false, insuranceBet: 5, insurancePayout: 15, payout: 15, bet: 10 });
    try {
      expect(await page.getByText('Resultat net : 0').count()).toBe(1);
      expect(await page.getByText('Assurance incluse: mise 5, retour 15').count()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await page.close(); }
  });

  it.each([1, 2, 3, 4, 5])('shows the correct royal multiplier for %i pieces and fits five cards at 320px', async bet => {
    const page = await mount('VideoPoker', vpState(bet));
    try {
      const royal = page.getByText('Quinte Flush Royale', { exact: true }).locator('..');
      expect(await royal.textContent()).toContain(bet === 5 ? '800x' : '250x');
      expect(await page.locator('[data-card-slot]').count()).toBe(5);
      const buttons = page.locator('[data-card-slot] button');
      await buttons.first().click();
      expect(await buttons.first().getAttribute('aria-pressed')).toBe('true');
      expect(await buttons.first().textContent()).toContain('HOLD');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await page.close(); }
  });

  it('waits for discard AND the request, preserves held DOM, and guards duplicate draws', async () => {
    const page = await mount('VideoPoker', vpState(), 390);
    try {
      await page.locator('[data-card-slot="0"] button').click();
      await page.evaluate(() => {
        const t = (window as any).tableTest;
        t.heldNode = document.querySelector('[data-card-slot="0"]');
        t.vpResult = { ...t.state, phase: 'complete', hand: [t.state.hand[0], ...t.state.hand.slice(1).map((c: any) => ({ ...c, suit: 'clubs' }))], held: [true, false, false, false, false], handName: 'Rien' };
        const draw = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Piocher')!;
        draw.click(); draw.click();
      });
      expect(await page.locator('[data-deal-phase]').getAttribute('data-deal-phase')).toBe('discard');
      await page.waitForTimeout(650);
      expect(await page.locator('[data-deal-phase]').getAttribute('data-deal-phase')).toBe('discard');
      expect(await page.evaluate(() => (window as any).tableTest.drawCalls)).toEqual([{ sessionId: 'vp', held: [true, false, false, false, false] }]);
      await page.evaluate(() => (window as any).tableTest.releaseDraw());
      await page.waitForFunction(() => document.querySelector('[data-deal-phase]')?.getAttribute('data-deal-phase') === 'deal');
      expect(await page.locator('[data-card-slot="0"]').getAttribute('class')).not.toContain('animate-card-deal');
      expect(await page.evaluate(() => (window as any).tableTest.heldNode === document.querySelector('[data-card-slot="0"]'))).toBe(true);
      expect(await page.locator('[data-deal-phase]').getAttribute('aria-busy')).toBe('true');
      await page.waitForFunction(() => document.querySelector('[data-deal-phase]')?.getAttribute('data-deal-phase') === 'idle');
      expect(await page.locator('[data-deal-phase]').getAttribute('aria-busy')).toBe('false');
    } finally { await page.close(); }
  });

  it('keeps the dealt hand after a rejected draw and skips animation with reduced motion', async () => {
    const page = await mount('VideoPoker', vpState(), 320, true);
    try {
      await page.getByRole('button', { name: 'Piocher', exact: true }).click();
      await page.evaluate(() => (window as any).tableTest.rejectDraw());
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain('Tirage refuse');
      expect(await page.locator('[data-deal-phase]').getAttribute('data-deal-phase')).toBe('idle');
      expect(await page.locator('[data-card-slot="0"] button').getAttribute('aria-label')).toContain('A hearts');
      await page.evaluate(() => { const t = (window as any).tableTest; t.vpResult = { ...t.state, phase: 'complete', handName: 'Rien' }; });
      await page.getByRole('button', { name: 'Piocher', exact: true }).click();
      await page.evaluate(() => (window as any).tableTest.releaseDraw());
      await page.getByRole('button', { name: 'Nouvelle partie' }).waitFor();
      expect(await page.locator('.animate-card-discard, [data-card-slot].animate-card-deal').count()).toBe(0);
    } finally { await page.close(); }
  });

  it('does not replace discarded cards early when the request responds immediately', async () => {
    const page = await mount('VideoPoker', vpState());
    try {
      await page.evaluate(() => { const t = (window as any).tableTest; t.vpResult = { ...t.state, phase: 'complete', hand: t.state.hand.map((c: any) => ({ ...c, suit: 'clubs' })), handName: 'Rien' }; });
      await page.getByRole('button', { name: 'Piocher', exact: true }).click();
      await page.evaluate(() => (window as any).tableTest.releaseDraw());
      expect(await page.locator('[data-deal-phase]').getAttribute('data-deal-phase')).toBe('discard');
      expect(await page.locator('[data-card-slot="0"] button').getAttribute('aria-label')).toContain('A hearts');
      await page.waitForFunction(() => document.querySelector('[data-deal-phase]')?.getAttribute('data-deal-phase') === 'deal');
      expect(await page.locator('[data-card-slot="0"] button').getAttribute('aria-label')).toContain('A clubs');
      await page.evaluate(() => (window as any).tableTest.root.unmount());
      await page.waitForTimeout(900);
      expect(await page.locator('[data-card-slot]').count()).toBe(0);
    } finally { await page.close(); }
  });

  it.each([320, 390, 768, 1440])('keeps all six Poker seats outside the board at %ipx and uses the authoritative dealer', async width => {
    const page = await mount('Poker', pokerState, width);
    try {
      const seats = page.locator('[aria-label^="Siege "]');
      expect(await seats.count()).toBe(6);
      expect(await page.locator('[aria-label^="Siege 1:"]').locator('[aria-label="Croupier"]').count()).toBe(1);
      expect(await page.getByText('Pot: 120', { exact: true }).count()).toBe(1);
      const board = (await page.locator('.casino-table').boundingBox())!;
      for (const seat of await seats.all()) {
        const box = (await seat.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height <= board.y || box.y >= board.y + board.height).toBe(true);
      }
      const controls = (await page.locator('[aria-label="Actions de poker"]').boundingBox())!;
      expect(controls.y).toBeGreaterThan(board.y + board.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await page.close(); }
  });

  it.each([true, false])('never navigates Poker back before an acknowledged leave (seated=%s)', async seated => {
    const page = await mount('Poker', { ...pokerState, isAtTable: seated });
    try {
      await page.getByRole('button', { name: /Retour/ }).click();
      expect(await page.evaluate(() => (window as any).tableTest.route)).toBe('/game');
      expect(await page.evaluate(() => (window as any).tableTest.leaveCalls)).toEqual([[seated ? 'standUp' : 'leaveTable', 'table']]);
      await page.evaluate(() => { (window as any).tableTest.leaveResult = true; });
      await page.getByRole('button', { name: /Retour/ }).click();
      await page.waitForFunction(() => (window as any).tableTest.route === '/lobby');
    } finally { await page.close(); }
  });

  it.each(['me', 'other'])('styles only the actual Bingo winner card (winner=%s)', async winnerId => {
    const page = await mount('Bingo', bingoState(winnerId));
    try {
      expect(await page.locator('[data-winner]').getAttribute('data-winner')).toBe(String(winnerId === 'me'));
      expect(await page.locator('[data-winner] .motion-safe\\:animate-pulse').count()).toBe(winnerId === 'me' ? 25 : 0);
      expect(await page.locator('[aria-label="Numero appele: N 31, 50 boules restantes"]').count()).toBe(1);
      expect(await page.locator('[data-winner] [aria-label]').count()).toBe(25);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await page.close(); }
  });
});
