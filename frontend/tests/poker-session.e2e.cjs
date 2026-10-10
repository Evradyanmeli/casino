const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const BASE = process.env.CASINO_QA_URL;
assert.ok(BASE, 'Set CASINO_QA_URL to an isolated test instance; this test creates accounts and transactions.');
const run = Date.now();
const OUT = path.resolve(__dirname, '../../reports/poker-session-regression', String(run));
const report = { target: BASE, started: new Date().toISOString(), checks: [], errors: [], accounts: [] };
fs.mkdirSync(OUT, { recursive: true });
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (fn()) return; await sleep(30); }
  throw Error(message);
}
async function check(id, fn) {
  try { const detail = await fn(); report.checks.push({ id, status: 'PASS', detail: detail ?? null }); }
  catch (error) { report.checks.push({ id, status: 'FAIL', error: error.message }); save(); throw error; }
  save();
}
async function api(actor, endpoint) {
  const response = await actor.page.request.get(`${BASE}/api/v1${endpoint}`, { headers: { Authorization: `Bearer ${actor.token}` } });
  assert.equal(response.status(), 200, `${endpoint} HTTP ${response.status()}`);
  return response.json();
}
async function balance(actor) { return Number((await api(actor, '/economy/balance')).balance); }
async function transactions(actor) { return (await api(actor, '/economy/transactions?limit=100')).transactions; }
async function screenshot(actor, name) { await actor.page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }); }

