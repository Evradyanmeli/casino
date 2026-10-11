import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import path from 'node:path';

const fixture = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import ShopPage from '/src/components/shop/ShopPage.tsx';
  import TasksPage from '/src/pages/TasksPage.tsx';
  import { RaceLeaderboard } from '/src/components/progression/RaceLeaderboard.tsx';
  import '/src/index.css';
  const Component = { shop: ShopPage, tasks: TasksPage, race: RaceLeaderboard }[new URLSearchParams(location.search).get('view')];
  createRoot(document.getElementById('root')).render(React.createElement(Component));
`;

const progressionTransport = `
  const read = key => Promise.resolve(window.__data[key]);
  const claim = kind => {
    window.__claims.push(kind);
    return new Promise((resolve, reject) => {
      window.__resolveClaim = () => resolve({ xp: 50, coins: 200, prize: 303, newLevel: 4 });
      window.__rejectClaim = () => reject(new Error('mock claim failure'));
    });
  };
  export const progressionApi = {
    getTasks: () => read('tasks'), getBadges: () => read('badges'), getMyBadges: () => read('earned'),
    getLevelProgress: () => { window.__levelReads++; return read('level'); },
    getRace: () => read('race'), getLeaderboard: () => read('entries'), getMyRank: () => read('rank'),
    claimTask: id => claim(id), claimRacePrize: () => claim('race')
  };
`;

let server: ViteDevServer;
let browser: Browser;
let base: string;

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), configFile: false,
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    server: { port: 0, host: '127.0.0.1' },
    plugins: [{
      name: 'commerce-design-fixture', enforce: 'pre',
      resolveId(id) {
        if (id === '/__commerce_fixture__.tsx') return id;
        if (id.endsWith('/components/ui/PageHeader')) return '\0commerce-page-header';
      },
      load(id) {
        if (id === '/__commerce_fixture__.tsx') return fixture;
        // Shared layout/header are outside this task; the owned components and all artwork are real.
        if (id === '\0commerce-page-header') return `import React from 'react'; export default function PageHeader(p) { return React.createElement('header', { className: 'flex flex-wrap gap-4' }, React.createElement('div', { className: 'min-w-0 flex-1 basis-48' }, React.createElement('p', null, p.eyebrow), React.createElement('h1', { className: 'casino-title break-words' }, p.title), React.createElement('p', null, p.description)), p.children); }`;
        if (id.endsWith('/src/components/layout/Layout.tsx')) return `import React from 'react'; export default function Layout({children}) { return React.createElement('main', {className: 'mx-auto max-w-7xl p-4 sm:p-6'}, children); }`;
        if (id.endsWith('/src/services/progression.ts')) return progressionTransport;
        if (id.endsWith('/src/services/shop.ts')) return `export const shopApi = {
          getPackages: () => window.__data.packageError ? Promise.reject(new Error('mock load failure')) : Promise.resolve(window.__data.packages),
          purchase: id => { window.__purchases.push(id); return new Promise((resolve, reject) => {
            window.__resolvePurchase = () => resolve({ tokensAwarded: 12666, newBalance: 15000 });
            window.__rejectPurchase = () => reject({ response: { data: { error: 'Offre temporairement indisponible' } } });
          }); }
        };`;
        if (id.endsWith('/src/store/balanceStore.ts')) return `const state = { balance: 2345, setBalance: value => { window.__balance = value; }, syncBalance: () => window.__syncError ? Promise.reject(new Error('mock sync failure')) : Promise.resolve() }; export const useBalanceStore = Object.assign(() => state, { getState: () => state });`;
        if (id.endsWith('/src/store/authStore.ts')) return `export const useAuthStore = () => ({ user: { id: 'me' } });`;
      },
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith('/__commerce_test__')) { next(); return; }
          response.setHeader('Content-Type', 'text/html');
          response.end('<html><body style="margin:0;background:#0a1422"><div id="root"></div><script type="module" src="/__commerce_fixture__.tsx"></script></body></html>');
        });
      },
    }],
  });
  await server.listen();
  base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`;
  browser = await chromium.launch({ headless: true });
}, 30000);

