// Offline, full-shell Chromium QA. Run: node frontend/tests/frontend-visual.e2e.cjs
// Only evidence is persisted; Vite's dependency cache is temporary and removed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.resolve(ROOT, '../reports/frontend-visual');
const OUT = path.join(REPORTS, new Date().toISOString().replace(/[:.]/g, '-'));
const WIDTHS = [320, 390, 768, 1440];
const ROUTES = {
  lobby: '/lobby', slots: '/game/slots', roulette: '/game/roulette',
  blackjack: '/game/blackjack', videopoker: '/game-videopoker', craps: '/game-craps',
  wheel: '/game-wheel', keno: '/game-keno', plinko: '/game-plinko',
  mines: '/game-mines', crash: '/game-crash', limbo: '/game-limbo',
  poker: '/game-poker', bingo: '/game-bingo',
};
const cards = ['A', 'K', 'Q', 'J', '10'].map(rank => ({ rank, suit: 'hearts', value: rank === 'A' ? 11 : 10 }));
const longHand = ['2', '3', '2', '3', '2', '3', '2', '3'].map((rank, i) => ({ rank, suit: i % 2 ? 'clubs' : 'diamonds', value: Number(rank) }));
const vp = { sessionId: 'offline-vp', phase: 'deal', hand: cards, held: [true, false, true, false, false], handName: '', bet: 5, payout: 0 };
const bj = {
  sessionId: 'offline-bj', state: 'playing', hands: [
    { cards: longHand, bet: 100, value: 20, isDoubled: false, isSplit: true, isBlackjack: false, isBusted: false, payout: 0 },
    { cards: cards.slice(0, 2), bet: 100, value: 21, isDoubled: false, isSplit: true, isBlackjack: true, isBusted: false, payout: 0 },
  ], dealerCards: longHand.slice(0, 6), dealerHidden: true, dealerValue: 15,
  activeHandIndex: 0, insuranceAvailable: false, insuranceBet: 0, insurancePayout: 0, payout: 0, bet: 200,
};
const poker = {
  selectedTable: 'offline-six-seats', table: { id: 'offline-six-seats', name: 'Table six joueurs', phase: 'river', smallBlind: 5, bigBlind: 10, mode: 'shared', maxPlayers: 6 },
  isAtTable: true, mySeat: 0, players: [5, 0, 4, 2, 1, 3].map(seat => ({
    userId: seat === 0 ? 'offline-me' : `offline-${seat}`, username: `Joueur${seat}NomTresLongSansEspaces`,
    seat, chips: 123456789, currentBet: 123456, totalBet: 123456, folded: seat === 4,
    isAllIn: seat === 2, isBot: seat === 3, holeCards: seat === 5 ? cards.slice(0, 2) : undefined,
  })), phase: 'river', dealerIndex: 1, currentPlayerIndex: 1, communityCards: cards,
  pot: 987654321, myCards: cards.slice(0, 2), isMyTurn: true, minBet: 10,
  currentRaise: 123456, handInProgress: true, loading: false,
};
const bingoCard = {
  id: 'offline-card', numbers: Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r === 2 && c === 2 ? 0 : c * 15 + r + 1)),
  marked: Array.from({ length: 5 }, () => Array(5).fill(true)),
};
const bingo = winnerId => ({
  isInRoom: true, currentRoom: { id: 'offline-bingo', ticketPrice: 100, maxPlayers: 20 },
  myCard: bingoCard, phase: 'complete', pattern: 'full', prize: 123456,
  winner: { userId: winnerId, username: 'GagnantAvecUnNomTresLongSansEspaces', prize: 123456 },
  players: Array.from({ length: 6 }, (_, i) => ({ userId: i ? `offline-${i}` : 'offline-me', username: `Joueur${i}NomTresLongSansEspaces` })),
  calledNumbers: bingoCard.numbers.flat().filter(Boolean), lastCalledNumber: 31, ballCount: 51, loading: false,
});
const SCENARIOS = [
  ...Object.keys(ROUTES).map(game => ({ id: `${game}-entry`, game })),
  { id: 'poker-six-seats', game: 'poker', poker },
  { id: 'blackjack-longhand', game: 'blackjack', restored: bj },
  { id: 'videopoker-five-cards', game: 'videopoker', restored: vp },
  { id: 'bingo-my-winner', game: 'bingo', bingo: bingo('offline-me'), winner: true },
  { id: 'bingo-other-winner', game: 'bingo', bingo: bingo('offline-other'), winner: false },
  { id: 'roulette-result', game: 'roulette', play: true, outcome: { number: 32, color: 'red', totalWin: 900, bets: [{ type: 'straight', positions: [32], amount: 25, payout: 900, won: true }] } },
  { id: 'slots-result', game: 'slots', play: true, outcome: { reels: Array.from({ length: 3 }, () => ['BAR', 'BAR', 'BAR']), paylines: [{ line: 1, positions: [0, 3, 6], symbol: 'BAR', payout: 150 }], totalWin: 150 } },
  { id: 'wheel-result', game: 'wheel', play: true, outcome: { segments: [{ multiplier: 7, color: '#448877', weight: 2 }, { multiplier: 0, color: '#112233', weight: 3 }], result: { index: 0, segment: { multiplier: 7 } }, payout: 70 } },
  { id: 'keno-result', game: 'keno', play: true, outcome: { drawnNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], matchCount: 1, payout: 2 } },
  { id: 'craps-point', game: 'craps', restored: { sessionId: 'offline-craps', passBet: 100, oddsBet: 200, point: 10, phase: 'point', dice: [4, 6], diceTotal: 10, payout: 0, state: 'playing' } },
];