async function register(browser, letter) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const actor = { context, page, state: null, tables: [], updates: [] };
  page.on('pageerror', error => report.errors.push({ actor: letter, error: error.message }));
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    if (typeof payload !== 'string' || !/^4[23]\/poker,/.test(payload)) return;
    try {
      const data = JSON.parse(payload.slice(payload.indexOf('[')));
      if (data[0] === 'poker:game-update' && data[1]?.table) {
        actor.state = data[1]; actor.updates.push({ tableId: data[1].table.id, phase: data[1].table.phase });
      } else if (data[0] === 'poker:session-ended' && actor.state?.table.id === data[1].tableId) actor.state = null;
      else if (data[0] === 'poker:tables-update') actor.tables = data[1];
      else if (data[0]?.success) {
        if (Object.hasOwn(data[0], 'state')) actor.state = data[0].state;
        if (data[0].tables) actor.tables = data[0].tables;
      }
    } catch {}
  }));
  const email = `qa-poker-${letter}-${run}@demo.com`;
  const response = await page.request.post(`${BASE}/api/v1/auth/register`, { data: {
    email, pseudo: `QaPoker${letter}${String(run).slice(-8)}`, password: crypto.randomUUID(), birthDate: '1990-01-01',
  } });
  assert.equal(response.status(), 201, 'Standard QA registration must succeed');
  const login = await response.json();
  actor.id = login.user.id; actor.token = login.accessToken;
  await page.goto(`${BASE}/login`);
  await page.evaluate(tokens => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }, { accessToken: login.accessToken, refreshToken: login.refreshToken });
  await page.goto(`${BASE}/game-poker`);
  await page.getByRole('button', { name: 'Jouer vs Bots', exact: true }).waitFor();
  await waitFor(() => actor.tables.length === 5, 'Five shared tables must be available');
  await page.getByRole('button', { name: 'Jouer vs Bots', exact: true }).click({ trial: true });
  const initial = await balance(actor);
  assert.ok(initial >= 600, 'QA needs at least 600 virtual GC');
  report.accounts.push({ email, id: actor.id, initialBalance: initial });
  actor.initial = initial;
  return actor;
}
async function start(actor, amount = 200, twice = false) {
  actor.state = null;
  await actor.page.getByRole('spinbutton').first().fill(String(amount));
  const button = actor.page.getByRole('button', { name: 'Jouer vs Bots', exact: true });
  if (twice) await button.evaluate(element => { element.click(); element.click(); });
  else await button.click();
  await waitFor(() => actor.state?.table.mode === 'bots', 'Private bot session must start');
  await actor.page.getByRole('button', { name: 'Quitter', exact: true }).waitFor();
  return actor.state.table.id;
}
async function quit(actor) {
  await actor.page.getByRole('button', { name: 'Quitter', exact: true }).click();
  await actor.page.getByRole('button', { name: 'Jouer vs Bots', exact: true }).waitFor();
  await actor.page.getByRole('button', { name: 'Jouer vs Bots', exact: true }).click({ trial: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let a, b, socket, rpc;
  try {
    await check('REGISTER-TWO-QA', async () => { a = await register(browser, 'A'); b = await register(browser, 'B'); return { ids: [a.id, b.id] }; });
    await check('INVALID-BUYIN-NO-DEBIT', async () => {
      await a.page.getByRole('spinbutton').first().fill('1500');
      assert.equal(await a.page.getByRole('button', { name: 'Jouer vs Bots', exact: true }).isDisabled(), true);
      assert.equal(await balance(a), a.initial);
    });
    let first, other, second;
    await check('START-ISOLATED-SESSIONS', async () => {
      first = await start(a); other = await start(b);
      assert.notEqual(first, other);
      for (const actor of [a, b]) {
        assert.equal(actor.state.players.filter(p => p.isBot).length, 3);
        assert.deepEqual(actor.state.players.filter(p => !p.isBot).map(p => p.userId), [actor.id]);
        assert.equal(await balance(actor), actor.initial - 200);
        assert.ok(actor.tables.every(t => t.playerCount === 0));
      }
      await screenshot(a, 'private-session-a'); await screenshot(b, 'private-session-b');
      return { first, other };
    });
    await check('RAISE-EXIT-FINANCIAL-SETTLEMENT', async () => {
      await a.page.getByRole('spinbutton').fill('40');
      await a.page.getByRole('button', { name: 'Relancer', exact: true }).click();
      await waitFor(() => a.state?.players.find(p => p.userId === a.id)?.totalBet === 40, 'Raise must be acknowledged');
      await quit(a);
      assert.equal(await balance(a), a.initial - 40);
      const tx = await transactions(a);
      assert.equal(tx.filter(t => t.type === 'poker_cashout').length, 1);
      assert.equal(tx.find(t => t.type === 'poker_cashout').amount, 160);
      assert.ok(tx.filter(t => t.type === 'poker_buyin').every(t => t.metadata.escrowStatus === 'closed'));
      const before = a.updates.filter(u => u.tableId === first).length;
      await sleep(4000);
      assert.equal(a.updates.filter(u => u.tableId === first).length, before, 'Deleted bots must not send new rounds');
      assert.equal(b.state.table.id, other, 'Other player must not be reset');
      await screenshot(a, 'after-exit');
      return { finalBalance: await balance(a), cashout: 160 };
    });
    await check('DOUBLE-CLICK-FRESH-SESSION', async () => {
      second = await start(a, 200, true); assert.notEqual(second, first);
      assert.equal(await balance(a), a.initial - 240);
      assert.equal((await transactions(a)).filter(t => t.type === 'poker_buyin').length, 2);
      assert.ok(a.state.players.filter(p => p.isBot).every(p => [5000, 4995, 4990].includes(p.chips)));
      return { second };
    });
    await check('RELOAD-RESUMES-CARDS-NO-DEBIT', async () => {
      const cards = a.state.myCards;
      a.state = null; await a.page.reload();
      await waitFor(() => a.state?.table.id === second, 'Reload must resume the same session');
      assert.deepEqual(a.state.myCards, cards);
      assert.equal(a.state.players.find(p => p.userId === a.id).folded, false);
      assert.equal(await balance(a), a.initial - 240);
      assert.equal((await transactions(a)).filter(t => t.type === 'poker_buyin').length, 2);
      await screenshot(a, 'after-reload');
    });
    await check('DISCONNECT-EXPIRES-AND-RETURNS-STACK', async () => {
      await a.page.goto('about:blank'); a.state = null;
      await sleep(33000);
      assert.equal(await balance(a), a.initial - 40);
      await a.page.goto(`${BASE}/game-poker`);
      await a.page.getByRole('button', { name: 'Jouer vs Bots', exact: true }).click({ trial: true });
      assert.equal(a.state, null);
      await screenshot(a, 'after-grace-expired');
    });
    await check('RETURN-LOBBY-CLOSES-SESSION', async () => {
      await start(a, 100);
      await a.page.getByRole('button', { name: '← Retour au lobby', exact: true }).click();
      await a.page.waitForURL(/\/lobby$/);
      assert.equal(await balance(a), a.initial - 40);
    });
    await check('POSTGRES-CONCURRENT-START-AND-CASHOUT', async () => {
      socket = io(`${BASE}/poker`, { auth: { token: a.token }, transports: ['websocket'], reconnection: false });
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      rpc = (event, data) => new Promise((resolve, reject) => socket.timeout(15000).emit(event, data, (err, result) => {
        if (err || !result?.success) reject(Error(result?.error || 'Socket operation failed')); else resolve(result);
      }));
      const [one, two] = await Promise.all([rpc('poker:start-bots', { buyIn: 100 }), rpc('poker:start-bots', { buyIn: 100 })]);
      assert.equal(one.state.table.id, two.state.table.id);
      assert.equal(await balance(a), a.initial - 140);
      await Promise.all([rpc('poker:leave-table', { tableId: one.state.table.id }), rpc('poker:stand-up', { tableId: one.state.table.id })]);
      assert.equal(await balance(a), a.initial - 40);
      const tx = await transactions(a);
      assert.equal(tx.filter(t => t.type === 'poker_buyin').length, 4);
      assert.equal(tx.filter(t => t.type === 'poker_cashout').length, 4);
      assert.ok(tx.filter(t => t.type === 'poker_buyin').every(t => t.metadata.escrowStatus === 'closed'));
    });
    await check('REPEATED-BOT-LIFECYCLE-20-ROUNDS', async () => {
      const ids = new Set();
      for (let round = 0; round < 20; round++) {
        const response = await rpc('poker:start-bots', { buyIn: 100 });
        assert.equal(response.state.players.filter(p => p.isBot).length, 3);
        assert.ok(!ids.has(response.state.table.id));
        ids.add(response.state.table.id);
        await rpc('poker:leave-table', { tableId: response.state.table.id });
      }
      assert.equal(await balance(a), a.initial - 40);
      const tx = await transactions(a);
      assert.equal(tx.filter(t => t.type === 'poker_buyin').length, 24);
      assert.equal(tx.filter(t => t.type === 'poker_cashout').length, 24);
      assert.ok(tx.filter(t => t.type === 'poker_buyin').every(t => t.metadata.escrowStatus === 'closed'));
      socket.disconnect();
      return { rounds: ids.size, finalBalance: await balance(a) };
    });
    await check('SECOND-PLAYER-CLEANUP', async () => { await quit(b); assert.equal(await balance(b), b.initial); });
    await check('LEDGER-RECONCILIATION', async () => {
      for (const actor of [a, b]) {
        const tx = await transactions(actor);
        const end = await balance(actor);
        assert.equal(end, tx.reduce((sum, t) => sum + Number(t.amount), 0));
        report.accounts.find(account => account.id === actor.id).finalBalance = end;
      }
      assert.deepEqual(report.errors, []);
    });
  } catch (error) {
    report.fatal = error.message;
    for (const [actor, name] of [[a, 'failure-a'], [b, 'failure-b']]) if (actor) await screenshot(actor, name).catch(() => {});
    process.exitCode = 1;
  } finally {
    socket?.disconnect();
    report.finished = new Date().toISOString(); save();
    fs.writeFileSync(path.resolve(OUT, '../latest.json'), JSON.stringify({ evidence: OUT, ...report }, null, 2));
    await browser.close();
    console.log(JSON.stringify({ checks: report.checks, accounts: report.accounts, fatal: report.fatal }, null, 2));
  }
})();
