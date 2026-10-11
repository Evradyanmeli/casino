// Real App, layouts and services; only transport is replaced. No backend is started.
// Run: node frontend/tests/sitewide-visual.e2e.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.resolve(ROOT, '../reports/sitewide-visual');
const OUT = path.join(REPORTS, new Date().toISOString().replace(/[:.]/g, '-'));
const WIDTHS = [320, 390, 768, 1440];
const LONG = 'UtilisateurAvecUnNomTresLongSansEspacesPourTester';
const EMAIL = 'utilisateur.avec.une.adresse.extremement.longue@exemple-de-domaine-tres-long.invalid';
const DATE = '2026-10-01T12:00:00.000Z';
const USER = { id: 'qa-user', pseudo: LONG, email: EMAIL, role: 'USER', status: 'ACTIVE', balance: 9876543210, xp: 123456789, level: 123, createdAt: DATE, birthDate: '1990-01-01' };
const ADMINS = ['dashboard', 'users', 'games', 'economy', 'settings', 'audit', 'chat', 'notifications'];
const PAGES = [
  { id: 'shop', route: '/shop', role: 'USER' },
  { id: 'tasks-race', route: '/tasks', role: 'USER' },
  { id: 'profile', route: '/profile', role: 'USER' },
  { id: 'responsible-gaming', route: '/responsible-gaming', role: 'USER' },
  ...['login', 'register', 'reset-password'].map(id => ({ id, route: '/' + id, role: null })),
  ...ADMINS.map(id => ({ id: 'admin-' + id, route: '/admin/' + id, role: 'ADMIN' })),
];
const FAIL_ENDPOINTS = {
  shop: ['/shop/packages'], 'tasks-race': ['/progression/tasks', '/progression/race', '/progression/badges'],
  profile: ['/users/me/stats', '/progression/level/progress', '/economy/transactions'],
  'responsible-gaming': ['/responsible-gaming/settings'],
  'admin-dashboard': ['/admin/dashboard', '/admin/economy/house-balance'],
  'admin-users': ['/admin/users'], 'admin-games': ['/admin/games/stats', '/admin/games/config'],
  'admin-economy': ['/admin/settings'], 'admin-settings': ['/admin/settings'],
  'admin-audit': ['/admin/audit-logs'], 'admin-chat': ['/admin/chat/messages'],
};
const EMPTY_IDS = ['shop', 'tasks-race', 'profile', 'responsible-gaming', 'admin-users', 'admin-games', 'admin-settings', 'admin-audit', 'admin-chat'];
const SCENARIOS = [
  ...PAGES.map(p => ({ ...p, state: 'populated' })),
  ...PAGES.filter(p => EMPTY_IDS.includes(p.id)).map(p => ({ ...p, id: p.id + '-empty', state: 'empty' })),
  ...PAGES.filter(p => FAIL_ENDPOINTS[p.id] || !p.role || p.id === 'admin-notifications').map(p => ({ ...p, failEndpoints: FAIL_ENDPOINTS[p.id] || [], id: p.id + '-error', state: 'error' })),
  { id: 'race-completed', route: '/tasks', role: 'USER', state: 'completed' },
];
const games = ['slots', 'blackjack', 'roulette', 'poker', 'mines', 'crash', 'plinko', 'wheel', 'limbo', 'craps', 'bingo', 'videopoker', 'keno'];
const task = (id, completed) => ({ id, userId: USER.id, taskId: id, progress: completed ? 10 : 4, completed, claimed: false, expiresAt: '2099-12-31T00:00:00Z', completedAt: completed ? DATE : null,
  task: { id, slug: id, title: 'ObjectifAvecUnIntituleTresLongSansEspaces', description: 'Terminer dix parties et recevoir une recompense virtuelle.', type: 'daily', condition: { action: 'play', count: 10 }, reward: { xp: 12345, coins: 987654321 }, expiresIn: 86400, createdAt: DATE } });
