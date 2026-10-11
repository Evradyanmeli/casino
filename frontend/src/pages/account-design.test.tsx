import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, type Browser, type Page } from 'playwright';
import path from 'node:path';

// Only the app shell is replaced. The pages, shared controls, visuals and CSS are real;
// every service is simulated and all backend/socket traffic is blocked.
const runtime = `
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Login from '/src/pages/LoginPage.tsx';
import Register from '/src/pages/RegisterPage.tsx';
import Reset from '/src/pages/ResetPasswordPage.tsx';
import { TransactionList as Transactions } from '/src/components/economy/TransactionList.tsx';
import { authApi } from '/src/services/auth.ts';
import { userApi } from '/src/services/user.ts';
import { economyApi } from '/src/services/economy.ts';
import { progressionApi } from '/src/services/progression.ts';
import { rgApi } from '/src/services/responsibleGaming.ts';
import { useAuthStore } from '/src/store/authStore.ts';
import { useBalanceStore } from '/src/store/balanceStore.ts';
import i18n from '/src/i18n/config.ts';
import '/src/index.css';
await i18n.changeLanguage('fr');
const t = window.accountTest = { calls: [], root: null, route: '/' };
t.session = () => ({ user: useAuthStore.getState().user, balance: useBalanceStore.getState().balance });
const fail = text => ({ response: { status: 503, data: { error: text } } });
const read = (key, value) => { if (t.errors[key]) throw fail(t.errors[key]); return value; };
userApi.getStats = async () => read('stats', t.stats);
progressionApi.getLevelProgress = async () => read('progress', t.progress);
economyApi.getTransactions = async filter => {
  t.calls.push(['transactions', filter]);
  if (t.deferTransactions && filter === 'deposit') return new Promise(resolve => { t.resolveDeposit = resolve; });
  return read('transactions', { transactions: t.transactions.filter(tx => !filter || tx.type === filter) });
};
userApi.updateProfile = async data => {
  t.calls.push(['pseudo', data]); read('pseudo', null);
  return { ...useAuthStore.getState().user, ...data };
};
authApi.resetPassword = async email => { t.calls.push(['reset', email]); throw fail('Reinitialisation indisponible (503)'); };
const auth = (kind, data) => {
  t.calls.push([kind, data]);
  return new Promise((resolve, reject) => {
    t.resolveAuth = () => resolve({ user: t.user, accessToken: 'fixture-access', refreshToken: 'fixture-refresh' });
    t.rejectAuth = () => reject(fail('Connexion indisponible'));
  });
};
authApi.login = data => auth('login', data);
authApi.register = data => auth('register', data);
rgApi.getSettings = async () => read('rg', t.settings);
rgApi.updateDepositLimit = async (...values) => { t.calls.push(['depositLimit', ...values]); read('saveRg', null); };
rgApi.updateLossLimit = async (...values) => { t.calls.push(['lossLimit', ...values]); read('saveRg', null); };
rgApi.updateSessionLimit = async minutes => { t.calls.push(['sessionLimit', minutes]); read('saveRg', null); };
rgApi.enableRealityCheck = async minutes => { t.calls.push(['reminder', minutes]); read('saveRg', null); t.settings.realityCheck = { enabled: true, intervalMinutes: minutes }; };
rgApi.setSelfExclusion = async days => { t.calls.push(['exclude', days]); read('saveRg', null); t.settings.selfExclusion = { enabled: true, until: '2030-01-01' }; };
rgApi.cancelSelfExclusion = async () => { t.calls.push(['cancelExclude']); read('saveRg', null); t.settings.selfExclusion = { enabled: false }; };
function RouteObserver() { const location = useLocation(); useEffect(() => { t.route = location.pathname; }, [location]); return null; }
t.mount = async (kind, options = {}) => {
  if (t.root) t.root.unmount();
  localStorage.clear();
  Object.assign(t, {
    calls: [], errors: {}, deferTransactions: false,
    user: { id: 'fixture', pseudo: 'Camille NomTresLongSansSeparateur'.repeat(3), email: 'adresse.email.extremement.longue'.repeat(4) + '@example.test', xp: 1234, level: 7, role: 'USER', balance: 123456789012345 },
    stats: { totalSessions: 123, totalWins: 31, winRate: '25.20', biggestWin: '9007199254740993', totalSpent: '123456789012345678' },
    progress: { xp: 1234, level: 7, xpInCurrentLevel: 234, xpForNextLevel: 500, progressPercent: 46.8 },
    transactions: [{ id: 'a', type: 'win', amount: 123456789012345, description: 'DescriptionDeTransactionTresLongue'.repeat(5), createdAt: '2026-10-01T12:00:00Z' }, { id: 'b', type: 'bet', amount: -500, createdAt: '2026-10-01T11:00:00Z' }],
    settings: { depositLimit: { enabled: true, daily: 100 }, lossLimit: { enabled: false }, sessionLimit: { enabled: true, minutes: 30 }, realityCheck: { enabled: true, intervalMinutes: 30 }, selfExclusion: { enabled: false } },
  }, options);
  useAuthStore.setState({ user: t.user, isAuthenticated: true, isLoading: false });
  useBalanceStore.setState({ balance: t.user.balance });
  const Component = kind === 'Profile' ? (await import('/src/pages/ProfilePage.tsx')).default : kind === 'ResponsibleGaming' ? (await import('/src/components/rg/ResponsibleGamingPage.tsx')).default : { Login, Register, Reset, Transactions }[kind];
  t.root = createRoot(document.getElementById('root'));
  t.root.render(React.createElement(MemoryRouter, { initialEntries: ['/fixture'] }, React.createElement(RouteObserver), React.createElement(Component)));
  await new Promise(resolve => setTimeout(resolve, 60));
};
`;