const runtime = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '/src/App.tsx';
import { useAuthStore } from '/src/store/authStore.ts';
import { useBalanceStore } from '/src/store/balanceStore.ts';
import { usePokerStore } from '/src/store/pokerStore.ts';
import { useBingoStore } from '/src/store/bingoStore.ts';
import '/src/index.css';
const f = window.__visualFixture;
useAuthStore.setState({ user: { id: 'offline-me', pseudo: 'UtilisateurAvecUnNomTresLongSansEspaces', username: 'UtilisateurAvecUnNomTresLongSansEspaces', role: 'PLAYER', balance: 9876543210 }, isAuthenticated: true, isLoading: false });
useBalanceStore.setState({ balance: 9876543210 });
// Preserve real reactive stores, but replace session operations with local fixtures.
usePokerStore.setState({ ...f.poker, getTables: () => {}, resumeSession: async () => usePokerStore.setState({ loading: false }), standUp: async () => true, leaveTable: async () => true });
useBingoStore.setState({ ...f.bingo, getRooms: () => {}, joinRoom: () => {} });
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null, React.createElement(App)));
window.__visualReady = true;
`;

const fakeApi = String.raw`
export const financialRequestKey = () => 'offline-only';
const request = async (method, url) => {
  const f = window.__visualFixture;
  window.__fixtureCalls.push({ method, url });
  let data;
  if (method === 'get' && url === '/economy/balance') data = { balance: 9876543210 };
  else if (method === 'get' && url === '/economy/daily-info') data = { available: true, amount: 1500, streak: 7, nextIn: '' };
  else if (method === 'get' && url === '/notifications/unread-count') data = { count: 2 };
  else if (method === 'get' && url === '/notifications') data = { notifications: [], total: 0, unread: 2 };
  else if (method === 'get' && /^\/games\/(blackjack|videopoker|craps|mines)\/state$/.test(url)) data = f.restored || null;
  else if (method === 'get' && url === '/games/crash/state') data = { sessionId: 'offline-crash', roundId: 'offline-round', multiplier: 1, state: 'waiting', players: [] };
  else if (method === 'post' && f.play && /^\/games\/(slots\/spin|roulette\/spin|wheel\/spin|keno\/play)$/.test(url)) data = f.outcome;
  else { const error = 'Unexpected offline API operation: ' + method + ' ' + url; window.__fixtureErrors.push(error); throw new Error(error); }
  return { data };
};
export default Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map(method => [method, url => request(method, url)]));
`;

const fakeSocket = `
const socket = { connected: true, on: () => socket, off: () => socket, disconnect: () => socket,
  emit: (event, ...args) => {
    window.__fixtureCalls.push({ socket: event });
    const cb = args.at(-1);
    if (event === 'chat:get-messages' && typeof cb === 'function') cb({ success: true, messages: [] });
    else window.__fixtureErrors.push('Unexpected offline socket operation: ' + event);
    return socket;
  }
};
export const getPokerSocket = () => socket;
export const disconnectPokerSocket = () => {};
export const getBingoSocket = () => socket;
export const disconnectBingoSocket = () => {};
export const connectChat = () => socket;
export const getChatSocket = () => socket;
export const disconnectChat = () => {};
export const onNewMessage = () => () => {};
export const onChatError = () => () => {};
export const sendMessage = async () => { throw new Error('Sending chat is outside visual QA'); };
`;

// CSS modules need these Vite helpers, but not a dev-server WebSocket or HMR.
const offlineViteClient = `
export function updateStyle(id, css) { let node = document.querySelector('style[data-offline-id="' + CSS.escape(id) + '"]'); if (!node) { node = document.createElement('style'); node.dataset.offlineId = id; document.head.append(node); } node.textContent = css; }
export function removeStyle(id) { document.querySelector('style[data-offline-id="' + CSS.escape(id) + '"]')?.remove(); }
export const createHotContext = () => ({ accept() {}, dispose() {}, on() {}, prune() {}, invalidate() {} });
export const injectQuery = (url, query) => url + (url.includes('?') ? '&' : '?') + query;
`;

const report = {
  status: 'RUNNING', started: new Date().toISOString(), evidence: path.relative(path.dirname(ROOT), OUT),
  isolation: { realApp: true, realHeaderAndLayout: true, backendForwarding: false, accountsCreated: 0, websocketsAllowed: false, unexpectedRequests: [] },
  limitations: ['Offline system fallback fonts are used; Google Fonts are not requested.', 'Vertical page scrolling is intentional; viewport checks assert horizontal containment, not that an entire long game fits above the fold.', 'No axe dependency is installed; landmark and accessible-name checks are included.'],
  checks: [],
};
function save() {
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS, 'latest.json'), JSON.stringify(report, null, 2));
}

async function inspect(page, game) {
  return page.evaluate(game => {
    const visible = element => { const r = element.getBoundingClientRect(); const s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !element.closest('[aria-hidden="true"]'); };
    const name = element => element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.trim().replace(/\s+/g, ' ').slice(0, 100) || element.tagName;
    const box = element => { const r = element.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2) }; };
    const targets = [...document.querySelectorAll('main, .casino-nav, button, main canvas, main input, main select, .casino-game .playing-card, .casino-game .casino-stage, .casino-game .casino-table, [aria-label^="Siege "]')].filter(visible);
    const outside = targets.filter(e => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5; }).map(e => ({ tag: e.tagName, name: name(e), class: e.className?.baseVal ?? e.className, box: box(e) }));
    const clipped = [];
    for (const e of targets.filter(e => e.matches('button, canvas, input, select'))) {
      const r = e.getBoundingClientRect();
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (!/^(hidden|clip|auto|scroll)$/.test(getComputedStyle(p).overflowX)) continue;
        const pr = p.getBoundingClientRect();
        if (r.left < pr.left - 1 || r.right > pr.right + 1) { clipped.push({ tag: e.tagName, name: name(e), box: box(e), clippingParent: p.className }); break; }
      }
    }
    const heading = document.querySelector('main h1');
    const nav = document.querySelector('.casino-nav');
    const failures = [];
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (docWidth > innerWidth) failures.push('Horizontal document overflow: ' + docWidth + ' > ' + innerWidth);
    if (document.querySelectorAll('.player-shell').length !== 1) failures.push('Expected exactly one real player shell');
    if (document.querySelectorAll('.casino-nav').length !== 1) failures.push('Expected exactly one global Header');
    if (document.querySelectorAll('main, [role="main"]').length !== 1) failures.push('Expected exactly one main landmark');
    if (document.querySelectorAll('main h1').length !== 1) failures.push('Expected one main heading');
    const menuOpen = document.querySelector('.casino-nav > div > button[aria-expanded="true"]');
    if (!heading || !nav || (!menuOpen && scrollY === 0 && heading.getBoundingClientRect().top < nav.getBoundingClientRect().bottom)) failures.push('Main heading hidden behind fixed Header');
    if (game !== 'lobby' && document.querySelectorAll('main .casino-game').length !== 1) failures.push('Game not inside real App GamePage wrapper');
    if (game !== 'lobby' && document.querySelectorAll('main .casino-game-header').length !== 1) failures.push('Expected one shared game header');
    if (game === 'lobby' && document.querySelectorAll('.casino-game-tile').length !== 13) failures.push('Expected all 13 lobby games');
    if (outside.length) failures.push(outside.length + ' main/shell/control/card elements outside horizontal viewport');
    if (clipped.length) failures.push(clipped.length + ' controls/canvases clipped horizontally by ancestors');
    const chat = document.querySelector('button[aria-label="Ouvrir le chat"]');
    const overlayWarnings = [];
    if (chat) {
      const cr = chat.getBoundingClientRect();
      for (const e of targets.filter(e => e !== chat && e.matches('main button, main canvas, .casino-game .playing-card'))) {
        const r = e.getBoundingClientRect();
        const overlapWidth = Math.min(cr.right, r.right) - Math.max(cr.left, r.left);
        const overlapHeight = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top);
        if (overlapWidth > 1 && overlapHeight > 1) {
          const centerTarget = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const centerBlocked = e.matches('button') && !!centerTarget && (centerTarget === chat || chat.contains(centerTarget));
          overlayWarnings.push({ issue: 'Floating chat overlaps game content in initial viewport', name: name(e), tag: e.tagName, box: box(e), overlap: { width: +overlapWidth.toFixed(2), height: +overlapHeight.toFixed(2) }, interactive: e.matches('button'), centerBlocked });
          if (centerBlocked) failures.push('Floating chat intercepts control center: ' + name(e));
        }
      }
    }
    return { failures, docWidth, viewportWidth: innerWidth, scrollY, outside, clipped, overlayWarnings, checkedElements: targets.length, buttons: targets.filter(e => e.matches('button')).length, canvases: [...document.querySelectorAll('canvas')].map(e => ({ name: name(e), box: box(e) })), heading: heading?.textContent, main: document.querySelector('main') && box(document.querySelector('main')) };
  }, game);
}

(async () => {
  process.chdir(ROOT);
  fs.mkdirSync(OUT, { recursive: true });
  const cache = fs.mkdtempSync('/tmp/opencode/casino-offline-visual-');
  let server, browser;
  try {
    const { createServer } = await import('vite');
    server = await createServer({
      root: ROOT, configFile: false, envFile: false, cacheDir: cache,
      resolve: { alias: { '@': path.join(ROOT, 'src') } },
      esbuild: { jsx: 'automatic' },
      server: { host: '127.0.0.1', port: 0, hmr: false, proxy: {} },
      optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom', 'zustand', 'lucide-react'] },
      plugins: [{
        name: 'isolated-full-shell-visual-qa', enforce: 'pre',
        resolveId(id) {
          if (id === '/__frontend_visual_runtime__.tsx') return '\0frontend-visual-runtime.tsx';
          if (id === '/@vite/client') return '\0offline-vite-client';
        },
        load(id) {
          if (id === '\0frontend-visual-runtime.tsx') return runtime;
          if (id === '\0offline-vite-client' || id.replaceAll('\\', '/').endsWith('/vite/dist/client/client.mjs')) return offlineViteClient;
          if (id === path.join(ROOT, 'src/services/api.ts')) return fakeApi;
          if (/\/src\/services\/(pokerSocket|bingoSocket|chatSocket)\.ts$/.test(id)) return fakeSocket;
        },
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            const pathname = new URL(req.url, 'http://offline.invalid').pathname;
            if (pathname.startsWith('/api/') || pathname.startsWith('/socket.io')) { res.statusCode = 403; res.end('Offline QA: backend forbidden'); return; }
            if (!Object.values(ROUTES).includes(pathname)) return next();
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline CasinoX visual QA</title></head><body class="bg-[#0D0D1A] text-white min-h-screen"><div id="root"></div><script type="module" src="/__frontend_visual_runtime__.tsx"></script></body></html>');
          });
        },
      }],
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    report.isolation.origin = origin;
    browser = await chromium.launch({ headless: true });
    for (const width of WIDTHS) {
      for (const scenario of SCENARIOS) {
        const viewport = { width, height: width === 320 ? 740 : width === 390 ? 844 : width === 768 ? 1024 : 1000 };
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'UTC', serviceWorkers: 'block' });
        const check = { id: scenario.id, route: ROUTES[scenario.game], viewport, status: 'RUNNING', screenshots: [], errors: [], consoleErrors: [], blockedRequests: [] };
        report.checks.push(check);
        let probingIsolation = false;
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          const allowed = url.origin === origin && route.request().method() === 'GET' && (Object.values(ROUTES).includes(url.pathname) || /^\/(src\/|node_modules\/|@|__frontend_visual_runtime__)/.test(url.pathname));
          if (allowed) return route.continue();
          const blocked = { url: url.href, method: route.request().method(), selfTest: probingIsolation };
          check.blockedRequests.push(blocked);
          if (!probingIsolation) report.isolation.unexpectedRequests.push(blocked);
          return route.abort('blockedbyclient');
        });
        await context.routeWebSocket('**/*', socket => { check.errors.push('Unexpected WebSocket: ' + socket.url()); socket.close(); });
        await context.addInitScript(fixture => {
          window.__visualFixture = fixture;
          window.__fixtureCalls = [];
          window.__fixtureErrors = [];
          window.__blockedWebSockets = [];
          localStorage.setItem('lang', 'fr');
          window.WebSocket = class { constructor(url) { window.__blockedWebSockets.push(String(url)); throw new Error('Offline QA: WebSocket forbidden'); } };
          window.Worker = window.SharedWorker = class { constructor() { window.__fixtureErrors.push('Offline QA: Worker forbidden'); throw new Error('Offline QA: Worker forbidden'); } };
          navigator.sendBeacon = url => { window.__fixtureErrors.push('Offline QA: beacon forbidden ' + url); return false; };
        }, scenario);
        const page = await context.newPage();
        page.on('pageerror', error => check.errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && !probingIsolation) check.consoleErrors.push(message.text()); });
        try {
          await page.goto(origin + check.route);
          await page.waitForFunction(() => window.__visualReady && document.querySelector('main h1'), null, { timeout: 30000 });
          await page.locator('main [aria-busy="true"]').waitFor({ state: 'detached', timeout: 5000 });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(120);
          assert.equal(await page.getByRole('banner').count(), 1, 'Exactly one accessible global Header');
          assert.equal(await page.getByRole('main').count(), 1, 'Exactly one accessible main landmark');
          if (scenario.play) {
            if (scenario.game === 'roulette') await page.getByRole('button', { name: 'Miser 25 GC sur 32', exact: true }).click();
            if (scenario.game === 'keno') await page.getByRole('button', { name: 'Numero 1', exact: true }).click();
            const play = { roulette: 'Lancer', slots: 'Lancer · 30 GC', wheel: 'Tourner la roue', keno: 'Lancer le tirage' }[scenario.game];
            await page.getByRole('button', { name: play, exact: true }).click();
            await page.getByText(/Resultat net :/).waitFor();
          }
          if (scenario.id === 'poker-six-seats') {
            assert.equal(await page.locator('[aria-label^="Siege "]').count(), 6);
            check.seats = await page.locator('[aria-label^="Siege "]').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), y: node.getBoundingClientRect().y, bottom: node.getBoundingClientRect().bottom })));
            const board = await page.locator('.casino-table').boundingBox();
            assert.ok(check.seats.every(seat => seat.bottom <= board.y || seat.y >= board.y + board.height), 'Seats must not overlap board');
          }
          if (scenario.id === 'videopoker-five-cards') assert.equal(await page.locator('[data-card-slot]').count(), 5);
          if (scenario.bingo) assert.equal(await page.locator('[data-winner]').getAttribute('data-winner'), String(scenario.winner));
          // Clicking an offscreen game control scrolls the document; shell captures always start at the top.
          await page.evaluate(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
          check.layout = await inspect(page, scenario.game);
          const capture = async (suffix, fullPage = false) => {
            const file = path.join(OUT, `${width}-${scenario.id}-${suffix}.png`);
            await page.screenshot({ path: file, fullPage, animations: 'disabled' });
            check.screenshots.push(path.relative(path.dirname(ROOT), file));
          };
          await capture('viewport');
          await capture('full', true);
          // Bingo's real winner dialog auto-dismisses after six seconds. Also capture the unobscured table.
          if (scenario.bingo) {
            await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 8000 });
            check.tableLayout = await inspect(page, scenario.game);
            check.layout.failures.push(...check.tableLayout.failures.map(error => 'After winner dialog: ' + error));
            await capture('table-full', true);
          }
          if (width < 768 && scenario.game === 'lobby') {
            await page.locator('.casino-nav > div > button[aria-expanded]').click();
            check.menuLayout = await inspect(page, scenario.game);
            check.layout.failures.push(...check.menuLayout.failures.map(error => 'Mobile menu: ' + error));
            await capture('menu');
          }
          check.fixtureCalls = await page.evaluate(() => window.__fixtureCalls);
          check.errors.push(...await page.locator('main [role="alert"]').allTextContents().then(alerts => alerts.map(text => text.trim()).filter(Boolean).map(text => 'Unexpected application alert: ' + text)));
          check.errors.push(...await page.evaluate(() => [...window.__fixtureErrors, ...window.__blockedWebSockets.map(url => 'Unexpected blocked WebSocket: ' + url)]));
          if (check.blockedRequests.length) check.errors.push('Unexpected HTTP requests were blocked');
          if (width === 320 && scenario.game === 'lobby') {
            probingIsolation = true;
            await page.evaluate(async () => {
              await Promise.all(['/api/v1/qa-must-not-forward', 'https://example.invalid/qa-must-not-forward'].map(url => fetch(url).catch(() => null)));
              try { new WebSocket('ws://127.0.0.1:1/qa-must-not-forward'); } catch {}
            });
            assert.equal(check.blockedRequests.filter(request => request.selfTest).length, 2, 'HTTP isolation self-test');
            assert.equal(await page.evaluate(() => window.__blockedWebSockets.length), 1, 'WebSocket isolation self-test');
            report.isolation.selfTest = 'PASS: local API, remote HTTP and WebSocket blocked without forwarding';
            probingIsolation = false;
          }
          check.status = check.layout.failures.length || check.errors.length || check.consoleErrors.length ? 'FAIL' : 'PASS';
        } catch (error) {
          check.status = 'FAIL'; check.errors.push(error.message);
          const file = path.join(OUT, `${width}-${scenario.id}-failure.png`);
          await page.screenshot({ path: file, fullPage: true }).then(() => check.screenshots.push(path.relative(path.dirname(ROOT), file))).catch(() => {});
        } finally {
          await context.close(); save();
        }
        console.log(`${check.status} ${width}px ${check.route} [${check.id}]${check.layout?.failures.length ? ': ' + check.layout.failures.join('; ') : ''}${check.errors.length ? ': ' + check.errors.join('; ') : ''}`);
      }
    }
    report.status = report.checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL';
  } catch (error) {
    report.status = 'FAIL'; report.fatal = error.stack; console.error(error);
  } finally {
    await browser?.close();
    await server?.close();
    fs.rmSync(cache, { recursive: true, force: true });
    report.finished = new Date().toISOString();
    report.summary = { passed: report.checks.filter(check => check.status === 'PASS').length, failed: report.checks.filter(check => check.status === 'FAIL').length, casesWithOverlayWarnings: report.checks.filter(check => check.layout?.overlayWarnings?.length || check.tableLayout?.overlayWarnings?.length).length, screenshots: report.checks.reduce((sum, check) => sum + check.screenshots.length, 0) };
    save();
    console.log(JSON.stringify({ status: report.status, ...report.summary, manifest: path.join(OUT, 'manifest.json') }, null, 2));
    if (report.status !== 'PASS') process.exitCode = 1;
  }
})();