afterAll(async () => { await browser?.close(); await server?.close(); });

function data() {
  const now = Date.now();
  const task = (id: string, completed: boolean, claimed = false) => ({
    id, userId: 'me', taskId: id, progress: completed ? 3 : 1, completed, claimed,
    expiresAt: new Date(now + 86400000).toISOString(),
    task: { title: id, description: 'Jouez trois parties pour progresser.', condition: { action: 'play_game', count: 3 }, reward: { xp: 50, coins: 200 } },
  });
  return {
    packages: [{ id: 'a', name: 'Champagne', tokens: 12345, bonus: 321, price: 249, popular: true }, { id: 'b', name: 'Felt', tokens: 1000, price: 99 }],
    tasks: { daily: [task('Mission prête', true), task('Mission reçue', true, true), task('Mission en cours', false)], weekly: [task('Mission hebdomadaire', true)] },
    level: { level: 4, xp: 350, xpInCurrentLevel: 50, xpForNextLevel: 200, progressPercent: 25 },
    badges: [
      { id: 'earned', name: 'Habitué', category: 'game', slug: 'games_10', description: 'Description', icon: 'EMOJI_MUST_NOT_RENDER', condition: { type: 'games_played', count: 10 }, xpReward: 100 },
      { id: 'locked', name: 'Expert', category: 'game', slug: 'level_10', description: 'Description', icon: 'EMOJI_MUST_NOT_RENDER', condition: { type: 'level_reached', level: 10 }, xpReward: 500 },
    ],
    earned: [{ badgeId: 'earned' }],
    race: { id: 'r', name: 'Course hebdomadaire', status: 'active', startAt: new Date(now - 86400000).toISOString(), endAt: new Date(now + 86400000).toISOString(), prize: { '1': 701, '2': 303, '3': 105, '4_10': 22 } },
    entries: ['alice', 'me', 'charlie', 'bob'].map((id, index) => ({ id, raceId: 'r', userId: id, xp: 500 - index * 100, rank: null as number | null, prize: 0, claimed: false, user: { id, pseudo: id, avatar: null } })),
    rank: { rank: 2, xp: 400, prize: 303 },
  };
}

async function open(view: string, input = data(), width = 390, clock = false): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 844 }, locale: 'en-US' });
  if (clock) await page.clock.install({ time: new Date() });
  await page.addInitScript(payload => Object.assign(window, { __data: payload, __claims: [], __purchases: [], __levelReads: 0 }), input);
  // No tests may reach a real API, even if an import accidentally escapes a mock.
  await page.route('**/api/**', route => route.abort());
  await page.goto(`${base}/__commerce_test__?view=${view}`);
  await page.locator(view === 'shop' ? 'article' : view === 'tasks' ? '[aria-label="Progression du niveau"]' : '[aria-label="Podium"]').first().waitFor();
  expect(await page.evaluate(() => (window as any).__purchases.length + (window as any).__claims.length)).toBe(0);
  return page;
}