const badge = { id: 'qa-badge', slug: 'explorer', name: 'ExplorateurAvecUnTitreTresLong', description: 'Decouvrir les experiences du salon', icon: 'XP', category: 'Exploration', condition: { count: 10 }, xpReward: 12345, createdAt: DATE };
const transactions = ['deposit', 'win', 'bet'].map((type, i) => ({ id: 'qa-tx-' + i, type, amount: i === 2 ? -987654321 : 9876543210, description: 'Transaction virtuelle avec une description longue pour tester la mise en page', createdAt: DATE }));
const DATA = {
  user: USER,
  packages: [{ id: 'qa-package', name: 'CollectionDeJetonsAvecUnNomTresLongSansEspaces', tokens: 9876543210, price: 99999, bonus: 123456789, popular: true }, { id: 'qa-small', name: 'Decouverte', tokens: 5000, price: 499 }],
  tasks: { daily: [task('qa-daily', true), task('qa-progress', false)], weekly: [{ ...task('qa-weekly', false), task: { ...task('qa-weekly', false).task, type: 'weekly' } }] },
  badge, transactions,
  level: { xp: 123456789, level: 123, nextLevelXp: 123456999, xpInCurrentLevel: 1234567, xpForNextLevel: 2234567, progressPercent: 55 },
  race: { id: 'qa-race', name: 'CourseAvecUnNomTresLongSansEspacesPourTester', startAt: DATE, endAt: '2099-12-31T00:00:00Z', prize: { 1: 2500, 2: 1500, 3: 1000 }, status: 'active', createdAt: DATE },
  entries: Array.from({ length: 5 }, (_, i) => ({ id: 'qa-entry-' + i, raceId: 'qa-race', userId: i ? 'qa-user-' + i : USER.id, xp: 123456789 - i * 1000, rank: i + 1, prize: 2500, claimed: false, user: { id: i ? 'qa-user-' + i : USER.id, pseudo: LONG + i, avatar: null } })),
  rg: { depositLimit: { enabled: true, daily: 123456, weekly: 1234567, monthly: 9876543 }, lossLimit: { enabled: true, daily: 123456, weekly: 1234567, monthly: 9876543 }, sessionLimit: { enabled: true, minutes: 120 }, selfExclusion: { enabled: false }, realityCheck: { enabled: true, intervalMinutes: 30 } },
  dashboard: { totalUsers: 123456789, activeUsers: 1234567, activeUsers24h: 1234567, totalDeposits: 9876543210, totalWithdrawals: 123456789, totalUserBalance: 9876543210, totalGamesPlayed: 123456789, revenue: -9876543210, houseBalance: 9876543210 },
  house: { balance: 9876543210, reservedBots: 123456789, reservedGames: 123456789, totalBalance: 10123456788, capital: 20000000000 },
  users: [USER, { ...USER, id: 'qa-banned', pseudo: LONG + 'Banni', status: 'BANNED', balance: 0 }],
  stats: games.map(game => ({ game, playCount: 123456789, totalBet: 9876543210, totalWin: 8765432109, rtp: 91.23 })),
  configs: games.map(gameType => ({ id: 'qa-' + gameType, gameType, houseEdge: 5, minBet: 1, maxBet: 100000, active: true })),
  settings: [{ key: 'welcome_bonus', value: 5000 }, { key: 'daily_reward_base', value: 1000 }, { key: 'daily_reward_streak_7', value: 2500 }, { key: 'daily_reward_streak_30', value: 10000 }, { key: 'competition_prize_first', value: 2500 }, { key: 'competition_prize_second', value: 1500 }, { key: 'competition_prize_third', value: 1000 }, { key: 'default_house_edge', value: 5 }],
  logs: [{ id: 'qa-log', adminId: 'qa-admin', admin: { id: 'qa-admin', pseudo: LONG }, action: 'update_game_config', entity: 'GameConfig', entityId: 'qa-slots', before: { houseEdge: 4 }, after: { houseEdge: 5, maxBet: 100000 }, createdAt: DATE }],
  messages: [{ id: 'qa-message', userId: USER.id, user: { id: USER.id, pseudo: LONG, avatar: null }, room: 'salon-avec-un-nom-tres-long', content: 'MessageAvecUneChaineTresLongueSansEspacesPourVerifierLeRetourALaLigneEtLaModeration', createdAt: DATE }],
};