let server: ViteDevServer;
let browser: Browser;
let origin: string;
const blocked: string[] = [];

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    resolve: { alias: [
      { find: '@/components/layout/Layout', replacement: '\0account-layout' },
      { find: '@', replacement: path.resolve(process.cwd(), 'src') },
    ] },
    plugins: [react(), {
      name: 'account-design-fixture',
      resolveId: id => id === '/__account_runtime__.js' ? '\0account-runtime' : id === '\0account-layout' ? id : undefined,
      load: id => id === '\0account-runtime' ? runtime : id === '\0account-layout' ? `import React from 'react'; export default function Layout({children}) { return React.createElement('main', { className: 'player-shell min-h-screen p-3 sm:p-6' }, React.createElement('div', { className: 'max-w-7xl mx-auto min-w-0' }, children)); }` : undefined,
      configureServer: vite => {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== '/__account__.html') return next();
          res.setHeader('Content-Type', 'text/html');
          void vite.transformIndexHtml('/__account__.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__account_runtime__.js"></script></body></html>').then(html => res.end(html)).catch(next);
        });
      },
    }],
    optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom', 'zustand', 'lucide-react', 'axios', 'i18next', 'react-i18next'] },
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Account fixture did not start');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const warmup = await browser.newPage();
  try {
    await warmup.goto(`${origin}/__account__.html`);
    await warmup.waitForFunction(() => !!(window as any).accountTest?.mount, undefined, { timeout: 20000 });
  } finally { await warmup.close(); }
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  expect(blocked).toEqual([]);
});

async function mount(kind: string, options: unknown = {}, width = 320): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.route(/\/(api|socket\.io)\//, route => { blocked.push(route.request().url()); return route.abort(); });
  await page.goto(`${origin}/__account__.html`);
  await page.waitForFunction(() => !!(window as any).accountTest?.mount);
  await page.evaluate(async ({ kind, options }) => (window as any).accountTest.mount(kind, options), { kind, options });
  return page;
}