describe('Premium commerce and progression', () => {
  it('keeps base, bonus, total and simulated price exact and serializes purchases', async () => {
    const page = await open('shop');
    try {
      const offer = page.locator('article').first();
      expect(await offer.textContent()).toContain('12,666');
      expect(await offer.textContent()).toContain('12,345 GC');
      expect(await offer.textContent()).toContain('+321 GC');
      expect(await offer.textContent()).toContain('€2.49');
      expect(await page.locator('body').textContent()).toContain('Achat SIMULÉ');
      expect(await page.locator('body').textContent()).not.toMatch(/discount|réduction|économisez/i);
      await page.getByRole('button', { name: 'Achat simulé : Champagne' }).click();
      expect(await page.getByRole('button', { name: 'Achat simulé : Felt' }).isDisabled()).toBe(true);
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('article button'));
        buttons.forEach(button => { button.disabled = false; button.click(); });
      });
      expect(await page.evaluate(() => (window as any).__purchases)).toEqual(['a']);
      await page.evaluate(() => (window as any).__resolvePurchase());
      await page.getByText('Achat simulé confirmé', { exact: true }).waitFor();
      expect(await page.evaluate(() => (window as any).__balance)).toBe(15000);
      expect(await page.getByRole('status').textContent()).toContain('12,666 GC');
    } finally { await page.close(); }
  });

  it('shows purchase and package loading failures rather than a false success', async () => {
    const page = await open('shop');
    try {
      await page.getByRole('button', { name: 'Achat simulé : Champagne' }).click();
      await page.evaluate(() => (window as any).__rejectPurchase());
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain('Offre temporairement indisponible');
      expect(await page.getByRole('button', { name: 'Achat simulé : Felt' }).isEnabled()).toBe(true);
      await page.evaluate(() => { (window as any).__data.packageError = true; });
      // Re-initialize with a rejected GET; no purchasing request is made.
      await page.addInitScript(() => { (window as any).__data.packageError = true; });
      await page.reload();
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain('Impossible de charger les offres');
    } finally { await page.close(); }
  });

  it('distinguishes task claim states and preserves XP notifications after a confirmed claim', async () => {
    const page = await open('tasks');
    try {
      expect(await page.getByRole('button', { name: 'Récompense reçue : Mission reçue' }).isDisabled()).toBe(true);
      expect(await page.getByRole('button', { name: 'Réclamer : Mission en cours' }).isDisabled()).toBe(true);
      expect(await page.getByLabel('Progression : Mission en cours').getAttribute('aria-valuenow')).toBe('33.33333333333333');
      await page.getByRole('button', { name: 'Réclamer : Mission prête' }).click();
      expect(await page.getByRole('button', { name: 'Réclamer : Mission hebdomadaire' }).isDisabled()).toBe(true);
      await page.evaluate(() => { (window as any).__syncError = true; (window as any).__resolveClaim(); });
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain('Récompense reçue');
      expect(await page.getByRole('button', { name: 'Récompense reçue : Mission prête' }).isDisabled()).toBe(true);
      expect(await page.evaluate(() => (window as any).__levelReads)).toBeGreaterThan(1);
      expect(await page.evaluate(() => (window as any).__claims)).toEqual(['Mission prête']);
    } finally { await page.close(); }
  });

  it('keeps task claim errors visible alongside the existing task cards', async () => {
    const page = await open('tasks');
    try {
      await page.getByRole('button', { name: 'Réclamer : Mission prête' }).click();
      await page.evaluate(() => (window as any).__rejectClaim());
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('button', { name: 'Réclamer : Mission prête' }).isEnabled()).toBe(true);
      expect(await page.getByRole('heading', { name: 'Mission en cours' }).count()).toBe(1);
    } finally { await page.close(); }
  });

  it('uses backend rank order, identity and exact/range prize definitions', async () => {
    const page = await open('race');
    try {
      expect(await page.locator('[data-rank]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-rank')))).toEqual(['1', '2', '3']);
      expect(await page.locator('[aria-label="Podium"] [data-current-user="true"]').textContent()).toContain('me(vous)');
      expect(await page.locator('[aria-label="Tous les rangs affichés"] li').last().textContent()).toContain('22 GC');
      expect(await page.locator('[data-rank="1"]').textContent()).toContain('701 GC');
      expect(await page.getByRole('button', { name: /Réclamer/ }).count()).toBe(0);
    } finally { await page.close(); }
  });

  it('does not advertise a current prize after expiry or invent a finalized prize', async () => {
    const input = data();
    input.race.endAt = new Date(Date.now() - 1000).toISOString();
    const page = await open('race', input);
    try {
      expect(await page.locator('body').textContent()).toContain('classement en attente');
      expect(await page.locator('body').textContent()).not.toContain('303 GC');
      expect(await page.locator('[aria-label="Podium"]').textContent()).not.toContain('GC');
      expect(await page.getByRole('button', { name: /Réclamer/ }).count()).toBe(0);
    } finally { await page.close(); }
  });

  it('expires an active race using its actual end time without a fabricated countdown', async () => {
    const input = data();
    input.race.endAt = new Date(Date.now() + 60000).toISOString();
    const page = await open('race', input, 390, true);
    try {
      await page.clock.runFor(61000);
      await page.getByText('Course clôturée · classement en attente', { exact: true }).waitFor();
      expect(await page.locator('body').textContent()).not.toContain('303 GC');
    } finally { await page.close(); }
  });

  it('uses finalized entry awards and does not re-enable a confirmed race claim after wallet sync failure', async () => {
    const input = data();
    input.race.status = 'completed';
    input.race.endAt = new Date(Date.now() - 1000).toISOString();
    input.entries.forEach((entry, index) => { entry.rank = index + 1; entry.prize = 711 - index; });
    const page = await open('race', input);
    try {
      expect(await page.locator('[data-rank="1"]').textContent()).toContain('711 GC');
      expect(await page.locator('[data-rank="1"]').textContent()).not.toContain('701 GC');
      await page.getByRole('button', { name: 'Réclamer 303 GC' }).click();
      expect(await page.getByRole('button', { name: 'Réclamation en cours…' }).isDisabled()).toBe(true);
      await page.evaluate(() => { (window as any).__syncError = true; (window as any).__resolveClaim(); });
      await page.getByRole('alert').waitFor();
      expect(await page.locator('body').textContent()).toContain('Prix réclamé.');
      expect(await page.getByRole('button', { name: /Réclamer/ }).count()).toBe(0);
    } finally { await page.close(); }
  });

  it('shows race claim failures and respects an already claimed entry', async () => {
    const input = data();
    input.race.status = 'completed';
    input.race.endAt = new Date(Date.now() - 1000).toISOString();
    const page = await open('race', input);
    try {
      await page.getByRole('button', { name: 'Réclamer 303 GC' }).click();
      await page.evaluate(() => (window as any).__rejectClaim());
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain('non confirmée');
      expect(await page.getByRole('button', { name: 'Réclamer 303 GC' }).isEnabled()).toBe(true);
      await page.evaluate(() => { (window as any).__data.entries[1].claimed = true; });
      await page.getByRole('button', { name: 'Actualiser la course' }).click();
      await page.getByText('Prix réclamé.', { exact: true }).waitFor();
      expect(await page.getByRole('button', { name: /Réclamer/ }).count()).toBe(0);
    } finally { await page.close(); }
  });

  it('renders earned and locked medals with actual visible requirements, not emoji or hover-only descriptions', async () => {
    const page = await open('tasks');
    try {
      const earned = page.locator('[data-earned="true"]');
      const locked = page.locator('[data-earned="false"]');
      expect(await earned.textContent()).toContain('Obtenu');
      expect(await earned.textContent()).toContain('Jouer 10 parties.');
      expect(await locked.textContent()).toContain('Verrouillé');
      expect(await locked.textContent()).toContain('Atteindre le niveau 10.');
      expect(await page.locator('body').textContent()).not.toContain('EMOJI_MUST_NOT_RENDER');
      expect(await earned.locator('svg').count()).toBeGreaterThan(0);
    } finally { await page.close(); }
  });

  it.each([320, 390, 768, 1440])('fits %ipx with long labels and numbers and keeps owned controls at least 44px', async width => {
    const input = data();
    input.packages[0].name = 'Champagne'.repeat(12);
    input.packages[0].tokens = 2147483647;
    input.tasks.daily[0].task.title = 'Objectif'.repeat(18);
    input.badges[0].name = 'Distinction'.repeat(12);
    input.entries[1].user.pseudo = 'CasinoPlayer'.repeat(15);
    input.level.xp = 2147483647;
    for (const view of ['shop', 'tasks']) {
      const page = await open(view, input, width);
      try {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('main button').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44))).toBe(true);
      } finally { await page.close(); }
    }
  });
});