const runtime = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '/src/App.tsx';
import { useAuthStore } from '/src/store/authStore.ts';
import { useBalanceStore } from '/src/store/balanceStore.ts';
import '/src/index.css';
const f = window.__sitewideFixture;
useAuthStore.setState({ user: f.role ? { ...f.data.user, role: f.role } : null, isAuthenticated: !!f.role, isLoading: false });
useBalanceStore.setState({ balance: f.data.user.balance });
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null, React.createElement(App)));
window.__sitewideReady = true;
`;

const fakeApi = String.raw`
export const financialRequestKey = () => 'isolated-sitewide-qa';
const request = async (method, url, body, config) => {
  const f = window.__sitewideFixture, d = f.data, empty = f.state === 'empty';
  const params = method === 'get' ? body?.params || {} : config?.params || {};
  window.__fixtureCalls.push({ method, url, body: method === 'get' ? undefined : body, params });
  const reject = () => { const error = new Error('Service temporairement indisponible (fixture QA isolee).'); error.response = { status: 503, data: { message: error.message } }; throw error; };
  if (method === 'get' && f.failEndpoints?.includes(url)) { window.__expectedFailures.push({ method, url }); return reject(); }
  let data;
  if (method === 'get') {
    switch (url) {
      case '/users/me': data = { ...d.user, role: f.role || 'USER' }; break;
      case '/economy/balance': data = { balance: d.user.balance }; break;
      case '/economy/daily-info': data = { available: true, amount: 1500, streak: 7, nextIn: '' }; break;
      case '/notifications/unread-count': data = { count: 0 }; break;
      case '/notifications': data = { notifications: [], total: 0, unread: 0 }; break;
      case '/shop/packages': data = empty ? [] : d.packages; break;
      case '/users/me/stats': data = { totalSessions: empty ? 0 : 123456789, totalWins: empty ? 0 : 1234567, winRate: empty ? '0.00' : '87.50', biggestWin: empty ? '0' : '9876543210', totalSpent: empty ? '0' : '9876543210' }; break;
      case '/economy/transactions': data = { transactions: empty ? [] : d.transactions.filter(t => !params.filter || t.type === params.filter) }; break;
      case '/users/me/transactions': data = empty ? [] : d.transactions; break;
      case '/progression/level': case '/progression/level/progress': data = d.level; break;
      case '/progression/tasks': data = empty ? { daily: [], weekly: [] } : d.tasks; break;
      case '/progression/badges': data = empty ? [] : [d.badge]; break;
      case '/progression/badges/mine': data = empty ? [] : [{ id: 'qa-earned', userId: d.user.id, badgeId: d.badge.id, earnedAt: d.user.createdAt, badge: d.badge }]; break;
      case '/progression/race': data = empty ? null : { ...d.race, status: f.state === 'completed' ? 'completed' : 'active' }; break;
      case '/progression/race/leaderboard': data = empty ? [] : d.entries; break;
      case '/progression/race/my-rank': data = { rank: 1, xp: 123456789, prize: f.raceClaimed || empty ? 0 : 2500 }; break;
      case '/responsible-gaming/settings': data = empty ? { depositLimit: { enabled: false }, lossLimit: { enabled: false }, sessionLimit: { enabled: false }, selfExclusion: { enabled: false }, realityCheck: { enabled: false } } : d.rg; break;
      case '/admin/dashboard': data = d.dashboard; break;
      case '/admin/economy/house-balance': data = d.house; break;
      case '/admin/users': { const users = empty ? [] : d.users.filter(u => !params.search || (u.pseudo + u.email).toLowerCase().includes(params.search.toLowerCase())); data = { users, total: users.length }; break; }
      case '/admin/games/stats': data = empty ? [] : d.stats; break;
      case '/admin/games/config': data = empty ? [] : d.configs; break;
      case '/admin/games/recent': data = []; break;
      case '/admin/settings': data = empty ? [] : d.settings; break;
      case '/admin/audit-logs': { const logs = empty ? [] : d.logs.filter(l => !params.action || l.action === params.action); data = { logs, total: logs.length }; break; }
      case '/admin/chat/messages': data = empty ? [] : d.messages.filter(m => !params.room || m.room === params.room); break;
      default: if (/^\/admin\/users\/qa-(user|banned)$/.test(url)) data = { ...d.users.find(u => url.endsWith(u.id)), transactions: empty ? [] : d.transactions };
    }
  } else if (method === 'put' && url === '/users/me') { d.user = { ...d.user, ...body }; data = d.user; }
  else if (method === 'post' && /^\/shop\/purchase\/qa-(package|small)$/.test(url)) { const pkg = d.packages.find(p => url.endsWith(p.id)); d.user.balance += pkg.tokens + (pkg.bonus || 0); data = { tokensAwarded: pkg.tokens + (pkg.bonus || 0), newBalance: d.user.balance }; }
  else if (method === 'post' && /^\/progression\/tasks\/qa-(daily|progress|weekly)\/claim$/.test(url)) { for (const t of [...d.tasks.daily, ...d.tasks.weekly]) if (url.includes(t.id)) t.claimed = true; data = { xp: 12345, coins: 987654321, leveledUp: false, newLevel: 123 }; }
  else if (method === 'post' && url === '/progression/race/claim') { f.raceClaimed = true; data = { prize: 2500 }; }
  else if (method === 'put' && /^\/responsible-gaming\/(deposit-limit|loss-limit|session-limit|reality-check)$/.test(url)) { const key = { 'deposit-limit': 'depositLimit', 'loss-limit': 'lossLimit', 'session-limit': 'sessionLimit', 'reality-check': 'realityCheck' }[url.split('/').at(-1)]; d.rg[key] = body; data = d.rg; }
  else if (method === 'post' && url === '/responsible-gaming/self-exclude') { d.rg.selfExclusion = { enabled: true, until: '2099-12-31T00:00:00Z' }; data = d.rg; }
  else if (method === 'post' && url === '/responsible-gaming/cancel-self-exclude') { d.rg.selfExclusion = { enabled: false }; data = d.rg; }
  else if (method === 'post' && ['/auth/login', '/auth/register'].includes(url)) { window.__expectedFailures.push({ method, url }); return reject(); }
  else if (method === 'post' && url === '/auth/reset-password') { if (f.state === 'error') { window.__expectedFailures.push({ method, url }); return reject(); } data = { message: 'Email envoye (mock uniquement)' }; }
  else if (method === 'post' && url === '/admin/notifications') { if (f.state === 'error') { window.__expectedFailures.push({ method, url }); return reject(); } data = { success: true }; }
  else if (method === 'put' && url === '/admin/settings') { for (const setting of body.settings || [body]) { d.settings = [...d.settings.filter(s => s.key !== setting.key), setting]; } data = d.settings; }
  else if (method === 'put' && url === '/admin/games/config') { data = { ...d.configs.find(c => c.gameType === body.gameType), ...body }; d.configs = d.configs.map(c => c.gameType === data.gameType ? data : c); }
  else if (method === 'post' && url === '/admin/economy/house-recharge') { d.house.balance += body.amount; d.house.capital += body.amount; data = d.house; }
  else if (method === 'post' && /^\/admin\/users\/qa-(user|banned)\/ban$/.test(url)) { const u = d.users.find(u => url.includes(u.id)); u.status = u.status === 'BANNED' ? 'ACTIVE' : 'BANNED'; data = u; }
  else if (method === 'post' && /^\/admin\/users\/qa-(user|banned)\/adjust-balance$/.test(url)) { const u = d.users.find(u => url.includes(u.id)); u.balance += body.amount; data = u; }
  else if (method === 'delete' && url === '/admin/chat/messages/qa-message') { d.messages = []; data = { success: true }; }
  else if (method === 'post' && url === '/admin/chat/ban/qa-user') { d.messages = []; data = { success: true }; }
  else if (method === 'post' && url === '/notifications/read-all') data = { success: true };
  if (data === undefined) { const message = 'Missing offline fixture: ' + method + ' ' + url; window.__fixtureErrors.push(message); throw new Error(message); }
  return { data };
};
export default Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map(method => [method, (url, body, config) => request(method, url, body, config)]));
`;
const fakeSocket = `
const socket = { connected: true, on: () => socket, off: () => socket, disconnect: () => socket,
  emit: (event, ...args) => { window.__fixtureCalls.push({ socket: event }); const cb = args.at(-1);
    if (event === 'chat:get-messages' && typeof cb === 'function') cb({ success: true, messages: [] });
    else window.__fixtureErrors.push('Missing offline socket fixture: ' + event); return socket; } };