describe('Premium account design', () => {
  it.each([320, 768, 1440])('fits authentication screens at %ipx with compact mobile artwork', async width => {
    const page = await mount('Login', {}, width);
    try {
      for (const kind of ['Login', 'Register', 'Reset']) {
        await page.evaluate(async kind => (window as any).accountTest.mount(kind), kind);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), kind).toBe(true);
        const shortTargets = await page.locator('#root button, #root a, #root input').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.getBoundingClientRect().height < 44).map(el => el.textContent));
        expect(shortTargets, kind).toEqual([]);
        expect(await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Georgia');
        expect(await page.locator('.casino-stage .playing-card').count()).toBeGreaterThan(0);
        if (width === 320) expect((await page.locator('.casino-stage').boundingBox())!.height).toBeLessThan(200);
        if (process.env.ACCOUNT_SCREENSHOTS) await page.screenshot({ path: `/tmp/opencode/account-${kind}-${width}.png`, fullPage: true });
      }
    } finally { await page.close(); }
  });

  it.each([320, 768, 1440])('fits profile, RG and long transaction values at %ipx', async width => {
    const page = await mount('Profile', {}, width);
    try {
      for (const kind of ['Profile', 'ResponsibleGaming', 'Transactions']) {
        await page.evaluate(async kind => (window as any).accountTest.mount(kind), kind);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), kind).toBe(true);
        const shortTargets = await page.locator('#root button, #root a, #root input').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.getBoundingClientRect().height < 44).map(el => el.textContent));
        expect(shortTargets, kind).toEqual([]);
        if (process.env.ACCOUNT_SCREENSHOTS) await page.screenshot({ path: `/tmp/opencode/account-${kind}-${width}.png`, fullPage: true });
      }
    } finally { await page.close(); }
  });

  it('shows only loaded profile figures, exact GC amounts and honest pseudo editing', async () => {
    const page = await mount('Profile');
    try {
      expect(await page.locator('.casino-kpi').count()).toBe(5);
      expect(await page.getByText('25.20%', { exact: true }).count()).toBe(1);
      const expected = await page.evaluate(() => BigInt('9007199254740993').toLocaleString('fr') + ' GC');
      expect(await page.getByText(expected, { exact: true }).count()).toBe(1);
      expect(await page.getByText('Retour brut, pas le profit net').count()).toBe(1);
      await page.getByRole('button', { name: 'Modifier le pseudo' }).click();
      await page.locator('#editPseudo').fill('Nouveau pseudo');
      await page.evaluate(() => { (window as any).accountTest.errors.pseudo = 'Pseudo indisponible'; });
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await page.getByRole('alert').getByText('Pseudo indisponible').waitFor();
      expect(await page.getByRole('dialog').count()).toBe(1);
      await page.evaluate(() => { delete (window as any).accountTest.errors.pseudo; });
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await page.getByRole('heading', { name: 'Nouveau pseudo' }).waitFor();
    } finally { await page.close(); }
  });

  it('replaces failed profile loads with retryable errors, not fake zero figures', async () => {
    const page = await mount('Profile', { errors: { stats: 'Statistiques indisponibles', progress: 'Progression indisponible' } });
    try {
      expect(await page.getByRole('alert').count()).toBe(2);
      expect(await page.locator('.casino-kpi').count()).toBe(0);
      expect(await page.locator('.animate-pulse').count()).toBe(0);
      await page.evaluate(() => { (window as any).accountTest.errors = {}; });
      await page.getByRole('button', { name: 'Réessayer' }).first().click();
      await page.getByRole('progressbar').waitFor();
      expect(await page.locator('.casino-kpi').count()).toBe(5);
    } finally { await page.close(); }
  });

  it('distinguishes failed history from an empty history and ignores stale filters', async () => {
    const page = await mount('Transactions', { errors: { transactions: 'Historique indisponible' } });
    try {
      expect(await page.getByRole('alert').textContent()).toContain('Historique indisponible');
      expect(await page.getByText('Aucune transaction', { exact: true }).count()).toBe(0);
      await page.evaluate(() => { (window as any).accountTest.errors = {}; });
      await page.getByRole('button', { name: 'Réessayer' }).click();
      await page.locator('article').first().waitFor();
      expect(await page.getByText('Gains (bruts)', { exact: true }).count()).toBe(1);
      await page.evaluate(() => { (window as any).accountTest.deferTransactions = true; });
      await page.getByRole('button', { name: 'Dépôts', exact: true }).click();
      await page.getByRole('button', { name: 'Mises', exact: true }).click();
      await page.locator('article').first().waitFor();
      await page.evaluate(() => (window as any).accountTest.resolveDeposit({ transactions: [] }));
      expect(await page.locator('article').count()).toBe(1);
      expect(await page.locator('article').textContent()).toContain('-500');
    } finally { await page.close(); }
  });

  it.each(['USER', 'ADMIN'])('preserves login token, balance and %s redirect workflows', async role => {
    const page = await mount('Login');
    try {
      expect(await page.getByRole('button', { name: /Google/ }).isDisabled()).toBe(true);
      await page.locator('#email').fill('fixture@example.test');
      await page.locator('#password').fill('fixture-password');
      await page.evaluate(role => { (window as any).accountTest.user.role = role; }, role);
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
      expect(await page.getByRole('button', { name: /Chargement/ }).isDisabled()).toBe(true);
      await page.evaluate(() => (window as any).accountTest.resolveAuth());
      await page.waitForFunction(route => (window as any).accountTest.route === route, role === 'ADMIN' ? '/admin' : '/lobby');
      expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('fixture-access');
      expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('fixture-refresh');
      expect(await page.evaluate(() => (window as any).accountTest.session().balance)).toBe(123456789012345);
      expect(await page.evaluate(() => (window as any).accountTest.session().user.role)).toBe(role);
    } finally { await page.close(); }
  });

  it('keeps registration validation and session initialization without creating an account', async () => {
    const page = await mount('Register');
    try {
      expect(await page.getByRole('button', { name: /Google/ }).isDisabled()).toBe(true);
      await page.locator('#pseudo').fill('Fixture');
      await page.locator('#email').fill('fixture@example.test');
      await page.locator('#password').fill('fixture-password');
      await page.locator('#birthDate').fill('2020-01-01');
      expect(await page.getByRole('button', { name: 'Créer mon compte', exact: true }).isDisabled()).toBe(true);
      expect(await page.evaluate(() => (window as any).accountTest.calls.length)).toBe(0);
      await page.locator('#birthDate').fill('1990-01-01');
      await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
      await page.evaluate(() => (window as any).accountTest.resolveAuth());
      await page.waitForFunction(() => (window as any).accountTest.route === '/lobby');
      expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('fixture-refresh');
      expect(await page.evaluate(() => (window as any).accountTest.session().balance)).toBe(123456789012345);
    } finally { await page.close(); }
  });

  it('presents reset 503 honestly without claiming an email was sent', async () => {
    const page = await mount('Reset');
    try {
      expect(await page.getByText(/Aucun email ne peut etre envoye/).count()).toBe(1);
      await page.locator('#email').fill('fixture@example.test');
      await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain('503');
      expect(await page.getByText('Un email de réinitialisation vous a été envoyé', { exact: true }).count()).toBe(0);
      expect(await page.locator('#email').isVisible()).toBe(true);
    } finally { await page.close(); }
  });

  it('keeps RG help accessible on failure and requires an explicit exclusion duration', async () => {
    const page = await mount('ResponsibleGaming', { errors: { rg: 'Reglages indisponibles' } });
    try {
      expect(await page.locator('input').count()).toBe(0);
      expect(await page.getByRole('link', { name: 'Joueurs Info Service' }).count()).toBe(1);
      await page.evaluate(() => { (window as any).accountTest.errors = {}; });
      await page.getByRole('button', { name: 'Réessayer' }).click();
      await page.getByRole('button', { name: "S'auto-exclure", exact: true }).click();
      expect(await page.getByRole('button', { name: 'Confirmer', exact: true }).isDisabled()).toBe(true);
      await page.getByRole('button', { name: '7 jours', exact: true }).click();
      expect(await page.getByRole('button', { name: '7 jours', exact: true }).getAttribute('aria-pressed')).toBe('true');
      await page.evaluate(() => { (window as any).accountTest.errors.saveRg = 'Exclusion indisponible'; });
      await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
      await page.getByRole('dialog').getByRole('alert').waitFor();
      expect(await page.getByRole('dialog').count()).toBe(1);
      await page.evaluate(() => { delete (window as any).accountTest.errors.saveRg; });
      await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
      await page.getByText(/Vous êtes en auto-exclusion/).waitFor();
      expect(await page.getByRole('dialog').count()).toBe(0);
    } finally { await page.close(); }
  });
});