export const connectChat = () => socket;
export const getChatSocket = () => socket;
export const disconnectChat = () => {};
export const onNewMessage = () => () => {};
export const onChatError = () => () => {};
export const sendMessage = async message => { window.__fixtureCalls.push({ socket: 'chat:message', message }); };
export const getPokerSocket = () => socket;
export const disconnectPokerSocket = () => {};
export const getBingoSocket = () => socket;
export const disconnectBingoSocket = () => {};
`;
const offlineClient = `
export function updateStyle(id, css) { let node = document.querySelector('style[data-offline-id="' + CSS.escape(id) + '"]'); if (!node) { node = document.createElement('style'); node.dataset.offlineId = id; document.head.append(node); } node.textContent = css; }
export function removeStyle(id) { document.querySelector('style[data-offline-id="' + CSS.escape(id) + '"]')?.remove(); }
export const createHotContext = () => ({ accept() {}, dispose() {}, on() {}, prune() {}, invalidate() {} });
export const injectQuery = (url, query) => url + (url.includes('?') ? '&' : '?') + query;
`;
const report = { status: 'RUNNING', started: new Date().toISOString(), evidence: path.relative(path.dirname(ROOT), OUT), plannedCases: WIDTHS.length * SCENARIOS.length,
  isolation: { realApp: true, realLayouts: true, realServices: true, transportMocked: true, backendForwarding: false, accountsCreated: 0, websocketsAllowed: false, unexpectedRequests: [] },
  limitations: ['Offline system fonts; external font requests are blocked.', 'No axe or image-baseline dependency installed. Screenshots and DOM geometry are evidence, not pixel-diff assertions.', 'Race is part of the real /tasks route, not an invented route.', 'Long single-line input values may scroll internally; tests detect clipped input boxes, not intentional input text scrolling.'], checks: [] };
function save() {
  report.summary = { passed: report.checks.filter(c => c.status === 'PASS').length, failed: report.checks.filter(c => c.status === 'FAIL').length, blockedByAppBuild: report.checks.filter(c => c.moduleErrors?.length).length, screenshots: report.checks.reduce((n, c) => n + c.screenshots.length, 0), interactionsPassed: report.checks.reduce((n, c) => n + c.interactions.filter(i => i.status === 'PASS').length, 0), interactionsFailed: report.checks.reduce((n, c) => n + c.interactions.filter(i => i.status === 'FAIL').length, 0) };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS, 'latest.json'), JSON.stringify(report, null, 2));
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  fs.writeFileSync(path.join(OUT, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sitewide visual QA</title><style>body{font:16px system-ui;background:#101715;color:#eee;max-width:1100px;margin:2rem auto;padding:0 1rem}a{color:#e6cc94}article{border:1px solid #47534c;padding:1rem;margin:1rem 0}img{max-width:280px;max-height:240px;object-fit:contain;vertical-align:top}.PASS{color:#9fdbb7}.FAIL{color:#ff9b9b}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Sitewide Visual QA: ' + escape(report.status) + '</h1><pre>' + escape(JSON.stringify(report.summary, null, 2)) + '</pre><p>Transport mocked. No backend forwarding. <a href="manifest.json">Full manifest</a></p>' + report.checks.map(c => '<article><h2 class="' + c.status + '">' + c.status + ' ' + c.viewport.width + 'px ' + escape(c.id) + '</h2><p>' + escape(c.route + ' / ' + c.role) + '</p><pre>' + escape([...new Set(c.layouts.flatMap(l => l.failures)), ...c.errors, ...c.interactions.filter(i => i.status === 'FAIL').map(i => i.name + ': ' + i.error)].join('\n')) + '</pre>' + c.screenshots.map(file => '<a href="' + escape(path.basename(file)) + '"><img loading="lazy" alt="' + escape(path.basename(file)) + '" src="' + escape(path.basename(file)) + '"></a>').join(' ') + '</article>').join('') + '</html>');
}
async function inspect(page, modal = false) {
  return page.evaluate(modal => {
    const visible = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return !!(r.width && r.height) && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && !e.closest('[hidden], [aria-hidden="true"]'); };
    const name = e => e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent.trim().replace(/\s+/g, ' ').slice(0, 100) || e.id || e.tagName;
    const box = e => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) }; };
    const tableScroller = e => { if (!e.closest('table')) return null; for (let p = e.parentElement; p; p = p.parentElement) if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth) return p; return null; };
    const failures = [], outside = [], clipped = [], unnamed = [], blocked = [];
    const selector = modal ? '[role="dialog"], [role="dialog"] button, [role="dialog"] a, [role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea' : 'header, main, main h1, main h2, main h3, main button, main a, main input, main select, main textarea, header button, header a, footer';
    const targets = [...document.querySelectorAll(selector)].filter(visible);
    for (const e of targets) {
      const r = e.getBoundingClientRect(), scroller = tableScroller(e);
      if ((r.left < -1 || r.right > innerWidth + 1) && !scroller) outside.push({ name: name(e), tag: e.tagName, box: box(e) });
      if (e.matches('button, a, input, select, textarea')) {
        if (!e.matches('input, select, textarea') && name(e) === e.tagName) unnamed.push({ tag: e.tagName, box: box(e) });
        if (e.matches('input:not([type="checkbox"]):not([type="radio"]), select, textarea') && r.width < 70) clipped.push({ name: name(e), issue: 'Input box narrower than 70px', box: box(e) });
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          if (!['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(p).overflowX)) continue;
          if (p === scroller) break;
          const pr = p.getBoundingClientRect();
          if (r.left < pr.left - 1 || r.right > pr.right + 1) { clipped.push({ name: name(e), box: box(e), clippingParent: p.className }); break; }
        }
        if (!modal && !scroller && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !e.disabled) {
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          if (top && !e.contains(top) && top !== e && top.closest('[class*="fixed"]')?.querySelector('[aria-label*="chat"], [aria-label*="Chat"]')) blocked.push({ name: name(e), blocker: name(top) });
        }
      }
    }
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (docWidth > innerWidth + 1) failures.push('Horizontal document overflow: ' + docWidth + ' > ' + innerWidth);
    if (!modal) {
      const headers = [...document.querySelectorAll('header, [role="banner"]')].filter(e => !e.closest('main, aside'));
      if (headers.length !== 1) failures.push('Expected one global Header/banner, got ' + headers.length);
      if (document.querySelectorAll('main, [role="main"]').length !== 1) failures.push('Expected one main landmark');
      const headings = [...document.querySelectorAll('main h1')].filter(visible);
      if (headings.length !== 1) failures.push('Expected one visible main h1, got ' + headings.length);
      const fixedHeader = headers.find(e => getComputedStyle(e).position === 'fixed');
      if (fixedHeader && headings[0] && !scrollY && headings[0].getBoundingClientRect().top < fixedHeader.getBoundingClientRect().bottom - 1) failures.push('Main h1 hidden behind fixed Header');
      const footer = document.querySelector('footer, [role="contentinfo"]');
      if (!footer || !visible(footer) || !footer.textContent.trim()) failures.push('Missing visible footer/contentinfo');
      const floatingChat = [...document.querySelectorAll('button[aria-label*="chat"], button[aria-label*="Chat"]')].find(e => visible(e) && getComputedStyle(e.parentElement).position === 'fixed');
      if (floatingChat) failures.push('Chat remains floating rather than inline in Layout');
    }
    if (outside.length) failures.push(outside.length + ' UI elements outside horizontal viewport');
    if (clipped.length) failures.push(clipped.length + ' clipped/narrow controls');
    if (unnamed.length) failures.push(unnamed.length + ' unnamed buttons/links');
    if (blocked.length) failures.push(blocked.length + ' controls blocked by floating chat');
    return { failures, docWidth, viewportWidth: innerWidth, outside, clipped, unnamed, blocked, heading: document.querySelector('main h1')?.textContent, checkedElements: targets.length,
      tableScrollers: [...document.querySelectorAll('table')].map(e => ({ table: box(e), scroller: tableScroller(e.querySelector('td') || e) && box(tableScroller(e.querySelector('td') || e)) })) };
  }, modal);
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
  await page.waitForFunction(() => ![...document.querySelectorAll('main p, main [role="status"]')].some(e => e.textContent.trim() === 'Chargement...'), null, { timeout: 5000 });
}

(async () => {
  process.chdir(ROOT);
  fs.mkdirSync(OUT, { recursive: true });
  const cache = fs.mkdtempSync('/tmp/opencode/casino-sitewide-visual-');
  let server, browser;
  try {
    // Other agents create this shared dependency. Do not substitute a fake UI.
    const core = path.join(ROOT, 'src/components/ui/PageHeader.tsx');
    const waitStarted = Date.now();
    while (!fs.existsSync(core) && Date.now() - waitStarted < 45000) await new Promise(resolve => setTimeout(resolve, 1000));
    report.coreDependency = { file: 'frontend/src/components/ui/PageHeader.tsx', available: fs.existsSync(core), waitedMs: Date.now() - waitStarted };
    const { createServer } = await import('vite');
    server = await createServer({ root: ROOT, configFile: false, envFile: false, cacheDir: cache, logLevel: 'silent',
      resolve: { alias: { '@': path.join(ROOT, 'src') } }, esbuild: { jsx: 'automatic' },
      server: { host: '127.0.0.1', port: 0, hmr: false, proxy: {} },
      optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom', 'zustand', 'lucide-react'] },
      plugins: [{ name: 'sitewide-offline-qa', enforce: 'pre',
        resolveId(id) { if (id === '/__sitewide_runtime__.tsx') return '\0sitewide-runtime.tsx'; if (id === '/@vite/client') return '\0sitewide-vite-client'; },
        load(id) {
          if (id === '\0sitewide-runtime.tsx') return runtime;
          if (id === '\0sitewide-vite-client' || id.replaceAll('\\', '/').endsWith('/vite/dist/client/client.mjs')) return offlineClient;
          if (id === path.join(ROOT, 'src/services/api.ts')) return fakeApi;
          if (/\/src\/services\/(chatSocket|pokerSocket|bingoSocket)\.ts$/.test(id)) return fakeSocket;
        },
        configureServer(vite) { vite.middlewares.use((req, res, next) => {
          const pathname = new URL(req.url, 'http://offline.invalid').pathname;
          if (pathname.startsWith('/api/') || pathname.startsWith('/socket.io')) { res.statusCode = 403; res.end('Backend traffic forbidden'); return; }
          if (!PAGES.some(p => p.route === pathname)) return next();
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated sitewide CasinoX QA</title></head><body><div id="root"></div><script type="module" src="/__sitewide_runtime__.tsx"></script></body></html>');
        }); },
      }],
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    report.isolation.origin = origin;
    browser = await chromium.launch({ headless: true });
    for (const width of WIDTHS) for (const scenario of SCENARIOS) {
      const viewport = { width, height: width === 320 ? 740 : width === 390 ? 844 : width === 768 ? 1024 : 1000 };
      const check = { id: scenario.id, route: scenario.route, role: scenario.role || 'ANONYMOUS', state: scenario.state, viewport, status: 'RUNNING', screenshots: [], errors: [], consoleErrors: [], moduleErrors: [], layouts: [], interactions: [], blockedRequests: [] };
      report.checks.push(check);
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'UTC', serviceWorkers: 'block' });
      let probing = false;
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (probing && url.origin === origin && url.pathname === '/__sitewide_probe' && request.method() === 'GET') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="fr"><title>Network isolation probe</title></html>' });
        const allowed = request.method() === 'GET' && url.origin === origin && (PAGES.some(p => p.route === url.pathname) || /^\/(src\/|node_modules\/|@|__sitewide_runtime__)/.test(url.pathname));
        if (allowed) return route.continue();
        const blocked = { url: url.href, method: request.method(), selfTest: probing };
        check.blockedRequests.push(blocked);
        if (!probing) report.isolation.unexpectedRequests.push(blocked);
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket('**/*', socket => { check.errors.push('Unexpected WebSocket: ' + socket.url()); socket.close(); });
      await context.addInitScript(fixture => {
        window.__sitewideFixture = fixture; window.__fixtureCalls = []; window.__fixtureErrors = []; window.__expectedFailures = []; window.__blockedWebSockets = [];
        localStorage.setItem('lang', 'fr');
        window.WebSocket = class { constructor(url) { window.__blockedWebSockets.push(String(url)); throw new Error('Offline QA: WebSocket forbidden'); } };
        window.Worker = window.SharedWorker = class { constructor() { window.__fixtureErrors.push('Offline QA: Worker forbidden'); throw new Error('Offline QA: Worker forbidden'); } };
        navigator.sendBeacon = url => { window.__fixtureErrors.push('Offline QA: beacon forbidden ' + url); return false; };
      }, { ...scenario, data: DATA });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      let rejectModuleLoad;
      const moduleLoadFailure = new Promise((_, reject) => { rejectModuleLoad = reject; });
      moduleLoadFailure.catch(() => {});
      page.on('response', async response => {
        if (response.status() < 400 || !new URL(response.url()).pathname.startsWith('/src/')) return;
        const detail = { url: response.url(), status: response.status() };
        try { detail.message = (await response.text()).match(/Failed to resolve import[^\n]+/)?.[0]?.slice(0, 400) || 'Module compilation failed'; } catch { detail.message = 'Module compilation failed'; }
        if (!fs.existsSync(path.join(ROOT, 'src/components/ui/PageHeader.tsx'))) detail.message += ': missing shared src/components/ui/PageHeader.tsx';
        check.moduleErrors.push(detail);
        rejectModuleLoad(new Error('Real App module failed to load: ' + detail.message));
      });
      page.on('pageerror', error => check.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && !probing) check.consoleErrors.push(message.text()); });
      const capture = async (suffix, fullPage = false) => {
        const file = path.join(OUT, `${width}-${scenario.id}-${suffix}.png`);
        await page.screenshot({ path: file, fullPage, animations: 'disabled' });
        check.screenshots.push(path.relative(path.dirname(ROOT), file));
      };
      const layout = async (label, modal = false) => check.layouts.push({ label, ...await inspect(page, modal) });
      const interaction = async (name, fn) => {
        const result = { name, status: 'RUNNING' }; check.interactions.push(result);
        try { await fn(); result.status = 'PASS'; } catch (error) { result.status = 'FAIL'; result.error = error.message; await capture('interaction-' + check.interactions.length, true).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
      };
      const must = (condition, message) => { if (!condition) throw new Error(message); };
      const called = (method, url) => page.waitForFunction(({ method, url }) => window.__fixtureCalls.some(c => c.method === method && c.url === url), { method, url });
      const keyboardModal = async (trigger, label) => {
        await trigger.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        must(await dialog.getAttribute('aria-modal') === 'true', 'Modal must be aria-modal');
        const cycle = await dialog.locator('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)').count();
        for (let i = 0; i < cycle + 2; i++) { await page.keyboard.press('Tab'); must(await dialog.evaluate(e => e.contains(document.activeElement)), 'Tab focus escaped modal'); }
        for (let i = 0; i < cycle + 2; i++) { await page.keyboard.press('Shift+Tab'); must(await dialog.evaluate(e => e.contains(document.activeElement)), 'Shift+Tab focus escaped modal'); }
        await layout(label, true); await capture(label);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        must(await trigger.evaluate(e => e === document.activeElement), 'Escape must return focus to trigger');
      };
      try {
        if (width === 320 && scenario.id === 'shop') {
          probing = true;
          await page.goto(origin + '/__sitewide_probe');
          await page.evaluate(async () => {
            await Promise.all(['/api/v1/qa-must-not-forward', 'https://example.invalid/qa-must-not-forward'].map(url => fetch(url, { method: 'POST' }).catch(() => null)));
            try { new WebSocket('ws://127.0.0.1:1/qa-must-not-forward'); } catch {}
          });
          must(check.blockedRequests.filter(r => r.selfTest).length === 2, 'HTTP isolation self-test failed');
          must(await page.evaluate(() => window.__blockedWebSockets.length) === 1, 'WebSocket isolation self-test failed');
          report.isolation.selfTest = 'PASS: local backend POST, remote POST and WebSocket blocked without forwarding';
          probing = false;
        }
        await page.goto(origin + scenario.route);
        await Promise.race([moduleLoadFailure, page.waitForFunction(() => window.__sitewideReady && document.querySelector('#root')?.textContent.trim(), null, { timeout: 15000 })]);
        await settle(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await layout('initial'); await capture('viewport'); await capture('full', true);
        const footer = page.locator('footer, [role="contentinfo"]').first();
        if (await footer.count()) {
          await footer.scrollIntoViewIfNeeded(); await layout('footer');
          check.footerVisible = await footer.evaluate(e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
          must(check.footerVisible, 'Footer cannot be reached by vertical scrolling');
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        const base = scenario.id.replace(/-(empty|error)$/, '');
        if (scenario.state === 'populated' || scenario.state === 'completed') {
          if (base === 'profile') {
            await interaction('Profile pseudo modal keyboard trap/Escape/focus return', async () => {
              const named = page.getByRole('button', { name: /Modifier le pseudo/i });
              const trigger = await named.count() ? named.first() : page.locator('main h2').first().locator('..').getByRole('button');
              await keyboardModal(trigger, 'pseudo-modal');
              await trigger.click(); await page.locator('#editPseudo').fill('PseudoModifieParFixture');
              await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click();
              await called('put', '/users/me'); await page.getByRole('dialog').waitFor({ state: 'detached' });
              must(await page.locator('main').getByText('PseudoModifieParFixture', { exact: true }).count() > 0, 'Pseudo mutation not rendered');
            });
            await interaction('Profile transactions filter uses real service parameters', async () => {
              await page.getByRole('button', { name: 'Gains', exact: true }).click();
              await page.waitForFunction(() => window.__fixtureCalls.some(c => c.url === '/economy/transactions' && c.params.filter === 'win'));
              await settle(page); await layout('transactions-filter'); await capture('transactions-filter', true);
            });
          }
          if (base === 'shop') await interaction('Shop mocked purchase and inline confirmation', async () => {
            const buy = page.getByRole('button', { name: /Achat simul[eé] :/ }).first();
            await buy.focus(); await page.keyboard.press('Enter'); await called('post', '/shop/purchase/qa-package');
            const confirmation = page.locator('main section[role="status"]'); await confirmation.waitFor();
            await page.evaluate(() => window.scrollTo(0, 0)); await layout('purchase-confirmation'); await capture('purchase-confirmation');
            must(await confirmation.innerText().then(text => /GC/.test(text)), 'Mock purchase amount missing from confirmation');
            await confirmation.getByRole('button', { name: 'Fermer', exact: true }).click(); await confirmation.waitFor({ state: 'detached' });
          });
          if (base === 'tasks-race') await interaction('Task claim is a recorded mock mutation', async () => {
            await page.getByRole('button', { name: 'Reclamer', exact: true }).or(page.getByRole('button', { name: 'Réclamer', exact: true })).first().click();
            await called('post', '/progression/tasks/qa-daily/claim'); await page.getByRole('button', { name: /R[eé]clam[eé]/, exact: true }).waitFor();
          });
          if (base === 'race-completed') await interaction('Completed race mock prize claim', async () => {
            await page.getByRole('button', { name: /R[eé]clamer .*GC/ }).click(); await called('post', '/progression/race/claim');
          });
          if (base === 'responsible-gaming') {
            await interaction('RG inputs and mock save', async () => {
              await page.locator('#depositDaily').fill('250'); await page.getByRole('button', { name: 'Enregistrer', exact: true }).first().click(); await called('put', '/responsible-gaming/deposit-limit');
              must(await page.locator('#depositDaily').inputValue() === '250', 'Saved deposit limit not rendered');
            });
            await interaction('RG self-exclusion modal keyboard and mock confirmation', async () => {
              const trigger = page.getByRole('button', { name: "S'auto-exclure", exact: true });
              await keyboardModal(trigger, 'exclusion-modal'); await trigger.click(); await page.getByRole('dialog').getByRole('button', { name: '24 heures', exact: true }).click();
              await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await called('post', '/responsible-gaming/self-exclude'); await page.getByRole('dialog').waitFor({ state: 'detached' });
            });
          }
          if (base === 'admin-dashboard') {
            await interaction('Dashboard period filter', async () => { await page.getByRole('button', { name: '7d', exact: true }).click(); await page.waitForFunction(() => window.__fixtureCalls.some(c => c.url === '/admin/dashboard' && c.params.period === '7d')); await settle(page); });
            await interaction('Dashboard recharge modal keyboard and mock mutation', async () => { const trigger = page.getByRole('button', { name: 'Recharger', exact: true }); await keyboardModal(trigger, 'recharge-modal'); await trigger.click(); await page.locator('#recharge-amount').fill('100'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await called('post', '/admin/economy/house-recharge'); });
          }
          if (base === 'admin-users') {
            await interaction('Admin user transactions modal keyboard', async () => { await keyboardModal(page.getByRole('button', { name: 'Transactions', exact: true }).first(), 'user-transactions-modal'); await called('get', '/admin/users/qa-user'); });
            await interaction('Admin user mock adjustment', async () => { await page.locator('main').getByRole('button', { name: 'Solde', exact: true }).first().click(); await page.locator('#amount').fill('100'); await page.locator('#reason').fill('QA isolee sans backend'); await layout('adjust-modal', true); await capture('adjust-modal'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await called('post', '/admin/users/qa-user/adjust-balance'); await page.getByRole('dialog').waitFor({ state: 'detached' }); });
            await interaction('Admin user search empty state', async () => { await page.locator('#search').fill('qa-no-match'); await page.getByText('Aucun utilisateur', { exact: true }).waitFor(); await layout('users-search-empty'); await capture('users-search-empty', true); await page.locator('#search').fill(''); });
          }
          if (base === 'admin-games') await interaction('Admin game config modal keyboard and mock save', async () => { const trigger = page.getByRole('button', { name: 'Configurer', exact: true }).first(); await keyboardModal(trigger, 'game-config-modal'); await trigger.click(); await page.locator('#game-min').fill('2'); await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click(); await called('put', '/admin/games/config'); });
          if (base === 'admin-economy') await interaction('Admin economy mock save', async () => { await page.locator('#economy-welcome_bonus').fill('6000'); await page.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await called('put', '/admin/settings'); });
          if (base === 'admin-settings') await interaction('Admin settings confirmation keyboard and mock save', async () => { await page.locator('#key').fill('welcome_bonus'); await page.locator('#value').fill('6000'); const trigger = page.getByRole('button', { name: 'Enregistrer', exact: true }); await keyboardModal(trigger, 'setting-modal'); await trigger.click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await called('put', '/admin/settings'); });
          if (base === 'admin-audit') await interaction('Audit action/date filters and clear', async () => { await page.locator('#audit-action').selectOption('house_recharge'); await page.locator('#audit-start').fill('2026-01-01'); await page.locator('#audit-end').fill('2026-12-31'); await page.waitForFunction(() => window.__fixtureCalls.some(c => c.url === '/admin/audit-logs' && c.params.action === 'house_recharge' && c.params.endDate === '2026-12-31')); await settle(page); await layout('audit-filter'); await capture('audit-filter', true); await page.getByRole('button', { name: 'Effacer', exact: true }).click(); });
          if (base === 'admin-chat') await interaction('Chat room filter and mocked moderation', async () => { const filter = page.getByRole('textbox', { name: 'Filtrer par salon', exact: true }); await filter.fill('qa-no-room'); await page.getByText('Aucun message', { exact: true }).waitFor(); await filter.fill(''); await settle(page); const trigger = page.getByRole('button', { name: 'Supprimer', exact: true }).first(); await keyboardModal(trigger, 'moderation-modal'); await trigger.click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await called('delete', '/admin/chat/messages/qa-message'); });
        }
        if (base === 'admin-notifications') await interaction('Announcement form mocked delivery ' + scenario.state, async () => {
          await page.locator('#title').fill('AnnonceAvecUnTitreTresLongSansEspaces'); await page.locator('#announcement-content').fill('Message de QA locale uniquement. Aucun joueur ne recevra cette annonce.'); await page.locator('#announcement-type').selectOption('promotion'); await page.getByRole('button', { name: 'Envoyer a tous les joueurs', exact: true }).or(page.getByRole('button', { name: 'Envoyer à tous les joueurs', exact: true })).click(); await called('post', '/admin/notifications');
          if (scenario.state === 'error') await page.getByRole('alert').waitFor(); else await page.locator('main [role="status"]').waitFor(); await layout('announcement-result'); await capture('announcement-result', true);
        });
        if (!scenario.role) await interaction('Anonymous auth form uses only mock transport', async () => {
          await page.locator('#email').fill(EMAIL);
          if (base !== 'reset-password') await page.locator('#password').fill('Offline-QA-not-a-real-password');
          if (base === 'register') { await page.locator('#pseudo').fill('PseudoDeFixture'); await page.locator('#birthDate').fill('1990-01-01'); }
          await page.locator('form button[type="submit"]').click(); await called('post', '/auth/' + base);
          if (base !== 'reset-password' || scenario.state === 'error') await page.getByText('Service temporairement indisponible (fixture QA isolee).', { exact: true }).waitFor();
          else await page.getByRole('status').filter({ hasText: 'Email envoye (mock uniquement)' }).waitFor();
          await layout('auth-result'); await capture('auth-result', true);
        });
        if (scenario.role === 'ADMIN' && scenario.state === 'populated' && width < 1024) await interaction('Admin menu keyboard trap/Escape/focus return/navigation', async () => {
          const menu = page.getByRole('button', { name: /menu/i }).first(); await page.evaluate(() => window.scrollTo(0, 0));
          await keyboardModal(menu, 'admin-menu'); await menu.focus(); await page.keyboard.press('Enter');
          const next = scenario.route === '/admin/users' ? '/admin/audit' : '/admin/users';
          const link = page.getByRole('dialog').locator(`a[href="${next}"]`); await link.focus(); await page.keyboard.press('Enter');
          await page.waitForURL(origin + next); await page.getByRole('dialog').waitFor({ state: 'detached' }); await settle(page); await layout('admin-navigation'); await capture('admin-navigation');
        });
        if (scenario.role === 'USER' && base === 'shop' && scenario.state === 'populated') await interaction('Real Header navigation to profile', async () => {
          await page.evaluate(() => window.scrollTo(0, 0));
          if (width < 768) { await page.locator('header button[aria-expanded]').click(); await capture('player-menu'); }
          const link = page.locator('header a[href="/profile"]').filter({ visible: true }).first(); await link.click(); await page.waitForURL(origin + '/profile'); await settle(page); await layout('player-navigation'); await capture('player-navigation');
          if (width < 768) must(await page.locator('header button[aria-expanded]').getAttribute('aria-expanded') === 'false', 'Header menu did not close after navigation');
        });
        check.fixtureCalls = await page.evaluate(() => window.__fixtureCalls);
        check.expectedFailures = await page.evaluate(() => window.__expectedFailures);
        check.errors.push(...await page.evaluate(() => [...window.__fixtureErrors, ...window.__blockedWebSockets.map(url => 'Unexpected WebSocket attempt: ' + url)]));
        if (scenario.state === 'error' && scenario.failEndpoints?.length) {
          must(check.expectedFailures.length > 0, 'Error fixture was not exercised');
          check.errorFeedback = await page.locator('main').innerText();
          if (!/erreur|indisponible|error|impossible/i.test(check.errorFeedback)) check.errors.push('Injected service error has no visible error feedback');
        }
        if (scenario.state === 'empty') { check.emptyFeedback = await page.locator('main').innerText().catch(() => ''); if (['shop-empty', 'profile-empty', 'tasks-race-empty', 'admin-users-empty', 'admin-settings-empty', 'admin-audit-empty', 'admin-chat-empty'].includes(scenario.id) && !/aucun|aucune|indisponible/i.test(check.emptyFeedback)) check.errors.push('Empty fixture has no explicit empty-state feedback'); }
        if (check.blockedRequests.some(r => !r.selfTest)) check.errors.push('Unexpected HTTP requests blocked before forwarding');
        check.status = check.layouts.some(l => l.failures.length) || check.interactions.some(i => i.status === 'FAIL') || check.errors.length || check.consoleErrors.length ? 'FAIL' : 'PASS';
      } catch (error) { check.status = 'FAIL'; check.errors.push(error.message); await capture('failure', true).catch(() => {}); }
      finally { await context.close(); save(); }
      console.log(`${check.status} ${width}px ${scenario.id}: ${[...new Set(check.layouts.flatMap(l => l.failures)), ...check.errors, ...check.interactions.filter(i => i.status === 'FAIL').map(i => i.name + ': ' + i.error)].join('; ')}`);
    }
    report.status = report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
  } catch (error) { report.status = 'FAIL'; report.fatal = error.stack; console.error(error); }
  finally {
    await browser?.close(); await server?.close(); fs.rmSync(cache, { recursive: true, force: true });
    report.finished = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: report.status, ...report.summary, manifest: path.join(OUT, 'manifest.json') }, null, 2));
    if (report.status !== 'PASS') process.exitCode = 1;
  }
})();
