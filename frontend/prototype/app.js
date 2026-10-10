/* ============================================
   CASINO SOCIAL — Application Prototype
   Données mockées + Navigation + Interactions
   ============================================ */

// --- Mock Data ---
const MOCK = {
  user: {
    id: 1,
    pseudo: 'LuckyPlayer',
    email: 'player@casino.com',
    avatar: 'LP',
    level: 12,
    xp: 3400,
    xpMax: 5000,
    rank: 'Argent',
    joined: '2026-01-15',
    stats: {
      gamesPlayed: 1247,
      wins: 689,
      biggestWin: 25000,
      totalBet: 158000,
      winRate: 55.2,
      todayGames: 18
    },
    badges: [
      { id: 1, name: 'Roi des Slots', icon: '🎰', unlocked: true },
      { id: 2, name: 'As du Blackjack', icon: '🃏', unlocked: true },
      { id: 3, name: 'Millionnaire', icon: '💎', unlocked: true },
      { id: 4, name: 'Légende du Crash', icon: '📈', unlocked: false },
      { id: 5, name: 'Plinko Master', icon: '🔴', unlocked: false },
      { id: 6, name: 'Roi du Poker', icon: '♠️', unlocked: false },
    ]
  },
  balance: 5000,
  dailyReward: { available: true, streak: 3, amount: 1000, nextIn: '4h 12m' },
  notifications: [
    { id: 1, text: 'Récompense quotidienne disponible !', time: 'Il y a 2 min', type: 'gold' },
    { id: 2, text: 'Vous avez gagné 2 500 jetons au Blackjack !', time: 'Il y a 15 min', type: 'success' },
    { id: 3, text: 'Défi "Roi des Slots" complété ! +500 jetons', time: 'Il y a 1h', type: 'accent' },
  ],
  tasks: [
    { id: 1, title: 'Jouer 10 parties de Slots', progress: 4, max: 10, reward: 250, completed: false },
    { id: 2, title: 'Gagner 3 mains de Blackjack', progress: 1, max: 3, reward: 300, completed: false },
    { id: 3, title: 'Multiplicateur 5x+ sur Crash', progress: 0, max: 1, reward: 500, completed: false },
    { id: 4, title: 'Découvrir 5 gemmes aux Mines', progress: 3, max: 5, reward: 250, completed: false },
    { id: 5, title: 'Jouer 5 parties de Roulette', progress: 2, max: 5, reward: 200, completed: false },
  ],
  race: [
    { rank: 1, name: 'WhaleKing', score: 45200, prize: 2500, isMe: false },
    { rank: 2, name: 'LuckyStar', score: 38900, prize: 1500, isMe: false },
    { rank: 3, name: 'JackPotter', score: 32100, prize: 1000, isMe: false },
    { rank: 4, name: 'SpinMaster', score: 28500, prize: 500, isMe: false },
    { rank: 5, name: 'DiamondHands', score: 24100, prize: 500, isMe: false },
    { rank: 6, name: 'LuckyPlayer', score: 21500, prize: 500, isMe: true },
    { rank: 7, name: 'BetKing', score: 19800, prize: 500, isMe: false },
    { rank: 8, name: 'SlotQueen', score: 17500, prize: 500, isMe: false },
    { rank: 9, name: 'CardShark', score: 15200, prize: 500, isMe: false },
    { rank: 10, name: 'DiceMaster', score: 13400, prize: 500, isMe: false },
  ],
  pokerTables: [
    { id: 1, name: 'High Rollers', stakes: '500/1000', players: 4, max: 9, waitlist: 2 },
    { id: 2, name: 'Casual Friday', stakes: '50/100', players: 6, max: 9, waitlist: 0 },
    { id: 3, name: 'No Limit Night', stakes: '200/400', players: 2, max: 6, waitlist: 1 },
    { id: 4, name: 'Micro Stakes', stakes: '10/20', players: 5, max: 9, waitlist: 0 },
  ],
  games: [
    { id: 'slots3', name: 'Slot 3 Rlx', icon: '🎰', tag: 'Populaire', hot: true },
    { id: 'slots4', name: 'Slot 4 Rlx', icon: '🎰', tag: 'Wilds', hot: false },
    { id: 'slots5', name: 'Slot 5 Rlx', icon: '🎰', tag: 'Jackpot', hot: true },
    { id: 'blackjack', name: 'Blackjack', icon: '🃏', tag: 'Table', hot: false },
    { id: 'roulette', name: 'Roulette', icon: '🎡', tag: 'Table', hot: false },
    { id: 'poker-lobby', name: 'Poker', icon: '♠️', tag: 'Multi', hot: true },
    { id: 'crash', name: 'Crash', icon: '📈', tag: 'Original', hot: true },
    { id: 'plinko', name: 'Plinko', icon: '🔴', tag: 'Original', hot: false },
    { id: 'mines', name: 'Mines', icon: '💎', tag: 'Original', hot: false },
    { id: 'wheel', name: 'Wheel', icon: '🎡', tag: 'Original', hot: false },
    { id: 'limbo', name: 'Limbo', icon: '🎯', tag: 'Original', hot: false },
    { id: 'craps', name: 'Dés / Craps', icon: '🎲', tag: 'Table', hot: false },
    { id: 'bingo', name: 'Bingo', icon: '🔢', tag: 'Salle', hot: false },
  ]
};

// --- State ---
let state = {
  currentPage: 'login',
  balance: MOCK.balance,
  isLoggedIn: false,
  slotBet: 10,
  slotLines: 3,
  slotResult: null,
  slotSpinning: false,
  bjBet: 50,
  bjHand: [],
  bjDealer: [],
  bjGameOver: false,
  bjInsuranceOffered: false,
  rouletteBets: [],
  rouletteBet: 10,
  crashMultiplier: 1.00,
  crashRunning: false,
  crashCashedOut: false,
  crashBet: 10,
  crashAutoCashout: 0,
  plinkoRows: 12,
  plinkoRisk: 'medium',
  plinkoBet: 10,
  plinkoMultiBalls: 1,
  minesBet: 10,
  minesCount: 3,
  minesRevealed: [],
  minesGameOver: false,
  minesWon: false,
  wheelSpinning: false,
  limboTarget: 2.0,
  limboBet: 10,
  limboResult: null,
  crapsBet: 10,
  crapsBetType: 'pass',
  bingoBet: 10,
  bingoDrawn: [],
  bingoMulti: false,
  pokerTable: null,
  adminTab: 'dashboard',
  slot4Auto: 0,
  slot5Auto: 0,
  txFilter: 'all',
};

// --- DOM References ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- Navigation ---
function navigate(hash) {
  const page = hash.replace('#', '') || 'login';
  state.currentPage = page;

  $$('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  // Header visibility
  const header = document.getElementById('main-header');
  const authPages = ['login', 'register'];
  header.style.display = authPages.includes(page) ? 'none' : 'flex';

  // Render page
  renderPage(page);
}

function renderPage(page) {
  switch(page) {
    case 'login': renderLogin(); break;
    case 'register': renderRegister(); break;
    case 'lobby': renderLobby(); break;
    case 'slots3': renderSlots3(); break;
    case 'slots4': renderSlots4(); break;
    case 'slots5': renderSlots5(); break;
    case 'blackjack': renderBlackjack(); break;
    case 'roulette': renderRoulette(); break;
    case 'poker-lobby': renderPokerLobby(); break;
    case 'poker-table': renderPokerTable(); break;
    case 'crash': renderCrash(); break;
    case 'plinko': renderPlinko(); break;
    case 'mines': renderMines(); break;
    case 'wheel': renderWheel(); break;
    case 'limbo': renderLimbo(); break;
    case 'craps': renderCraps(); break;
    case 'bingo': renderBingo(); break;
    case 'tasks': renderTasks(); break;
    case 'race': renderRace(); break;
    case 'profile': renderProfile(); break;
    case 'admin': renderAdmin(); break;
    case 'admin-economy': renderAdminEconomy(); break;
    case 'admin-users': renderAdminUsers(); break;
    case 'admin-logs': renderAdminLogs(); break;
    case 'shop': renderShop(); break;
    case 'reset-password': renderResetPassword(); break;
    case 'responsible-gaming': renderResponsibleGaming(); break;
  }
  updateHeader();
}

// --- Header ---
function updateHeader() {
  const balanceEl = document.getElementById('header-balance');
  const userEl = document.getElementById('header-user');
  const notifCount = document.getElementById('notif-count');

  if (balanceEl) {
    balanceEl.innerHTML = `
      <span>💰</span>
      <span class="amount">${state.balance.toLocaleString()}</span>
      <span class="caption" style="color:var(--text-muted)">GC</span>
    `;
  }

  document.querySelectorAll('.game-balance').forEach(el => {
    el.textContent = state.balance.toLocaleString();
  });

  if (userEl) {
    userEl.innerHTML = `
      <div class="avatar">${MOCK.user.pseudo.charAt(0)}</div>
      <span class="small">${MOCK.user.pseudo}</span>
    `;
  }

  if (notifCount) {
    notifCount.textContent = MOCK.notifications.length;
  }
}

// --- Toast ---
function showToast(message, type = 'gold') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { gold: '⭐', success: '✅', error: '❌', accent: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Navigation Setup ---
document.addEventListener('DOMContentLoaded', () => {
  // Hash routing
  window.addEventListener('hashchange', () => navigate(window.location.hash));
  navigate(window.location.hash || '#login');

  // Global nav clicks — use location.hash for robust routing
  document.addEventListener('click', (e) => {
    const navLink = e.target.closest('[data-nav]');
    if (navLink) {
      e.preventDefault();
      const target = navLink.getAttribute('data-nav');
      window.location.hash = target;
    }
  });

  // Notifications toggle
  const notifBell = document.getElementById('notif-bell');
  const notifPanel = document.getElementById('notif-panel');
  if (notifBell) {
    notifBell.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPanel.classList.toggle('active');
    });
    document.addEventListener('click', () => notifPanel.classList.remove('active'));
  }

  // Daily reward claim
  document.addEventListener('click', (e) => {
    if (e.target.closest('#claim-reward')) {
      if (MOCK.dailyReward.available) {
        MOCK.dailyReward.available = false;
        state.balance += MOCK.dailyReward.amount;
        showToast(`+${MOCK.dailyReward.amount} GC réclamés !`, 'gold');
        renderLobby();
        updateHeader();
      }
    }
  });
});

// =============================================
// PAGE RENDERERS
// =============================================

// --- LOGIN ---
function renderLogin() {
  const el = document.getElementById('page-login');
  if (!el) return;
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="logo">CASINO<span>X</span></div>
        <p class="subtitle">Casino social — divertissement sans argent réel</p>
        <form id="login-form">
          <div class="form-group">
            <label>Email</label>
            <input class="input" type="email" placeholder="votre@email.com" style="width:100%">
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input class="input" type="password" placeholder="••••••••" style="width:100%">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Se connecter</button>
          <div style="text-align:center;margin-top:8px">
            <a href="#" data-nav="#reset-password" style="font-size:13px;color:var(--text-muted)">Mot de passe oublié ?</a>
          </div>
        </form>
        <div class="divider">ou</div>
        <button class="btn btn-google" onclick="mockLogin()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.18 2.18 6.07l3.66 2.84C6.67 6.23 9.08 5.38 12 5.38z"/></svg>
          Connexion avec Google
        </button>
        <div class="auth-footer">
          Pas encore de compte ? <a href="#" data-nav="#register">S'inscrire</a>
        </div>
        <div class="legal-notice" style="margin-top:16px">
          Ce jeu est un divertissement sans argent réel
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    mockLogin();
  });
}

function mockLogin() {
  state.isLoggedIn = true;
  showToast('Bienvenue, ' + MOCK.user.pseudo + ' !', 'gold');
  window.location.hash = '#lobby';
}

// --- REGISTER ---
function renderRegister() {
  const el = document.getElementById('page-register');
  if (!el) return;
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="logo">CASINO<span>X</span></div>
        <p class="subtitle">Créez votre compte — 5 000 GC de bienvenue</p>
        <form id="register-form">
          <div class="form-group">
            <label>Pseudo</label>
            <input class="input" type="text" placeholder="Votre pseudo" style="width:100%">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input class="input" type="email" placeholder="votre@email.com" style="width:100%">
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input class="input" type="password" placeholder="Min. 8 caractères" style="width:100%">
          </div>
          <div class="form-group">
            <label>Date de naissance (18+)</label>
            <input class="input" type="date" style="width:100%">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Créer mon compte</button>
          <p class="caption" style="text-align:center;margin-top:12px;color:var(--text-muted)">
            En créant un compte, j'accepte les CGU et la politique de confidentialité
          </p>
        </form>
        <div class="divider">ou</div>
        <button class="btn btn-google" onclick="mockLogin()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.18 2.18 6.07l3.66 2.84C6.67 6.23 9.08 5.38 12 5.38z"/></svg>
          S'inscrire avec Google
        </button>
        <div class="auth-footer">
          Déjà un compte ? <a href="#" data-nav="#login">Se connecter</a>
        </div>
        <div class="legal-notice" style="margin-top:16px">
          Ce jeu est un divertissement sans argent réel
        </div>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    mockLogin();
  });
}

// --- LOBBY ---
function renderLobby() {
  const el = document.getElementById('page-lobby');
  if (!el) return;

  const reward = MOCK.dailyReward;
  const rewardHTML = reward.available ? `
    <div class="daily-reward" id="daily-reward-box">
      <div class="info">
        <div class="title">🎁 Récompense quotidienne</div>
        <div class="subtitle">${reward.amount.toLocaleString()} GC disponibles</div>
        <div class="streak">🔥 Streak : ${reward.streak} jours</div>
      </div>
      <button class="btn btn-primary" id="claim-reward">Réclamer</button>
    </div>
  ` : `
    <div class="daily-reward" style="opacity:0.6;animation:none">
      <div class="info">
        <div class="title">🎁 Prochaine récompense</div>
        <div class="subtitle">Dans ${reward.nextIn}</div>
        <div class="streak">🔥 Streak : ${reward.streak} jours</div>
      </div>
      <button class="btn btn-outline" disabled>Réclamé</button>
    </div>
  `;

  el.innerHTML = `
    <div class="app-container">
      ${rewardHTML}
      <div class="section-header">
        <h2>🎮 Jeux</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" data-nav="#tasks">📋 Tâches</button>
          <button class="btn btn-outline btn-sm" data-nav="#race">🏆 Course</button>
        </div>
      </div>
      <div class="game-grid">
        ${MOCK.games.map(g => `
          <div class="game-card" data-nav="#${g.id}">
            ${g.hot ? '<span class="badge-hot">HOT</span>' : ''}
            <span class="icon">${g.icon}</span>
            <div class="name">${g.name}</div>
            <div class="tag">${g.tag}</div>
          </div>
        `).join('')}
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <a href="#" data-nav="#responsible-gaming" style="color:var(--text-muted);font-size:13px">🎯 Jeu Responsable</a>
      </div>
      <div style="text-align:center;margin-bottom:8px">
        <a href="#" data-nav="#admin" style="color:var(--text-muted);font-size:12px;opacity:0.5">⚙️ Admin</a>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- SLOTS 3 ---
function renderSlots3() {
  const el = document.getElementById('page-slots3');
  if (!el) return;
  const symbols = ['🍒', '🍋', '⭐', '7️⃣', '🔔', '💎', 'BAR'];
  const jackpot = 50000;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎰 Slot 3 Rlx</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance" id="slot-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="slot-machine">
          <div class="slot-machine-header">
            <div class="slot-machine-title">★ LUCKY 7'S ★</div>
            <div class="slot-machine-jackpot">JACKPOT ${jackpot.toLocaleString()} GC</div>
          </div>
          <div class="slot-reels-container">
            <div class="slot-reels">
              <div class="slot-reel" id="reel-0"><span class="symbol">🍒</span></div>
              <div class="slot-reel" id="reel-1"><span class="symbol">🍋</span></div>
              <div class="slot-reel" id="reel-2"><span class="symbol">⭐</span></div>
            </div>
          </div>
          <div class="slot-lines">
            ${[1,2,3,4,5].map(i => `
              <button class="slot-line-btn ${i <= state.slotLines ? 'active' : ''}"
                onclick="toggleSlotLine(${i})">${i} ligne${i > 1 ? 's' : ''}</button>
            `).join('')}
          </div>
          <div class="slot-controls-panel">
            <div class="slot-credit-display">
              <div class="slot-credit-item">
                <div class="label">Mise</div>
                <div class="value">${state.slotBet * state.slotLines}</div>
              </div>
              <div class="slot-credit-item">
                <div class="label">Crédit</div>
                <div class="value" id="slot-credit">${state.balance.toLocaleString()}</div>
              </div>
              <div class="slot-credit-item">
                <div class="label">Gain</div>
                <div class="value" id="slot-win">0</div>
              </div>
            </div>
            <div class="game-controls" style="justify-content:center">
              <div class="bet-selector">
                <span class="label">Pièce :</span>
                <div class="bet-amount">
                  ${[10, 25, 50, 100].map(v => `
                    <button class="bet-quick ${state.slotBet === v ? 'active' : ''}"
                      onclick="state.slotBet=${v};renderSlots3()" style="${state.slotBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                  `).join('')}
                </div>
              </div>
              <button class="btn btn-primary btn-lg" id="slot-spin-btn" style="background:linear-gradient(135deg,#FFD700,#B8960F);border:none;color:#000;font-weight:800;padding:12px 32px">🎰 SPIN</button>
            </div>
          </div>
          <div class="game-result" id="slot-result"></div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
  document.getElementById('slot-spin-btn').addEventListener('click', slotSpin);
}

function toggleSlotLine(n) {
  state.slotLines = n;
  renderSlots3();
}

function slotSpin() {
  if (state.slotSpinning) return;
  if (state.balance < state.slotBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }

  state.slotSpinning = true;
  state.balance -= state.slotBet;
  updateHeader();

  const reels = [0, 1, 2];
  const symbols = ['🍒', '🍋', '⭐', '7️⃣', '🔔', '💎', 'BAR'];

  reels.forEach(i => {
    const reel = document.getElementById(`reel-${i}`);
    reel.classList.add('spinning');
  });

  document.getElementById('slot-spin-btn').disabled = true;
  document.getElementById('slot-result').textContent = '';
  document.getElementById('slot-win').textContent = '0';

  setTimeout(() => {
    const results = reels.map(() => symbols[Math.floor(Math.random() * symbols.length)]);
    reels.forEach(i => {
      const reel = document.getElementById(`reel-${i}`);
      reel.classList.remove('spinning');
      reel.classList.add('landing');
      reel.querySelector('.symbol').textContent = results[i];
    });

    const allSame = results.every(r => r === results[0]);
    const twoSame = results[0] === results[1] || results[1] === results[2] || results[0] === results[2];
    let winAmount = 0;
    let resultText = '';

    if (allSame) {
      winAmount = state.slotBet * state.slotLines * 10;
      resultText = `🎉 JACKPOT ! +${winAmount} GC`;
    } else if (twoSame) {
      winAmount = state.slotBet * state.slotLines * 2;
      resultText = `✅ +${winAmount} GC`;
    } else {
      resultText = '❌ Perdu';
    }

    state.balance += winAmount;
    const resultEl = document.getElementById('slot-result');
    resultEl.textContent = resultText;
    resultEl.className = `game-result ${winAmount > 0 ? 'win' : 'lose'}`;
    document.getElementById('slot-win').textContent = winAmount.toLocaleString();
    document.getElementById('slot-credit').textContent = state.balance.toLocaleString();
    state.slotSpinning = false;
    document.getElementById('slot-spin-btn').disabled = false;
    updateHeader();
  }, 1500);
}

// --- BLACKJACK ---
function renderBlackjack() {
  const el = document.getElementById('page-blackjack');
  if (!el) return;

  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function createDeck() {
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value, isRed: suit === '♥' || suit === '♦' });
      }
    }
    return deck;
  }

  function cardValue(card) {
    if (['J','Q','K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
  }

  function handValue(hand) {
    let total = hand.reduce((s, c) => s + cardValue(c), 0);
    let aces = hand.filter(c => c.value === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function cardHTML(card, hidden = false) {
    if (hidden) return '<div class="bj-card hidden"></div>';
    const color = card.isRed ? 'red' : '';
    return `<div class="bj-card ${color}">${card.value}${card.suit}</div>`;
  }

  if (!state.bjDeck || state.bjDeck.length < 10) {
    const suits = ['♠','♥','♦','♣'];
    const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    state.bjDeck = [];
    for (let i = 0; i < 6; i++) {
      for (const suit of suits) {
        for (const value of values) {
          state.bjDeck.push({ suit, value, isRed: suit === '♥' || suit === '♦' });
        }
      }
    }
    state.bjDeck.sort(() => Math.random() - 0.5);
    state.bjHand = [];
    state.bjDealer = [];
    state.bjGameOver = false;
  }

  function bjCardHTML(card, hidden = false) {
    if (hidden) return '<div class="bj-card hidden"></div>';
    return `<div class="bj-card ${card.isRed ? 'red' : ''}">${card.value}${card.suit}</div>`;
  }

  function bjValue(hand) {
    let total = hand.reduce((s, c) => {
      if (['J','Q','K'].includes(c.value)) return s + 10;
      if (c.value === 'A') return s + 11;
      return s + parseInt(c.value);
    }, 0);
    let aces = hand.filter(c => c.value === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  if (!state.bjHand.length && !state.bjGameOver) {
    state.bjBet = 50;
    state.bjHand = [];
    state.bjDealer = [];
    state.bjGameOver = false;
  }

  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🃏 Blackjack</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="bj-table">
          <div class="bj-info">
            <span>Croupier ${state.bjDealer.length ? `(${bjValue(state.bjDealer)})` : ''}</span>
            <span>Mise : ${state.bjBet} GC</span>
          </div>
          <div class="bj-hand" id="bj-dealer-hand">
            ${state.bjDealer.length ? state.bjDealer.map((c, i) => bjCardHTML(c, i === 1 && !state.bjGameOver)).join('') : '<span style="color:var(--text-muted);font-size:14px">En attente...</span>'}
          </div>
          <div class="bj-info" style="margin-top:20px">
            <span>Joueur ${state.bjHand.length ? `(${bjValue(state.bjHand)})` : ''}</span>
            <span>Mise : ${state.bjBet} GC</span>
          </div>
          <div class="bj-hand" id="bj-player-hand">
            ${state.bjHand.length ? state.bjHand.map(c => bjCardHTML(c)).join('') : '<span style="color:var(--text-muted);font-size:14px">Placez votre mise</span>'}
          </div>
          <div class="bj-actions" id="bj-actions">
            ${!state.bjHand.length ? `
              <div class="bet-selector">
                <span class="label">Mise :</span>
                <div class="bet-amount">
                  ${[10, 25, 50, 100, 250].map(v => `
                    <button class="bet-quick ${state.bjBet === v ? 'active' : ''}"
                      onclick="state.bjBet=${v};renderBlackjack()"
                      style="${state.bjBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                  `).join('')}
                </div>
              </div>
              <button class="btn btn-primary" onclick="bjDeal()">🃏 Distribuer</button>
            ` : `
              ${bjCheckInsurance() ? '<button class="btn btn-outline" onclick="bjTakeInsurance()">🛡️ Assurance</button>' : ''}
              <button class="btn btn-primary" onclick="bjHit()">Hit</button>
              <button class="btn btn-secondary" onclick="bjStand()">Stand</button>
              <button class="btn btn-accent" onclick="bjDouble()">Double</button>
              <button class="btn btn-outline" onclick="bjSplit()">Split</button>
              <button class="btn btn-ghost" onclick="bjSurrender()">Abandon</button>
            `}
          </div>
          <div class="game-result" id="bj-result">${state.bjGameOver ? state.bjResult || '' : ''}</div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function bjCardHTML(card, hidden = false) {
  if (hidden) return '<div class="bj-card hidden"></div>';
  return `<div class="bj-card ${card.isRed ? 'red' : ''}">${card.value}${card.suit}</div>`;
}

function bjValue(hand) {
  let total = hand.reduce((s, c) => {
    if (['J','Q','K'].includes(c.value)) return s + 10;
    if (c.value === 'A') return s + 11;
    return s + parseInt(c.value);
  }, 0);
  let aces = hand.filter(c => c.value === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function bjDeal() {
  if (state.balance < state.bjBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.bjBet;
  state.bjHand = [state.bjDeck.pop(), state.bjDeck.pop()];
  state.bjDealer = [state.bjDeck.pop(), state.bjDeck.pop()];
  state.bjGameOver = false;
  state.bjResult = '';
  renderBlackjack();
  updateHeader();
}

function bjHit() {
  state.bjHand.push(state.bjDeck.pop());
  if (bjValue(state.bjHand) > 21) {
    state.bjGameOver = true;
    state.bjResult = '💥 Perdu ! Vous avez dépassé 21';
  }
  renderBlackjack();
}

function bjStand() {
  while (bjValue(state.bjDealer) < 17) {
    state.bjDealer.push(state.bjDeck.pop());
  }
  const pVal = bjValue(state.bjHand);
  const dVal = bjValue(state.bjDealer);
  state.bjGameOver = true;

  if (dVal > 21 || pVal > dVal) {
    const win = state.bjBet * 2;
    state.balance += win;
    state.bjResult = `🎉 Gagné ! +${win} GC`;
  } else if (pVal === dVal) {
    state.balance += state.bjBet;
    state.bjResult = '🤝 Égalité (push)';
  } else {
    state.bjResult = '💥 Perdu';
  }
  renderBlackjack();
  updateHeader();
}

function bjDouble() {
  if (state.balance < state.bjBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.bjBet;
  state.bjBet *= 2;
  state.bjHand.push(state.bjDeck.pop());
  if (bjValue(state.bjHand) > 21) {
    state.bjGameOver = true;
    state.bjResult = '💥 Perdu !';
    renderBlackjack();
    updateHeader();
    return;
  }
  bjStand();
}

function bjSplit() {
  showToast('Split pas encore implémenté dans le prototype', 'accent');
}

function bjSurrender() {
  state.balance += Math.floor(state.bjBet / 2);
  state.bjGameOver = true;
  state.bjResult = '🏳️ Abandon — 50% remboursé';
  renderBlackjack();
  updateHeader();
}

// --- ROULETTE ---
let rouletteLastResults = [];

function renderRoulette() {
  const el = document.getElementById('page-roulette');
  if (!el) return;

  const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const numColor = (n) => n === 0 ? 'green' : reds.includes(n) ? 'red' : 'black';

  const gridRows = [
    [3,6,9,12,15,18,21,24,27,30,33,36],
    [2,5,8,11,14,17,20,23,26,29,32,35],
    [1,4,7,10,13,16,19,22,25,28,31,34]
  ];

  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎡 Roulette</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="roulette-table">
          <div class="roulette-wheel-section">
            <div class="roulette-wheel-container">
              <div class="roulette-wheel-outer" id="roulette-wheel">
                <div class="roulette-wheel-numbers">
                  ${wheelOrder.map((n, i) => {
                    const angle = i * (360 / 37);
                    return `<div class="roulette-wheel-number" style="transform: rotate(${angle}deg); color: ${numColor(n) === 'red' ? '#FF1744' : numColor(n) === 'green' ? '#00C853' : '#fff'}">${n}</div>`;
                  }).join('')}
                </div>
                <div class="roulette-wheel-inner" id="roulette-result">-</div>
              </div>
              <div class="roulette-ball" id="roulette-ball"></div>
            </div>
            <div class="roulette-result-display">
              <div class="roulette-result-number" id="roulette-result-number" style="background:#333">-</div>
              <div style="font-size:14px;color:var(--text-secondary)">Dernier résultat</div>
            </div>
            <div class="roulette-last-results" id="roulette-last-results">
              ${rouletteLastResults.slice(-10).map(n => {
                const c = numColor(n);
                return `<div class="roulette-last-result" style="background:${c === 'red' ? '#FF1744' : c === 'green' ? '#00C853' : '#333'}">${n}</div>`;
              }).join('')}
            </div>
          </div>
          <div class="roulette-betting-area">
            <div class="roulette-betting-grid">
              <div class="roulette-num green" onclick="placeRouletteBet(0)" style="grid-column: span 12;">0</div>
              ${gridRows.map(row => row.map(n => `
                <div class="roulette-num ${numColor(n)}" onclick="placeRouletteBet(${n})">${n}</div>
              `).join('')).join('')}
            </div>
            <div class="roulette-bets">
              <button class="roulette-bet-btn outside red" onclick="placeRouletteBet('red')">Rouge</button>
              <button class="roulette-bet-btn outside black" onclick="placeRouletteBet('black')">Noir</button>
              <button class="roulette-bet-btn outside even" onclick="placeRouletteBet('even')">Pair</button>
              <button class="roulette-bet-btn outside odd" onclick="placeRouletteBet('odd')">Impair</button>
              <button class="roulette-bet-btn outside highlow" onclick="placeRouletteBet('1-18')">1-18</button>
              <button class="roulette-bet-btn outside highlow" onclick="placeRouletteBet('19-36')">19-36</button>
              <button class="roulette-bet-btn outside dozen" onclick="placeRouletteBet('1-12')">1ère 12</button>
              <button class="roulette-bet-btn outside dozen" onclick="placeRouletteBet('13-24')">2ème 12</button>
              <button class="roulette-bet-btn outside dozen" onclick="placeRouletteBet('25-36')">3ème 12</button>
            </div>
            <div class="game-controls" style="justify-content:center;margin-top:12px">
              <div class="bet-selector">
                <span class="label">Mise :</span>
                <div class="bet-amount">
                  ${[10, 25, 50, 100].map(v => `
                    <button class="bet-quick ${state.rouletteBet === v ? 'active' : ''}"
                      onclick="state.rouletteBet=${v};renderRoulette()"
                      style="${state.rouletteBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                  `).join('')}
                </div>
              </div>
              <button class="btn btn-primary" onclick="rouletteSpin()">🎡 Lancer</button>
              <button class="btn btn-ghost" onclick="state.rouletteBets=[];renderRoulette()">Effacer</button>
            </div>
            <div class="game-result" id="roulette-result-text"></div>
          </div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function placeRouletteBet(type) {
  if (state.balance < 10) { showToast('Solde insuffisant !', 'error'); return; }
  state.balance -= 10;
  state.rouletteBets.push(type);
  updateHeader();
  showToast(`Mise de 10 GC sur ${type}`, 'accent');
}

function rouletteSpin() {
  if (!state.rouletteBets.length) {
    showToast('Placez au moins une mise !', 'error');
    return;
  }
  const result = Math.floor(Math.random() * 37);
  const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const color = result === 0 ? 'green' : reds.includes(result) ? 'red' : 'black';

  const wheel = document.getElementById('roulette-wheel');
  const ball = document.getElementById('roulette-ball');
  const degrees = 1440 + (result * (360 / 37));

  ball.classList.add('spinning');
  wheel.style.transform = `rotate(${degrees}deg)`;

  setTimeout(() => {
    ball.classList.remove('spinning');

    let win = 0;
    for (const bet of state.rouletteBets) {
      if (bet === result) win += 35 * 10;
      else if (bet === 'red' && color === 'red') win += 20;
      else if (bet === 'black' && color === 'black') win += 20;
      else if (bet === 'even' && result !== 0 && result % 2 === 0) win += 20;
      else if (bet === 'odd' && result % 2 === 1) win += 20;
      else if (bet === '1-18' && result >= 1 && result <= 18) win += 20;
      else if (bet === '19-36' && result >= 19 && result <= 36) win += 20;
      else if (bet === '1-12' && result >= 1 && result <= 12) win += 30;
      else if (bet === '13-24' && result >= 13 && result <= 24) win += 30;
      else if (bet === '25-36' && result >= 25 && result <= 36) win += 30;
    }

    state.balance += win;
    state.rouletteBets = [];

    rouletteLastResults.push(result);
    if (rouletteLastResults.length > 10) rouletteLastResults.shift();

    const resultEl = document.getElementById('roulette-result-text');
    const resultNum = document.getElementById('roulette-result');
    const resultNumber = document.getElementById('roulette-result-number');
    if (resultNum) {
      resultNum.textContent = result;
      resultNum.style.color = color === 'red' ? '#FF1744' : color === 'green' ? '#00C853' : '#fff';
    }
    if (resultNumber) {
      resultNumber.textContent = result;
      resultNumber.style.background = color === 'red' ? '#FF1744' : color === 'green' ? '#00C853' : '#333';
    }
    resultEl.textContent = win > 0 ? `🎉 Gagné ! +${win} GC (numéro ${result})` : `❌ Perdu (numéro ${result})`;
    resultEl.className = `game-result ${win > 0 ? 'win' : 'lose'}`;
    renderRoulette();
    updateHeader();
  }, 4000);
}

// --- POKER LOBBY ---
function renderPokerLobby() {
  const el = document.getElementById('page-poker-lobby');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>♠️ Poker Lobby</h1>
        <button class="btn btn-primary" onclick="showToast('Table créée !','success')">+ Créer</button>
      </div>
      ${MOCK.pokerTables.map(t => `
        <div class="poker-table-card">
          <div class="info">
            <div class="name">${t.name}</div>
            <div class="details">Blinds ${t.stakes} · ${t.players}/${t.max} joueurs · ${t.waitlist > 0 ? `${t.waitlist} en attente` : 'Place disponible'}</div>
          </div>
          <button class="btn ${t.players < t.max ? 'btn-primary' : 'btn-outline'} btn-sm"
            onclick="${t.players < t.max ? "state.pokerTable=" + JSON.stringify(t).replace(/"/g, "'") + ";window.location.hash='#poker-table'" : "showToast('Waitlist rejoint !','accent')"}">
            ${t.players < t.max ? 'Rejoindre' : 'Waitlist'}
          </button>
        </div>
      `).join('')}
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- POKER TABLE ---
function renderPokerTable() {
  const el = document.getElementById('page-poker-table');
  if (!el) return;
  const table = state.pokerTable || MOCK.pokerTables[0];
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#poker-lobby">← Lobby</button>
        <h1>♠️ ${table.name}</h1>
        <div class="balance-display">
          <span class="label">Stack</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
        </div>
      </div>
      <div class="poker-table-view">
        <div class="poker-timer">⏱️ Temps restant : 18s</div>
        <div class="poker-seats">
          ${[
            { name: 'Vous', chips: state.balance, cards: ['A♠', 'K♠'], active: true, isMe: true },
            { name: 'Bot Alice', chips: 4500, cards: [], active: false, isBot: true },
            { name: 'Bot Bob', chips: 3200, cards: [], active: false, isBot: true },
            { name: 'Bot Charlie', chips: 5100, cards: [], active: false, isBot: true },
          ].map((seat, i) => `
            <div class="poker-seat ${seat.active ? 'active' : ''}">
              <div class="avatar" style="background:${seat.isMe ? 'linear-gradient(135deg,var(--gold),var(--secondary))' : 'var(--bg-tertiary)'}">${seat.name[0]}</div>
              <div class="name">${seat.name} ${seat.isBot ? '<span class="badge badge-accent" style="font-size:9px">Bot</span>' : ''}</div>
              <div class="chips">${seat.chips.toLocaleString()}</div>
              <div class="cards">
                ${seat.cards.length ? seat.cards.map(c => `<div class="bj-card" style="width:28px;height:40px;font-size:12px">${c}</div>`).join('') : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="poker-community">
          <div class="bj-card">A♠</div>
          <div class="bj-card">K♠</div>
          <div class="bj-card">Q♠</div>
          <div class="bj-card">J♠</div>
          <div class="bj-card">10♠</div>
        </div>
        <div class="poker-pot">💰 Pot : 4 200 GC</div>
        <div class="poker-actions">
          <button class="btn btn-primary" onclick="showToast('Action envoyée','success')">Check</button>
          <button class="btn btn-secondary" onclick="showToast('Mise de 100 GC','success')">Miser 100</button>
          <button class="btn btn-accent" onclick="showToast('Relance à 300 GC','success')">Relancer</button>
          <button class="btn btn-ghost" onclick="showToast('Vous vous êtes couché','error')">Se coucher</button>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- CRASH ---
function renderCrash() {
  const el = document.getElementById('page-crash');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>📈 Crash</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="crash-container">
          <div class="crash-graph" id="crash-graph">
            <div class="crash-multiplier" id="crash-multiplier">${state.crashRunning ? state.crashMultiplier.toFixed(2) + 'x' : '1.00x'}</div>
            <canvas id="crash-canvas"></canvas>
          </div>
          <div class="game-controls" style="justify-content:center">
            <div class="bet-selector">
              <span class="label">Mise :</span>
              <div class="bet-amount">
                ${[10, 25, 50, 100].map(v => `
                  <button class="bet-quick ${state.crashBet === v ? 'active' : ''}"
                    onclick="state.crashBet=${v};renderCrash()"
                    style="${state.crashBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                `).join('')}
              </div>
            </div>
            <div class="auto-controls">
              <label style="font-size:13px;color:var(--text-secondary)">Auto cashout à :</label>
              <input class="input" type="number" min="1.01" max="100" step="0.01" value="${state.crashAutoCashout || ''}" style="width:80px;padding:6px;font-size:13px" placeholder="x" onchange="state.crashAutoCashout=parseFloat(this.value)||0" id="crash-autocashout-input">
            </div>
            <button class="btn btn-primary btn-lg" id="crash-action-btn"
              onclick="${state.crashRunning ? 'crashCashOut()' : 'crashStart()'}">
              ${state.crashRunning ? '💰 Cash Out' : '🚀 Lancer'}
            </button>
          </div>
          <div class="game-result" id="crash-result"></div>
          <div class="crash-bets">
            <div class="crash-bet">
              <div class="player"><div class="avatar" style="width:24px;height:24px;font-size:10px">V</div><span class="name">Vous</span></div>
              <span class="amount">${state.crashBet} GC</span>
              <span class="${state.crashCashedOut ? 'cashed' : 'waiting'}">${state.crashCashedOut ? `✅ ${state.crashMultiplier.toFixed(2)}x` : state.crashRunning ? '⏳ En cours' : 'En attente'}</span>
            </div>
            <div class="crash-bet">
              <div class="player"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:var(--bg-tertiary)">B</div><span class="name">BotBet99</span></div>
              <span class="amount">50 GC</span>
              <span class="cashed">✅ 2.45x</span>
            </div>
            <div class="crash-bet">
              <div class="player"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:var(--bg-tertiary)">C</div><span class="name">CrashKing</span></div>
              <span class="amount">100 GC</span>
              <span class="cashed">✅ 1.89x</span>
            </div>
          </div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function crashStart() {
  if (state.balance < state.crashBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.crashBet;
  state.crashRunning = true;
  state.crashCashedOut = false;
  state.crashMultiplier = 1.00;
  updateHeader();

  const crashPoint = 1 + Math.random() * 9;
  const multEl = document.getElementById('crash-multiplier');
  const btn = document.getElementById('crash-action-btn');
  if (btn) btn.textContent = '💰 Cash Out';

  const interval = setInterval(() => {
    if (!state.crashRunning) { clearInterval(interval); return; }
    state.crashMultiplier += 0.01 + (Math.random() * 0.05);
    if (multEl) multEl.textContent = state.crashMultiplier.toFixed(2) + 'x';

    if (state.crashMultiplier >= crashPoint) {
      clearInterval(interval);
      state.crashRunning = false;
      if (multEl) {
        multEl.textContent = '💥 CRASH !';
        multEl.classList.add('crashed');
      }
      if (!state.crashCashedOut) {
        document.getElementById('crash-result').textContent = '💥 Crash ! Vous avez tout perdu';
        document.getElementById('crash-result').className = 'game-result lose';
      }
      if (btn) btn.textContent = '🚀 Rejouer';
      setTimeout(() => {
        if (multEl) multEl.classList.remove('crashed');
      }, 2000);
    }
  }, 50);
}

function crashCashOut() {
  if (!state.crashRunning) return;
  state.crashRunning = false;
  state.crashCashedOut = true;
  const win = Math.floor(state.crashBet * state.crashMultiplier);
  state.balance += win;
  document.getElementById('crash-result').textContent = `💰 Cash Out à ${state.crashMultiplier.toFixed(2)}x ! +${win} GC`;
  document.getElementById('crash-result').className = 'game-result win';
  document.getElementById('crash-action-btn').textContent = '🚀 Rejouer';
  updateHeader();
}

// --- PLINKO ---
function renderPlinko() {
  const el = document.getElementById('page-plinko');
  if (!el) return;
  const rows = state.plinkoRows;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🔴 Plinko</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="plinko-board" id="plinko-board">
          <div class="plinko-pegs">
            ${Array.from({length: state.plinkoRows}, (_, row) => `
              <div class="plinko-row">
                ${Array.from({length: row + 1}, (_, peg) => `
                  <div class="plinko-peg" style="transform:scale(${1 - row * 0.03})"></div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <div class="plinko-slots" id="plinko-slots">
            ${Array.from({length: state.plinkoRows + 1}, (_, i) => {
              const multipliers = { low: [1.1,1.3,1.5,2,3,5,3,2,1.5,1.3,1.1], medium: [0.5,1,2,5,10,20,10,5,2,1,0.5], high: [0.1,0.5,2,10,50,100,50,10,2,0.5,0.1] };
              const m = multipliers[state.plinkoRisk] || multipliers.medium;
              const val = m[i] || 1;
              return `<div class="plinko-slot" style="background:${val >= 10 ? 'rgba(0,200,83,0.3)' : val >= 2 ? 'rgba(255,215,0,0.2)' : 'rgba(255,23,68,0.2)'};color:${val >= 10 ? 'var(--success)' : val >= 2 ? 'var(--gold)' : 'var(--error)'}">${val}x</div>`;
            }).join('')}
          </div>
        </div>
        <div class="game-controls" style="justify-content:center;margin-top:16px">
          <select onchange="state.plinkoRows=parseInt(this.value);renderPlinko()">
            ${[8,10,12,14,16].map(r => `<option value="${r}" ${r === state.plinkoRows ? 'selected' : ''}>${r} rangées</option>`).join('')}
          </select>
          <select onchange="state.plinkoRisk=this.value;renderPlinko()">
            <option value="low" ${state.plinkoRisk === 'low' ? 'selected' : ''}>Low Risk</option>
            <option value="medium" ${state.plinkoRisk === 'medium' ? 'selected' : ''}>Medium Risk</option>
            <option value="high" ${state.plinkoRisk === 'high' ? 'selected' : ''}>High Risk</option>
          </select>
          <div class="bet-selector">
            <span class="label">Mise :</span>
            <div class="bet-amount">
              ${[10, 25, 50, 100].map(v => `
                <button class="bet-quick ${state.plinkoBet === v ? 'active' : ''}"
                  onclick="state.plinkoBet=${v};renderPlinko()"
                  style="${state.plinkoBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
              `).join('')}
            </div>
          </div>
          <div class="auto-controls">
            <span class="caption">Billes :</span>
            <select onchange="state.plinkoMultiBalls=parseInt(this.value)" style="width:auto;padding:4px;font-size:12px">
              ${[1,2,3,5,10].map(v => `<option value="${v}" ${(state.plinkoMultiBalls || 1) === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-lg" onclick="plinkoDrop()">🔴 Lâcher</button>
        </div>
        <div class="game-result" id="plinko-result"></div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function plinkoDrop() {
  if (state.balance < state.plinkoBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.plinkoBet;
  updateHeader();
  const rows = state.plinkoRows;
  const multipliers = {
    low: [1.1,1.3,1.5,2,3,5,3,2,1.5,1.3,1.1],
    medium: [0.5,1,2,5,10,20,10,5,2,1,0.5],
    high: [0.1,0.5,2,10,50,100,50,10,2,0.5,0.1]
  };
  const mults = multipliers[state.plinkoRisk] || multipliers.medium;
  const slot = Math.floor(Math.random() * mults.length);
  const mult = mults[slot];
  const win = Math.floor(state.plinkoBet * mult);

  const board = document.getElementById('plinko-board');
  const pegsContainer = board.querySelector('.plinko-pegs');
  const boardRect = board.getBoundingClientRect();
  const pegsRect = pegsContainer.getBoundingClientRect();

  const ball = document.createElement('div');
  ball.className = 'plinko-ball';
  ball.style.position = 'absolute';
  ball.style.zIndex = '10';
  board.style.position = 'relative';
  board.appendChild(ball);

  const startX = pegsRect.width / 2 - 6;
  const rowHeight = pegsRect.height / (rows + 1);
  const colSpacing = pegsRect.width / (rows + 1);

  let col = 0;
  let step = 0;
  const totalSteps = rows + 2;

  function animateStep() {
    if (step === 0) {
      ball.style.left = startX + 'px';
      ball.style.top = '4px';
      ball.style.opacity = '1';
      ball.style.transition = 'none';
      step++;
      setTimeout(animateStep, 50);
      return;
    }
    if (step <= rows) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const prevCol = col;
      col = Math.max(-step, Math.min(step, col + dir));
      const x = pegsRect.width / 2 + col * colSpacing / 2 - 6;
      const y = step * rowHeight + 10;
      ball.style.transition = 'all 0.12s ease-in';
      ball.style.left = x + 'px';
      ball.style.top = y + 'px';
      step++;
      setTimeout(animateStep, 120);
      return;
    }
    if (step === rows + 1) {
      const slotIndex = col + rows;
      const x = (slotIndex / (rows + 1)) * pegsRect.width + (pegsRect.width / (rows + 1) / 2) - 6;
      const y = pegsRect.height - 6;
      ball.style.transition = 'all 0.15s ease-in';
      ball.style.left = x + 'px';
      ball.style.top = y + 'px';
      step++;
      setTimeout(animateStep, 200);
      return;
    }
    if (step === rows + 2) {
      ball.style.transition = 'all 0.3s';
      ball.style.transform = 'scale(1.5)';
      ball.style.background = win >= state.plinkoBet ? 'var(--success)' : 'var(--error)';

      const slots = board.querySelectorAll('.plinko-slot');
      if (slots[col + rows]) {
        slots[col + rows].style.transform = 'scale(1.15)';
        slots[col + rows].style.border = '2px solid var(--gold)';
      }

      state.balance += win;
      const resultEl = document.getElementById('plinko-result');
      resultEl.textContent = win > 0 ? `🎯 ${mult}x → +${win} GC` : `💥 ${mult}x → ${win} GC`;
      resultEl.className = `game-result ${win >= state.plinkoBet ? 'win' : 'lose'}`;
      updateHeader();

      setTimeout(() => {
        ball.remove();
        if (slots[col + rows]) {
          slots[col + rows].style.transform = '';
          slots[col + rows].style.border = '';
        }
      }, 1500);
    }
  }
  animateStep();
}

// --- MINES ---
function renderMines() {
  const el = document.getElementById('page-mines');
  if (!el) return;
  const size = 5;
  const total = size * size;

  if (!state.minesGrid) {
    state.minesGrid = Array.from({length: total}, (_, i) => ({ id: i, isMine: false, revealed: false }));
    state.minesGameOver = false;
    state.minesWon = false;
  }

  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>💎 Mines</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="game-controls" style="justify-content:center">
          <div class="bet-selector">
            <span class="label">Mines :</span>
            <select onchange="state.minesCount=parseInt(this.value);resetMines()">
              ${[1,3,5,10,15,24].map(v => `<option value="${v}" ${v === state.minesCount ? 'selected' : ''}>${v} mines</option>`).join('')}
            </select>
          </div>
          <div class="bet-selector">
            <span class="label">Mise :</span>
            <div class="bet-amount">
              ${[10, 25, 50, 100].map(v => `
                <button class="bet-quick ${state.minesBet === v ? 'active' : ''}"
                  onclick="state.minesBet=${v};renderMines()"
                  style="${state.minesBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
              `).join('')}
            </div>
          </div>
          <button class="btn btn-primary" onclick="minesCashOut()" ${!state.minesRevealed.length || state.minesGameOver ? 'disabled' : ''}>💰 Cash Out</button>
          <button class="btn btn-outline" onclick="resetMines()">🔄 Nouvelle partie</button>
        </div>
        <div class="mines-grid">
          ${state.minesGrid.map((cell, i) => `
            <div class="mines-cell ${cell.revealed ? (cell.isMine ? 'mine' : 'gem') : ''}"
              onclick="minesReveal(${i})"
              style="${cell.revealed ? '' : 'cursor:pointer'}"
              ${cell.revealed || state.minesGameOver ? '' : ''}>
              ${cell.revealed ? (cell.isMine ? '💣' : '💎') : '❓'}
            </div>
          `).join('')}
        </div>
        <div class="game-result" id="mines-result">
          ${state.minesGameOver ? (state.minesWon ? '💰 Cash Out !' : '💥 Mine ! Perdu') : ''}
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function resetMines() {
  const total = 25;
  state.minesGrid = Array.from({length: total}, (_, i) => ({ id: i, isMine: false, revealed: false }));
  state.minesGameOver = false;
  state.minesWon = false;
  state.minesRevealed = [];
  renderMines();
}

function minesReveal(index) {
  if (state.minesGameOver || state.minesGrid[index].revealed) return;

  if (!state.minesRevealed.length) {
    // First click — place mines
    const minePositions = new Set();
    while (minePositions.size < state.minesCount) {
      const pos = Math.floor(Math.random() * 25);
      if (pos !== index) minePositions.add(pos);
    }
    state.minesGrid.forEach((cell, i) => { cell.isMine = minePositions.has(i); });
  }

  const cell = state.minesGrid[index];
  cell.revealed = true;
  state.minesRevealed.push(index);

  if (cell.isMine) {
    state.minesGameOver = true;
    state.minesWon = false;
    // Reveal all mines
    state.minesGrid.forEach(c => { if (c.isMine) c.revealed = true; });
    document.getElementById('mines-result').textContent = '💥 Mine ! Vous avez tout perdu';
    document.getElementById('mines-result').className = 'game-result lose';
  } else {
    const mult = 1 + (state.minesRevealed.length * 0.5);
    document.getElementById('mines-result').textContent = `💎 ${state.minesRevealed.length} gemmes — Multiplicateur : ${mult.toFixed(2)}x`;
    document.getElementById('mines-result').className = 'game-result win';
  }
  renderMines();
}

function minesCashOut() {
  if (!state.minesRevealed.length) return;
  const mult = 1 + (state.minesRevealed.length * 0.5);
  const win = Math.floor(state.minesBet * mult);
  state.balance += win;
  state.minesGameOver = true;
  state.minesWon = true;
  document.getElementById('mines-result').textContent = `💰 Cash Out ! +${win} GC (${mult.toFixed(2)}x)`;
  document.getElementById('mines-result').className = 'game-result win';
  updateHeader();
  renderMines();
}

// --- WHEEL OF FORTUNE ---
function renderWheel() {
  const el = document.getElementById('page-wheel');
  if (!el) return;
  const segments = [
    { label: '$1', mult: 1, color: '#FFD700', weight: 24 },
    { label: '$2', mult: 2, color: '#E8457A', weight: 15 },
    { label: '$5', mult: 5, color: '#00E5FF', weight: 7 },
    { label: '$10', mult: 10, color: '#00C853', weight: 4 },
    { label: '$20', mult: 20, color: '#9B59B6', weight: 2 },
    { label: 'JOKER', mult: 40, color: '#FF1744', weight: 2 },
  ];

  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎡 Wheel of Fortune</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="wheel-container">
          <div class="wheel-pointer"></div>
          <div class="wheel-of-fortune" id="wheel-spin" style="transform:rotate(0deg)">
            ${segments.map((s, i) => {
              const angle = (360 / segments.length) * i;
              return `<div class="wheel-segment" style="transform:rotate(${angle}deg);background:${s.color};height:4px;width:50%"></div>`;
            }).join('')}
          </div>
        </div>
        <div style="text-align:center;margin:16px 0">
          <div style="font-size:32px;font-weight:700;font-family:var(--font-heading)" id="wheel-result">-</div>
        </div>
        <div class="game-controls" style="justify-content:center">
          <div class="bet-selector">
            <span class="label">Mise :</span>
            <div class="bet-amount">
              ${[10, 25, 50, 100].map(v => `
                <button class="bet-quick ${state.wheelBet === v ? 'active' : ''}"
                  onclick="state.wheelBet=${v};renderWheel()"
                  style="${state.wheelBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
              `).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-lg" onclick="wheelSpin()">🎡 Tourner</button>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function wheelSpin() {
  if (state.wheelSpinning) return;
  if (state.balance < (state.wheelBet || 10)) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.wheelSpinning = true;
  state.balance -= (state.wheelBet || 10);
  updateHeader();
  const segments = [1,2,5,10,20,40];
  const result = segments[Math.floor(Math.random() * segments.length)];
  const degrees = 1440 + Math.random() * 360;
  const wheel = document.getElementById('wheel-spin');
  wheel.style.transform = `rotate(${degrees}deg)`;

  setTimeout(() => {
    const win = (state.wheelBet || 10) * result;
    state.balance += win;
    document.getElementById('wheel-result').textContent = win > 0 ? `🎉 ${result}x → +${win} GC` : '❌ Perdu';
    state.wheelSpinning = false;
    updateHeader();
  }, 4000);
}

// --- LIMBO ---
function renderLimbo() {
  const el = document.getElementById('page-limbo');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎯 Limbo</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="crash-container">
          <div class="limbo-display">
            <div class="target">Multiplicateur cible : ${state.limboTarget.toFixed(2)}x</div>
            <div class="result ${state.limboResult ? (state.limboResult >= state.limboTarget ? 'win' : 'lose') : ''}" id="limbo-result-display">
              ${state.limboResult !== null ? state.limboResult.toFixed(2) + 'x' : '---'}
            </div>
            <div class="caption" style="margin-top:8px">
              Probabilité : ${(49.5 / state.limboTarget).toFixed(1)}% · Paiement : ${state.limboTarget.toFixed(2)}x
            </div>
          </div>
          <div class="game-controls" style="justify-content:center">
            <div class="bet-selector">
              <span class="label">Cible :</span>
              <input type="range" min="1.01" max="100" step="0.01" value="${state.limboTarget}"
                oninput="state.limboTarget=parseFloat(this.value);document.getElementById('limbo-target-display').textContent=this.value+'x'"
                style="max-width:150px">
              <span id="limbo-target-display" style="color:var(--gold);font-weight:600;min-width:60px">${state.limboTarget}x</span>
            </div>
            <div class="bet-selector">
              <span class="label">Mise :</span>
              <div class="bet-amount">
                ${[10, 25, 50, 100].map(v => `
                  <button class="bet-quick ${state.limboBet === v ? 'active' : ''}"
                    onclick="state.limboBet=${v};renderLimbo()"
                    style="${state.limboBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                `).join('')}
              </div>
            </div>
            <button class="btn btn-primary btn-lg" onclick="limboPlay()">🎯 Jouer</button>
          </div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function limboPlay() {
  if (state.balance < state.limboBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.limboBet;
  state.limboResult = 1 + Math.random() * 99;
  const won = state.limboResult >= state.limboTarget;
  if (won) {
    const win = Math.floor(state.limboBet * state.limboTarget);
    state.balance += win;
  }
  renderLimbo();
  updateHeader();
}

// --- CRAPS ---
function renderCraps() {
  const el = document.getElementById('page-craps');
  if (!el) return;
  const dice = state.crapsDice || [1, 1];
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎲 Dés / Craps</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="craps-table">
          <div class="craps-dice">
            <div class="craps-die">${dice[0]}</div>
            <div class="craps-die">${dice[1]}</div>
          </div>
          <div style="text-align:center;font-size:24px;font-weight:700;color:var(--gold)" id="craps-total">Total : ${dice[0] + dice[1]}</div>
          <div class="craps-bets" style="margin-top:16px">
            <button class="craps-bet-btn ${state.crapsBetType === 'pass' ? 'active' : ''}" onclick="state.crapsBetType='pass';renderCraps()">Pass Line (1:1)</button>
            <button class="craps-bet-btn ${state.crapsBetType === 'dontpass' ? 'active' : ''}" onclick="state.crapsBetType='dontpass';renderCraps()">Don't Pass (1:1)</button>
            <button class="craps-bet-btn ${state.crapsBetType === 'field' ? 'active' : ''}" onclick="state.crapsBetType='field';renderCraps()">Field (2:1)</button>
            <button class="craps-bet-btn ${state.crapsBetType === 'any7' ? 'active' : ''}" onclick="state.crapsBetType='any7';renderCraps()">Any 7 (4:1)</button>
          </div>
          <div class="game-controls" style="justify-content:center;margin-top:16px">
            <div class="bet-selector">
              <span class="label">Mise :</span>
              <div class="bet-amount">
                ${[10, 25, 50, 100].map(v => `
                  <button class="bet-quick ${state.crapsBet === v ? 'active' : ''}"
                    onclick="state.crapsBet=${v};renderCraps()"
                    style="${state.crapsBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                `).join('')}
              </div>
            </div>
            <button class="btn btn-primary btn-lg" onclick="crapsRoll()">🎲 Lancer</button>
          </div>
          <div class="game-result" id="craps-result"></div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function crapsRoll() {
  if (state.balance < state.crapsBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.crapsBet;
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  state.crapsDice = [d1, d2];
  const total = d1 + d2;
  let won = false;

  switch(state.crapsBetType) {
    case 'pass': won = total === 7 || total === 11; break;
    case 'dontpass': won = total === 2 || total === 3; break;
    case 'field': won = [2,3,4,9,10,11,12].includes(total); break;
    case 'any7': won = total === 7; break;
  }

  if (won) {
    const mults = { pass: 2, dontpass: 2, field: 2, any7: 5 };
    const win = state.crapsBet * (mults[state.crapsBetType] || 2);
    state.balance += win;
  }
  renderCraps();
  updateHeader();
}

// --- BINGO ---
function renderBingo() {
  const el = document.getElementById('page-bingo');
  if (!el) return;

  if (!state.bingoCard) {
    state.bingoCard = [];
    for (let r = 0; r < 5; r++) {
      const row = [];
      for (let c = 0; c < 5; c++) {
        const letter = ['B','I','N','G','O'][c];
        const min = c * 15 + 1;
        const max = min + 14;
        row.push({ num: c === 2 && r === 2 ? 'FREE' : Math.floor(Math.random() * 15) + min, marked: c === 2 && r === 2 });
      }
      state.bingoCard.push(row);
    }
    state.bingoDrawn = [];
  }

  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🔢 Bingo</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:flex;justify-content:center;gap:8px;margin-bottom:8px">
            ${['B','I','N','G','O'].map(l => `<span style="font-weight:700;color:var(--gold);font-size:18px">${l}</span>`).join('')}
          </div>
          <div class="bingo-card">
            ${state.bingoCard.flat().map(cell => `
              <div class="bingo-cell ${cell.marked ? 'marked' : ''} ${cell.num === 'FREE' ? 'free' : ''}">${cell.num}</div>
            `).join('')}
          </div>
        </div>
        <div class="bingo-numbers" id="bingo-numbers">
          ${state.bingoDrawn.map(n => `<span class="bingo-number drawn">${n}</span>`).join('')}
        </div>
        <div class="game-controls" style="justify-content:center">
          <div class="bet-selector">
            <span class="label">Mise :</span>
            <div class="bet-amount">
              ${[10, 25, 50].map(v => `
                <button class="bet-quick ${state.bingoBet === v ? 'active' : ''}"
                  onclick="state.bingoBet=${v};renderBingo()"
                  style="${state.bingoBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
              `).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-lg" onclick="bingoDraw()">🔢 Tirer</button>
          <button class="btn btn-outline" onclick="resetBingo()">Nouvelle carte</button>
        </div>
        <div class="game-result" id="bingo-result"></div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function bingoDraw() {
  if (state.balance < state.bingoBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.bingoBet;
  const num = Math.floor(Math.random() * 75) + 1;
  state.bingoDrawn.push(num);

  // Mark card
  state.bingoCard.forEach(row => {
    row.forEach(cell => {
      if (cell.num === num) cell.marked = true;
    });
  });

  // Check win
  let bingo = false;
  for (let r = 0; r < 5; r++) {
    if (state.bingoCard[r].every(c => c.marked)) bingo = true;
  }
  for (let c = 0; c < 5; c++) {
    if (state.bingoCard.every(row => row[c].marked)) bingo = true;
  }
  if (state.bingoCard.every((_, i) => state.bingoCard[i][i].marked)) bingo = true;
  if (state.bingoCard.every((_, i) => state.bingoCard[i][4-i].marked)) bingo = true;

  if (bingo) {
    const win = state.bingoBet * 5;
    state.balance += win;
    showToast(`🎉 BINGO ! +${win} GC`, 'success');
  }

  renderBingo();
  updateHeader();
}

function resetBingo() {
  state.bingoCard = [];
  state.bingoDrawn = [];
  renderBingo();
}

// --- TASKS ---
function renderTasks() {
  const el = document.getElementById('page-tasks');
  if (!el) return;
  const allDone = MOCK.tasks.every(t => t.completed);
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>📋 Tâches Quotidiennes</h1>
      </div>
      ${MOCK.tasks.map(t => `
        <div class="task-item">
          <div class="info">
            <div class="title">${t.title}</div>
            <div class="desc">Progression : ${t.progress}/${t.max}</div>
            <div class="progress-bar" style="margin-top:8px">
              <div class="fill" style="width:${(t.progress / t.max) * 100}%"></div>
            </div>
          </div>
          <div class="${t.completed ? 'completed' : 'reward'}">
            ${t.completed ? '✅' : `+${t.reward} GC`}
          </div>
        </div>
      `).join('')}
      ${allDone ? `
        <div style="text-align:center;padding:20px;background:var(--bg-card);border:1px solid var(--gold);border-radius:var(--radius-lg);margin-top:16px">
          <div style="font-size:24px;margin-bottom:8px">🎉</div>
          <div style="font-weight:700;color:var(--gold)">Toutes les tâches complétées !</div>
          <div class="caption">Bonus de 1 000 GC réclamé</div>
        </div>
      ` : ''}
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- RACE ---
function renderRace() {
  const el = document.getElementById('page-race');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🏆 Daily Race</h1>
        <div class="badge badge-accent">⏱️ 6h 42m restantes</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding:12px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border)">
        <div>
          <div class="caption">Votre rang</div>
          <div style="font-size:24px;font-weight:700;color:var(--gold)">#6</div>
        </div>
        <div>
          <div class="caption">Votre score</div>
          <div style="font-size:24px;font-weight:700;color:var(--accent)">21 500</div>
        </div>
        <div>
          <div class="caption">Dotation restante</div>
          <div style="font-size:24px;font-weight:700;color:var(--success)">25 000 GC</div>
        </div>
      </div>
      ${MOCK.race.map(r => `
        <div class="race-entry ${r.rank <= 3 ? 'top3' : ''} ${r.isMe ? 'me' : ''}">
          <div class="rank ${r.rank === 1 ? 'top1' : r.rank === 2 ? 'top2' : r.rank === 3 ? 'top3' : ''}">${r.rank}</div>
          <div class="player-info">
            <div class="name">${r.name} ${r.isMe ? '<span class="badge badge-gold" style="font-size:10px">Vous</span>' : ''}</div>
            <div class="score">${r.score.toLocaleString()} GC misés</div>
          </div>
          <div class="prize">+${r.prize} GC</div>
        </div>
      `).join('')}
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- PROFILE ---
function renderProfile() {
  const el = document.getElementById('page-profile');
  if (!el) return;
  const u = MOCK.user;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>👤 Profil</h1>
      </div>
      <div class="profile-header">
        <div class="profile-avatar">${u.pseudo[0]}</div>
        <div class="profile-info">
          <h2>${u.pseudo}</h2>
          <div class="level">Niveau ${u.level} · ${u.rank}</div>
          <div class="joined">Membre depuis ${u.joined}</div>
        </div>
      </div>
      <div class="progress-bar" style="margin-bottom:20px">
        <div class="fill accent" style="width:${(u.xp / u.xpMax) * 100}%"></div>
      </div>
      <div class="caption" style="text-align:center;margin-bottom:20px">${u.xp} / ${u.xpMax} XP vers le prochain niveau</div>
      <div class="profile-stats">
        <div class="stat-card"><div class="value">${u.stats.gamesPlayed}</div><div class="label">Parties jouées</div></div>
        <div class="stat-card"><div class="value">${u.stats.wins}</div><div class="label">Victoires</div></div>
        <div class="stat-card"><div class="value">${u.stats.winRate}%</div><div class="label">Win Rate</div></div>
        <div class="stat-card"><div class="value">${u.stats.biggestWin.toLocaleString()}</div><div class="label">Plus gros gain</div></div>
      </div>
      <h3 style="margin-bottom:12px">🏅 Badges</h3>
      <div class="badge-grid">
        ${u.badges.map(b => `
          <div class="badge-item ${b.unlocked ? 'unlocked' : 'locked'}" data-tooltip="${b.name}">${b.icon}</div>
        `).join('')}
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- ADMIN DASHBOARD ---
function renderAdmin() {
  const el = document.getElementById('page-admin');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>⚙️ Admin Dashboard</h1>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <button class="nav-item active" onclick="state.adminTab='dashboard';renderAdmin()">📊 Dashboard</button>
          <button class="nav-item" onclick="window.location.hash='#admin-economy'">💰 Économie</button>
          <button class="nav-item" onclick="window.location.hash='#admin-users'">👥 Utilisateurs</button>
          <button class="nav-item" onclick="window.location.hash='#admin-logs'">📋 Audit</button>
        </div>
        <div class="admin-content">
          <div class="admin-stats">
            <div class="admin-stat">
              <div class="label">👥 Utilisateurs actifs</div>
              <div class="value" style="color:var(--accent)">1 247</div>
              <div class="change up">+12% aujourd'hui</div>
            </div>
            <div class="admin-stat">
              <div class="label">🎮 Parties jouées</div>
              <div class="value" style="color:var(--gold)">8 432</div>
              <div class="change up">+8% vs hier</div>
            </div>
            <div class="admin-stat">
              <div class="label">💰 House Account</div>
              <div class="value" style="color:var(--success)">48 234 500</div>
              <div class="change down">-1.2% aujourd'hui</div>
            </div>
            <div class="admin-stat">
              <div class="label">📈 RTP Moyen</div>
              <div class="value" style="color:var(--accent)">96.8%</div>
              <div class="change up">+0.3%</div>
            </div>
          </div>
          <div class="chart-placeholder">📊 Graphique d'activité (simulé)</div>
          <div style="margin-top:16px">
            <h3 style="margin-bottom:12px">Distribution par jeu</h3>
            <div class="chart-placeholder" style="height:150px">📊 Répartition des parties par jeu (simulé)</div>
          </div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// --- ADMIN ECONOMY ---
// =============================================
// FORGOT PASSWORD
// =============================================
function renderResetPassword() {
  const el = document.getElementById('page-reset-password');
  if (!el) return;
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card reset-card">
        <div class="logo">CASINO<span>X</span></div>
        <p class="subtitle">Réinitialisation de mot de passe</p>
        <div class="icon">🔐</div>
        <form id="reset-form">
          <div class="form-group">
            <label data-i18n="resetEmail">${t('resetEmail')}</label>
            <input class="input" type="email" placeholder="votre@email.com" style="width:100%" id="reset-email-input">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${t('resetSend')}</button>
        </form>
        <div class="auth-footer" style="margin-top:16px">
          <a href="#" data-nav="#login">${t('backToLogin')}</a>
        </div>
        <div id="reset-confirm" style="display:none;margin-top:16px;padding:16px;background:rgba(0,200,83,0.1);border-radius:var(--radius);color:var(--success)">
          ✅ Email de réinitialisation envoyé à <span id="reset-email-sent"></span>
        </div>
      </div>
    </div>
  `;
  document.getElementById('reset-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email-input').value;
    document.getElementById('reset-confirm').style.display = 'block';
    document.getElementById('reset-email-sent').textContent = email;
    document.getElementById('reset-form').style.display = 'none';
    showToast('Email de réinitialisation envoyé !', 'success');
  });
}

// =============================================
// RESPONSIBLE GAMING
// =============================================
function renderResponsibleGaming() {
  const el = document.getElementById('page-responsible-gaming');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎯 Jeu Responsable</h1>
      </div>
      <div class="rg-section">
        <h3>⏱️ Limites de temps</h3>
        <div class="rg-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span>Temps de jeu aujourd'hui</span>
            <span class="value">1h 24m</span>
          </div>
          <div class="progress-bar" style="margin-bottom:8px"><div class="fill accent" style="width:28%"></div></div>
          <span class="caption">Limite quotidienne : 5h</span>
        </div>
        <div class="rg-card" style="display:flex;justify-content:space-between;align-items:center">
          <span>Limite quotidienne</span>
          <select onchange="showToast('Limite de temps mise à jour','success')" style="max-width:120px">
            <option value="1">1h</option>
            <option value="2">2h</option>
            <option value="3">3h</option>
            <option value="5" selected>5h</option>
            <option value="0">Aucune</option>
          </select>
        </div>
      </div>
      <div class="rg-section">
        <h3>🚫 Auto-exclusion</h3>
        <div class="rg-card" style="display:flex;justify-content:space-between;align-items:center">
          <span>Période d'exclusion</span>
          <select onchange="showToast('Auto-exclusion activée pour '+this.value,'accent')" style="max-width:150px">
            <option value="">Sélectionner...</option>
            <option value="24h">24 heures</option>
            <option value="7j">7 jours</option>
            <option value="30j">30 jours</option>
            <option value="90j">90 jours</option>
          </select>
        </div>
        <button class="btn btn-secondary" onclick="showToast('Auto-exclusion activée. Vous serez déconnecté.','accent')">Activer l'auto-exclusion</button>
      </div>
      <div class="rg-section">
        <h3>🛡️ Limites de dépôt</h3>
        <div class="rg-card" style="display:flex;justify-content:space-between;align-items:center">
          <span>Limite quotidienne de dépôt</span>
          <select onchange="showToast('Limite de dépôt mise à jour','success')" style="max-width:120px">
            <option value="1000">1 000 GC</option>
            <option value="5000">5 000 GC</option>
            <option value="10000">10 000 GC</option>
            <option value="25000" selected>25 000 GC</option>
            <option value="0">Aucune</option>
          </select>
        </div>
      </div>
      <div class="rg-help">
        <div style="font-size:24px;margin-bottom:8px">💚</div>
        <h3>Besoin d'aide ?</h3>
        <p style="color:var(--text-secondary);margin:8px 0">Le jeu doit rester un divertissement. Si vous sentez que vous perdez le contrôle, n'hésitez pas à demander de l'aide.</p>
        <div class="phone">📞 09 74 75 13 13 (Joueurs Info Service)</div>
        <div style="margin-top:12px">
          <a href="https://www.joueurs-info-service.fr" target="_blank" class="btn btn-outline btn-sm">www.joueurs-info-service.fr</a>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// =============================================
// SHOP
// =============================================
const SHOP_PACKAGES = [
  { id: 1, tokens: 5000, price: '4,99 €', popular: false, bonus: 0 },
  { id: 2, tokens: 12000, price: '9,99 €', popular: true, bonus: 2000 },
  { id: 3, tokens: 30000, price: '19,99 €', popular: false, bonus: 8000 },
  { id: 4, tokens: 75000, price: '39,99 €', popular: false, bonus: 25000 },
  { id: 5, tokens: 200000, price: '89,99 €', popular: false, bonus: 100000 },
  { id: 6, tokens: 500000, price: '199,99 €', popular: false, bonus: 300000 },
];

function renderShop() {
  const el = document.getElementById('page-shop');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🛒 Boutique</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="shop-subtitle">Achetez des jetons pour profiter pleinement de l'expérience CasinoX</div>
      <div class="shop-grid">
        ${SHOP_PACKAGES.map(p => `
          <div class="shop-card ${p.popular ? 'popular' : ''}">
            ${p.popular ? '<div class="shop-badge">⭐ Populaire</div>' : ''}
            <div class="shop-tokens">
              <span class="amount">${p.tokens.toLocaleString()}</span>
              <span class="currency">GC</span>
            </div>
            ${p.bonus ? `<div class="shop-bonus">+ ${p.bonus.toLocaleString()} GC BONUS</div>` : ''}
            <div class="shop-price">${p.price}</div>
            <button class="btn ${p.popular ? 'btn-primary' : 'btn-outline'}" onclick="buyPackage(${p.id})">
              Acheter
            </button>
            <div class="shop-per-token">${(parseFloat(p.price.replace(',','.')) / (p.tokens + p.bonus) * 100).toFixed(2)}¢ / 100 GC</div>
          </div>
        `).join('')}
      </div>
      <div class="shop-note">💰 Les jetons achetés sont crédités instantanément sur votre compte. divertissement sans argent réel.</div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function buyPackage(id) {
  const pkg = SHOP_PACKAGES.find(p => p.id === id);
  if (!pkg) return;
  const total = pkg.tokens + (pkg.bonus || 0);
  state.balance += total;
  showToast(`🎉 +${total.toLocaleString()} GC crédités !`, 'success');
  updateHeader();
  renderShop();
}

// =============================================
// ADMIN USERS
// =============================================
const MOCK_USERS = Array.from({length: 25}, (_, i) => ({
  id: i + 1,
  pseudo: ['WhaleKing','LuckyStar','JackPotter','SpinMaster','DiamondHands','BetKing','SlotQueen','CardShark','DiceMaster','MegaWinner','GoldRush','LuckyDevil','SevenEleven','RoyalFlush','FullHouse','StraightFlush','AceHigh','DeuceLow','JokerWild','WildCard','HighRoller','LowStakes','MidTable','EndBoss','FinalBoss'][i] || `User${i+1}`,
  email: `user${i+1}@casino.com`,
  balance: Math.floor(Math.random() * 100000),
  status: Math.random() > 0.2 ? 'active' : 'suspended',
  registered: `2026-0${Math.floor(Math.random()*3)+1}-${String(Math.floor(Math.random()*28)+1).padStart(2,'0')}`,
  gamesPlayed: Math.floor(Math.random() * 5000)
}));

function renderAdminUsers() {
  const el = document.getElementById('page-admin-users');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#admin">← Admin</button>
        <h1>👥 Gestion Utilisateurs</h1>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <button class="nav-item" onclick="window.location.hash='#admin'">📊 Dashboard</button>
          <button class="nav-item" onclick="window.location.hash='#admin-economy'">💰 Économie</button>
          <button class="nav-item active">👥 Utilisateurs</button>
          <button class="nav-item" onclick="window.location.hash='#admin-logs'">📋 Audit</button>
        </div>
        <div class="admin-content">
          <div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">
            <input class="input" id="admin-users-search" placeholder="Rechercher par pseudo ou email..." style="flex:1" oninput="filterAdminUsers()">
            <span class="caption" id="admin-users-count">${MOCK_USERS.length} utilisateurs</span>
          </div>
          <div class="table-container">
            <table id="admin-users-table">
              <thead>
                <tr><th>ID</th><th>Pseudo</th><th>Email</th><th>Solde</th><th>Parties</th><th>Statut</th><th>Inscrit</th><th>Actions</th></tr>
              </thead>
              <tbody id="admin-users-tbody">
                ${MOCK_USERS.map(u => `
                  <tr>
                    <td>#${u.id}</td>
                    <td><strong>${u.pseudo}</strong></td>
                    <td>${u.email}</td>
                    <td style="color:var(--gold)">${u.balance.toLocaleString()} GC</td>
                    <td>${u.gamesPlayed}</td>
                    <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-error'}">${u.status === 'active' ? 'Actif' : 'Suspendu'}</span></td>
                    <td class="caption">${u.registered}</td>
                    <td>
                      <button class="btn btn-sm ${u.status === 'active' ? 'btn-outline' : 'btn-success'}" onclick="toggleUserStatus(${u.id})">${u.status === 'active' ? 'Suspendre' : 'Réactiver'}</button>
                      <button class="btn btn-sm btn-ghost" onclick="showToast('Utilisateur supprimé','error')">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function filterAdminUsers() {
  const q = document.getElementById('admin-users-search').value.toLowerCase();
  const rows = document.querySelectorAll('#admin-users-tbody tr');
  let count = 0;
  rows.forEach(row => {
    const match = row.textContent.toLowerCase().includes(q);
    row.style.display = match ? '' : 'none';
    if (match) count++;
  });
  document.getElementById('admin-users-count').textContent = count + ' utilisateurs';
}

function toggleUserStatus(id) {
  const u = MOCK_USERS.find(u => u.id === id);
  if (!u) return;
  u.status = u.status === 'active' ? 'suspended' : 'active';
  showToast(`${u.pseudo} ${u.status === 'active' ? 'réactivé' : 'suspendu'}`, u.status === 'active' ? 'success' : 'accent');
  renderAdminUsers();
}

function renderAdminLogs() {
  const el = document.getElementById('page-admin-logs');
  if (!el) return;
  const logs = MOCK_AUDIT_LOGS || [];
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#admin">← Admin</button>
        <h1>📋 Audit Logs</h1>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <button class="nav-item" onclick="window.location.hash='#admin'">📊 Dashboard</button>
          <button class="nav-item" onclick="window.location.hash='#admin-economy'">💰 Économie</button>
          <button class="nav-item" onclick="window.location.hash='#admin-users'">👥 Utilisateurs</button>
          <button class="nav-item active">📋 Audit</button>
        </div>
        <div class="admin-content">
          <div class="table-container">
            <table>
              <thead>
                <tr><th>Date</th><th>Admin</th><th>Action</th><th>Avant</th><th>Après</th></tr>
              </thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td class="caption">${l.date}</td>
                    <td><strong>${l.admin}</strong></td>
                    <td>${l.action}</td>
                    <td class="caption">${l.before || '-'}</td>
                    <td class="caption">${l.after || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

const MOCK_AUDIT_LOGS = [
  { date: '2026-07-22 10:32', admin: 'Admin1', action: 'Suspension utilisateur', before: 'Actif', after: 'Suspendu' },
  { date: '2026-07-22 09:15', admin: 'Admin2', action: 'Modification house edge Slots', before: '4%', after: '3.5%' },
  { date: '2026-07-22 08:00', admin: 'Admin1', action: 'Recharge House Account', before: '47 234 500', after: '48 234 500' },
  { date: '2026-07-21 23:45', admin: 'Admin3', action: 'Réactivation compte', before: 'Suspendu', after: 'Actif' },
  { date: '2026-07-21 18:20', admin: 'Admin2', action: 'Modification daily reward', before: '500', after: '1000' },
  { date: '2026-07-21 14:00', admin: 'Admin1', action: 'Suppression compte frauduleux', before: '#1089', after: 'Supprimé' },
  { date: '2026-07-20 11:30', admin: 'Admin3', action: 'Bonus manuel', before: '-', after: '+5000 GC à User#42' },
  { date: '2026-07-20 09:00', admin: 'Admin2', action: 'Changement limite dépôt', before: '5000', after: '10000' },
];

// =============================================
// I18N
// =============================================
window.lang = 'fr';
window.translations = {
  fr: {
    loginTitle: 'Se connecter',
    registerTitle: 'Créer mon compte',
    email: 'Email',
    password: 'Mot de passe',
    pseudo: 'Pseudo',
    birthDate: 'Date de naissance (18+)',
    cgu: 'En créant un compte, j\'accepte les CGU et la politique de confidentialité',
    googleLogin: 'Connexion avec Google',
    googleRegister: 'S\'inscrire avec Google',
    noAccount: 'Pas encore de compte ?',
    hasAccount: 'Déjà un compte ?',
    signup: 'S\'inscrire',
    login: 'Se connecter',
    lobby: 'Lobby',
    games: 'Jeux',
    tasks: 'Tâches',
    race: 'Course',
    profile: 'Profil',
    admin: 'Admin',
    balance: 'Solde',
    dailyReward: 'Récompense quotidienne',
    claim: 'Réclamer',
    claimed: 'Réclamé',
    nextReward: 'Prochaine récompense',
    back: 'Retour',
    bet: 'Mise',
    spin: 'SPIN',
    hit: 'Tirer',
    stand: 'Rester',
    double: 'Double',
    split: 'Split',
    surrender: 'Abandon',
    deal: 'Distribuer',
    placeBet: 'Placez au moins une mise',
    insufficientFunds: 'Solde insuffisant',
    win: 'Gagné',
    lose: 'Perdu',
    cashOut: 'Cash Out',
    launch: 'Lancer',
    play: 'Jouer',
    drop: 'Lâcher',
    roll: 'Lancer',
    draw: 'Tirer',
    newCard: 'Nouvelle carte',
    join: 'Rejoindre',
    waitlist: 'Waitlist',
    create: 'Créer',
    resetEmail: 'Email',
    resetSend: 'Envoyer le lien de réinitialisation',
    backToLogin: 'Retour à la connexion',
    forgotPassword: 'Mot de passe oublié ?',
    responsibleGaming: 'Jeu Responsable',
    timeLimit: 'Limites de temps',
    selfExclusion: 'Auto-exclusion',
    help: 'Besoin d\'aide ?',
    chat: 'Chat',
    send: 'Envoyer',
    editProfile: 'Modifier le profil',
    transactionHistory: 'Historique des transactions',
    adminUsers: 'Utilisateurs',
    adminLogs: 'Audit',
    adminEconomy: 'Économie',
    adminDashboard: 'Dashboard',
    solo: 'Solo',
    multi: 'Multi',
    autoSpin: 'Auto Spin',
    autoCashout: 'Auto cashout à',
    insurance: 'Assurance',
    passLine: 'Pass Line',
    dontPass: 'Don\'t Pass',
    field: 'Field',
    any7: 'Any 7',
    come: 'Come',
    dontCome: 'Don\'t Come',
    place: 'Place',
    proposition: 'Proposition',
  },
  en: {
    loginTitle: 'Sign In',
    registerTitle: 'Create Account',
    email: 'Email',
    password: 'Password',
    pseudo: 'Username',
    birthDate: 'Date of Birth (18+)',
    cgu: 'By creating an account, I agree to the Terms and Privacy Policy',
    googleLogin: 'Sign in with Google',
    googleRegister: 'Sign up with Google',
    noAccount: 'Don\'t have an account?',
    hasAccount: 'Already have an account?',
    signup: 'Sign Up',
    login: 'Sign In',
    lobby: 'Lobby',
    games: 'Games',
    tasks: 'Tasks',
    race: 'Race',
    profile: 'Profile',
    admin: 'Admin',
    balance: 'Balance',
    dailyReward: 'Daily Reward',
    claim: 'Claim',
    claimed: 'Claimed',
    nextReward: 'Next Reward',
    back: 'Back',
    bet: 'Bet',
    spin: 'SPIN',
    hit: 'Hit',
    stand: 'Stand',
    double: 'Double',
    split: 'Split',
    surrender: 'Surrender',
    deal: 'Deal',
    placeBet: 'Place at least one bet',
    insufficientFunds: 'Insufficient balance',
    win: 'Win',
    lose: 'Lose',
    cashOut: 'Cash Out',
    launch: 'Launch',
    play: 'Play',
    drop: 'Drop',
    roll: 'Roll',
    draw: 'Draw',
    newCard: 'New Card',
    join: 'Join',
    waitlist: 'Waitlist',
    create: 'Create',
    resetEmail: 'Email',
    resetSend: 'Send Reset Link',
    backToLogin: 'Back to Login',
    forgotPassword: 'Forgot Password?',
    responsibleGaming: 'Responsible Gaming',
    timeLimit: 'Time Limits',
    selfExclusion: 'Self-Exclusion',
    help: 'Need Help?',
    chat: 'Chat',
    send: 'Send',
    editProfile: 'Edit Profile',
    transactionHistory: 'Transaction History',
    adminUsers: 'Users',
    adminLogs: 'Audit Logs',
    adminEconomy: 'Economy',
    adminDashboard: 'Dashboard',
    solo: 'Solo',
    multi: 'Multi',
    autoSpin: 'Auto Spin',
    autoCashout: 'Auto cashout at',
    insurance: 'Insurance',
    passLine: 'Pass Line',
    dontPass: 'Don\'t Pass',
    field: 'Field',
    any7: 'Any 7',
    come: 'Come',
    dontCome: 'Don\'t Come',
    place: 'Place',
    proposition: 'Proposition',
  }
};

function t(key) {
  return (window.translations[window.lang] || window.translations.fr)[key] || key;
}

function toggleLang() {
  window.lang = window.lang === 'fr' ? 'en' : 'fr';
  document.getElementById('lang-toggle').textContent = window.lang === 'fr' ? 'EN' : 'FR';
  renderPage(state.currentPage);
  showToast(window.lang === 'en' ? 'Language changed to English' : 'Langue changée en français', 'accent');
}

// =============================================
// CHAT
// =============================================
const CHAT_MESSAGES = [
  { author: 'WhaleKing', text: 'Belle victoire sur le slot 5 !', time: '14:32', own: false },
  { author: 'LuckyStar', text: 'Qui joue au Blackjack ?', time: '14:30', own: false },
  { author: 'Vous', text: 'Je tente le crash à 3x', time: '14:28', own: true },
  { author: 'JackPotter', text: 'Jackpot sur la roulette ! 🎉', time: '14:25', own: false },
  { author: 'DiamondHands', text: 'Nouveau record personnel aux mines', time: '14:20', own: false },
];

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) updateChatMessages();
}

function updateChatMessages() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = CHAT_MESSAGES.map(m => `
    <div class="chat-msg ${m.own ? 'own' : ''}">
      <div class="author">${m.author}</div>
      <div class="text">${m.text}</div>
      <div class="time">${m.time}</div>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChatMsg() {
  const input = document.getElementById('chat-input');
  if (!input.value.trim()) return;
  CHAT_MESSAGES.push({
    author: 'Vous',
    text: input.value.trim(),
    time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
    own: true
  });
  input.value = '';
  updateChatMessages();
  // Mock reply after 1s
  const names = ['WhaleKing','LuckyStar','JackPotter','BotBet99','CrashKing'];
  setTimeout(() => {
    CHAT_MESSAGES.push({
      author: names[Math.floor(Math.random() * names.length)],
      text: ['Bien joué !','Tu tentes quoi ?','Bonne chance !','Mise max !','Let\'s go !'][Math.floor(Math.random() * 5)],
      time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
      own: false
    });
    updateChatMessages();
  }, 1500);
}

// =============================================
// PROFILE EDIT & TRANSACTIONS
// =============================================
const MOCK_AVATARS = ['🥇','🦁','🐉','👑','🦅','🌟','🔥','💎','🎯','🃏','♠️','🎰'];

const MOCK_TRANSACTIONS = Array.from({length: 30}, (_, i) => {
  const types = ['deposit','withdraw','bet','win'];
  const type = types[Math.floor(Math.random() * types.length)];
  const amount = type === 'deposit' || type === 'win' ? Math.floor(Math.random() * 5000) + 100 : -(Math.floor(Math.random() * 2000) + 50);
  const days = Math.floor(Math.random() * 30);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return {
    date: d.toISOString().split('T')[0],
    type,
    amount,
    description: type === 'deposit' ? 'Dépôt' : type === 'withdraw' ? 'Retrait' : type === 'bet' ? 'Mise' : 'Gain'
  };
});

function renderProfile() {
  const el = document.getElementById('page-profile');
  if (!el) return;
  const u = MOCK.user;
  const filterType = state.txFilter || 'all';
  const filtered = filterType === 'all' ? MOCK_TRANSACTIONS : MOCK_TRANSACTIONS.filter(t => t.type === filterType);
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>👤 Profil</h1>
        <button class="btn btn-primary btn-sm" onclick="openAvatarModal()">✏️ Modifier</button>
      </div>
      <div class="profile-header">
        <div class="profile-avatar" id="profile-avatar-display">${MOCK.user.customAvatar || u.pseudo[0]}</div>
        <div class="profile-info">
          <h2 id="profile-pseudo-display">${u.pseudo}</h2>
          <div class="level">Niveau ${u.level} · ${u.rank}</div>
          <div class="joined">Membre depuis ${u.joined}</div>
        </div>
      </div>
      <div class="progress-bar" style="margin-bottom:20px">
        <div class="fill accent" style="width:${(u.xp / u.xpMax) * 100}%"></div>
      </div>
      <div class="caption" style="text-align:center;margin-bottom:20px">${u.xp} / ${u.xpMax} XP vers le prochain niveau</div>
      <div class="profile-stats">
        <div class="stat-card"><div class="value">${u.stats.gamesPlayed}</div><div class="label">Parties jouées</div></div>
        <div class="stat-card"><div class="value">${u.stats.wins}</div><div class="label">Victoires</div></div>
        <div class="stat-card"><div class="value">${u.stats.winRate}%</div><div class="label">Win Rate</div></div>
        <div class="stat-card"><div class="value">${u.stats.biggestWin.toLocaleString()}</div><div class="label">Plus gros gain</div></div>
      </div>
      <h3 style="margin-bottom:12px">🏅 Badges</h3>
      <div class="badge-grid" style="margin-bottom:24px">
        ${u.badges.map(b => `
          <div class="badge-item ${b.unlocked ? 'unlocked' : 'locked'}" data-tooltip="${b.name}">${b.icon}</div>
        `).join('')}
      </div>
      <h3 style="margin-bottom:12px">💰 Historique des transactions</h3>
      <div class="tx-filters">
        <button class="bet-quick ${filterType === 'all' ? 'active' : ''}" style="${filterType === 'all' ? 'border-color:var(--gold);color:var(--gold)' : ''}" onclick="state.txFilter='all';renderProfile()">Tout</button>
        <button class="bet-quick ${filterType === 'deposit' ? 'active' : ''}" style="${filterType === 'deposit' ? 'border-color:var(--gold);color:var(--gold)' : ''}" onclick="state.txFilter='deposit';renderProfile()">Dépôts</button>
        <button class="bet-quick ${filterType === 'win' ? 'active' : ''}" style="${filterType === 'win' ? 'border-color:var(--gold);color:var(--gold)' : ''}" onclick="state.txFilter='win';renderProfile()">Gains</button>
        <button class="bet-quick ${filterType === 'bet' ? 'active' : ''}" style="${filterType === 'bet' ? 'border-color:var(--gold);color:var(--gold)' : ''}" onclick="state.txFilter='bet';renderProfile()">Mises</button>
        <button class="bet-quick ${filterType === 'withdraw' ? 'active' : ''}" style="${filterType === 'withdraw' ? 'border-color:var(--gold);color:var(--gold)' : ''}" onclick="state.txFilter='withdraw';renderProfile()">Retraits</button>
      </div>
      <div class="table-container" style="margin-bottom:24px">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Montant</th></tr></thead>
          <tbody>
            ${filtered.slice(0, 15).map(t => `
              <tr>
                <td class="caption">${t.date}</td>
                <td><span class="tx-badge ${t.type}">${t.description}</span></td>
                <td style="color:${t.amount > 0 ? 'var(--success)' : 'var(--error)'};font-weight:600">${t.amount > 0 ? '+' : ''}${t.amount.toLocaleString()} GC</td>
              </tr>
            `).join('')}
            ${filtered.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Aucune transaction</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      <div style="text-align:center;margin:16px 0">
        <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#admin'" style="color:var(--text-muted)">⚙️ Administration</button>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function openAvatarModal() {
  const existing = document.querySelector('.modal-overlay.active');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal">
      <h2>✏️ Modifier le profil</h2>
      <div class="form-group">
        <label>Pseudo</label>
        <input class="input" id="edit-pseudo" value="${MOCK.user.pseudo}" style="width:100%">
      </div>
      <div class="form-group">
        <label>Avatar</label>
        <div class="avatar-grid">
          ${MOCK_AVATARS.map(a => `
            <div class="avatar-option ${MOCK.user.customAvatar === a ? 'selected' : ''}" onclick="selectAvatar('${a}')">${a}</div>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveProfile()">💾 Sauvegarder</button>
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function selectAvatar(emoji) {
  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  const target = Array.from(document.querySelectorAll('.avatar-option')).find(el => el.textContent === emoji);
  if (target) target.classList.add('selected');
  MOCK.user.customAvatar = emoji;
}

function saveProfile() {
  const pseudo = document.getElementById('edit-pseudo')?.value;
  if (pseudo && pseudo.trim()) {
    MOCK.user.pseudo = pseudo.trim();
    showToast('Profil mis à jour !', 'success');
    document.querySelector('.modal-overlay')?.remove();
    renderProfile();
    updateHeader();
  }
}

// =============================================
// SLOTS 4 & 5
// =============================================
function renderSlots4() {
  const el = document.getElementById('page-slots4');
  if (!el) return;
  const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐', '🔔'];
  const jackpot = 100000;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎰 Slot 4 Rlx</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance" id="slot4-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="slot-machine">
          <div class="slot-machine-header">
            <div class="slot-machine-title">★ DIAMOND 4 ★</div>
            <div class="slot-machine-jackpot">JACKPOT ${jackpot.toLocaleString()} GC</div>
          </div>
          <div class="slot-reels-container">
            <div class="slot-reels">
              ${[0,1,2,3].map(i => `
                <div class="slot-reel" id="slot4-reel-${i}"><span class="symbol">${symbols[i]}</span></div>
              `).join('')}
            </div>
          </div>
          <div class="slot-lines">
            ${[1,2,3,4,5].map(i => `
              <button class="slot-line-btn ${i <= state.slotLines ? 'active' : ''}"
                onclick="state.slotLines=${i};renderSlots4()">${i} ligne${i > 1 ? 's' : ''}</button>
            `).join('')}
          </div>
          <div class="slot-controls-panel">
            <div class="slot-credit-display">
              <div class="slot-credit-item">
                <div class="label">Mise</div>
                <div class="value">${state.slotBet * state.slotLines}</div>
              </div>
              <div class="slot-credit-item">
                <div class="label">Crédit</div>
                <div class="value" id="slot4-credit">${state.balance.toLocaleString()}</div>
              </div>
              <div class="slot-credit-item">
                <div class="label">Gain</div>
                <div class="value" id="slot4-win">0</div>
              </div>
            </div>
            <div class="game-controls" style="justify-content:center;flex-wrap:wrap">
              <div class="bet-selector">
                <span class="label">Mise :</span>
                <div class="bet-amount">
                  ${[10, 25, 50, 100].map(v => `
                    <button class="bet-quick ${state.slotBet === v ? 'active' : ''}"
                      onclick="state.slotBet=${v};renderSlots4()" style="${state.slotBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                  `).join('')}
                </div>
              </div>
              <div class="auto-controls">
                <button class="btn btn-outline btn-sm" onclick="slot4Spin()">🎰 SPIN</button>
                <button class="btn btn-ghost btn-sm" onclick="slot4AutoSpin()">🔄 ${state.slot4Auto ? state.slot4Auto + ' restants' : 'Auto'}</button>
                <select id="slot4-autospin-count" style="width:60px;padding:4px;font-size:12px"><option>5</option><option>10</option><option>25</option><option>50</option><option>100</option></select>
              </div>
            </div>
          </div>
          <div class="game-result" id="slot4-result"></div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function slot4Spin() {
  if (state.slotSpinning) return;
  if (state.balance < state.slotBet) { showToast('Solde insuffisant !', 'error'); return; }
  state.slotSpinning = true;
  state.balance -= state.slotBet;
  updateHeader();
  const reels = [0,1,2,3];
  const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐', '🔔'];
  reels.forEach(i => document.getElementById(`slot4-reel-${i}`)?.classList.add('spinning'));
  document.getElementById('slot4-result').textContent = '';
  document.getElementById('slot4-win').textContent = '0';
  setTimeout(() => {
    const results = reels.map(() => symbols[Math.floor(Math.random() * symbols.length)]);
    reels.forEach(i => {
      const reel = document.getElementById(`slot4-reel-${i}`);
      if (reel) { reel.classList.remove('spinning'); reel.classList.add('landing'); reel.querySelector('.symbol').textContent = results[i]; }
    });
    const allSame = results.every(r => r === results[0]);
    let winAmount = 0;
    if (allSame) { winAmount = state.slotBet * state.slotLines * 20; showToast(`🎉 JACKPOT 4 Rlx ! +${winAmount} GC`, 'gold'); }
    else if (results[0] === results[1] && results[1] === results[2]) { winAmount = state.slotBet * state.slotLines * 5; }
    else if (results.filter((r,i) => r === results[0] || r === results[1]).length >= 2) { winAmount = state.slotBet * state.slotLines * 2; }
    state.balance += winAmount;
    const rEl = document.getElementById('slot4-result');
    if (rEl) { rEl.textContent = winAmount > 0 ? `🎉 +${winAmount} GC` : '❌ Perdu'; rEl.className = `game-result ${winAmount > 0 ? 'win' : 'lose'}`; }
    document.getElementById('slot4-win').textContent = winAmount.toLocaleString();
    document.getElementById('slot4-credit').textContent = state.balance.toLocaleString();
    state.slotSpinning = false;
    updateHeader();
    if (state.slot4Auto && state.slot4Auto > 0) { state.slot4Auto--; setTimeout(slot4Spin, 500); }
  }, 1200);
}

function slot4AutoSpin() {
  const sel = document.getElementById('slot4-autospin-count');
  state.slot4Auto = parseInt(sel?.value || 10);
  slot4Spin();
}

function renderSlots5() {
  const el = document.getElementById('page-slots5');
  if (!el) return;
  const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '👑', '💰', '🔥'];
  const jackpot = 250000;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎰 Slot 5 Rlx</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance" id="slot5-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="slot-machine">
          <div class="slot-machine-header">
            <div class="slot-machine-title">★ MEGA ROYALE ★</div>
            <div class="slot-machine-jackpot">JACKPOT ${jackpot.toLocaleString()} GC</div>
          </div>
          <div class="slot-reels-container">
            <div class="slot-reels">
              ${[0,1,2,3,4].map(i => `
                <div class="slot-reel" id="slot5-reel-${i}"><span class="symbol">${symbols[i]}</span></div>
              `).join('')}
            </div>
          </div>
          <div class="slot-lines">
            ${[1,2,3,4,5,7,10].map(i => `
              <button class="slot-line-btn ${i <= state.slotLines ? 'active' : ''}"
                onclick="state.slotLines=${i};renderSlots5()">${i} ligne${i > 1 ? 's' : ''}</button>
            `).join('')}
          </div>
          <div class="slot-controls-panel">
            <div class="slot-credit-display">
              <div class="slot-credit-item">
                <div class="label">Mise</div>
                <div class="value">${state.slotBet * state.slotLines}</div>
              </div>
              <div class="slot-credit-item">
                <div class="label">Crédit</div>
                <div class="value" id="slot5-credit">${state.balance.toLocaleString()}</div>
              </div>
              <div class="slot-credit-item">
                <div class="label">Gain</div>
                <div class="value" id="slot5-win">0</div>
              </div>
            </div>
            <div class="game-controls" style="justify-content:center;flex-wrap:wrap">
              <div class="bet-selector">
                <span class="label">Mise :</span>
                <div class="bet-amount">
                  ${[10, 25, 50, 100, 250].map(v => `
                    <button class="bet-quick ${state.slotBet === v ? 'active' : ''}"
                      onclick="state.slotBet=${v};renderSlots5()" style="${state.slotBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                  `).join('')}
                </div>
              </div>
              <div class="auto-controls">
                <button class="btn btn-primary btn-lg" onclick="slot5Spin()">🎰 SPIN</button>
                <button class="btn btn-ghost btn-sm" onclick="slot5AutoSpin()">🔄 ${state.slot5Auto ? state.slot5Auto + ' restants' : 'Auto'}</button>
                <select id="slot5-autospin-count" style="width:60px;padding:4px;font-size:12px"><option>5</option><option>10</option><option>25</option><option>50</option><option>100</option></select>
              </div>
            </div>
          </div>
          <div class="game-result" id="slot5-result"></div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function slot5Spin() {
  if (state.slotSpinning) return;
  if (state.balance < state.slotBet) { showToast('Solde insuffisant !', 'error'); return; }
  state.slotSpinning = true;
  state.balance -= state.slotBet;
  updateHeader();
  const reels = [0,1,2,3,4];
  const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '👑', '💰', '🔥'];
  reels.forEach(i => document.getElementById(`slot5-reel-${i}`)?.classList.add('spinning'));
  document.getElementById('slot5-result').textContent = '';
  document.getElementById('slot5-win').textContent = '0';
  setTimeout(() => {
    const results = reels.map(() => symbols[Math.floor(Math.random() * symbols.length)]);
    reels.forEach(i => {
      const reel = document.getElementById(`slot5-reel-${i}`);
      if (reel) { reel.classList.remove('spinning'); reel.classList.add('landing'); reel.querySelector('.symbol').textContent = results[i]; }
    });
    const allSame = results.every(r => r === results[0]);
    let winAmount = 0;
    if (allSame) { winAmount = state.slotBet * state.slotLines * 50; showToast(`🎉 MEGA JACKPOT 5 Rlx ! +${winAmount} GC`, 'gold'); }
    else if (results[0] === results[1] && results[1] === results[2] && results[2] === results[3]) { winAmount = state.slotBet * state.slotLines * 10; }
    else if (results[0] === results[1] && results[1] === results[2]) { winAmount = state.slotBet * state.slotLines * 3; }
    state.balance += winAmount;
    const rEl = document.getElementById('slot5-result');
    if (rEl) { rEl.textContent = winAmount > 0 ? `🎉 +${winAmount} GC` : '❌ Perdu'; rEl.className = `game-result ${winAmount > 0 ? 'win' : 'lose'}`; }
    document.getElementById('slot5-win').textContent = winAmount.toLocaleString();
    document.getElementById('slot5-credit').textContent = state.balance.toLocaleString();
    state.slotSpinning = false;
    updateHeader();
    if (state.slot5Auto && state.slot5Auto > 0) { state.slot5Auto--; setTimeout(slot5Spin, 500); }
  }, 1200);
}

function slot5AutoSpin() {
  const sel = document.getElementById('slot5-autospin-count');
  state.slot5Auto = parseInt(sel?.value || 10);
  slot5Spin();
}

// =============================================
// BLACKJACK INSURANCE
// =============================================
function bjDeal() {
  if (state.balance < state.bjBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.bjBet;
  state.bjHand = [state.bjDeck.pop(), state.bjDeck.pop()];
  state.bjDealer = [state.bjDeck.pop(), state.bjDeck.pop()];
  state.bjGameOver = false;
  state.bjResult = '';
  state.bjInsuranceOffered = false;
  renderBlackjack();
  updateHeader();
}

function bjCheckInsurance() {
  if (state.bjDealer.length && state.bjDealer[0].value === 'A' && !state.bjInsuranceOffered && state.bjHand.length) {
    state.bjInsuranceOffered = true;
    return true;
  }
  return false;
}

function bjTakeInsurance() {
  const insuranceBet = Math.floor(state.bjBet / 2);
  if (state.balance < insuranceBet) { showToast('Solde insuffisant !', 'error'); return; }
  state.balance -= insuranceBet;
  if (state.bjDealer[1] && state.bjDealer[1].value === '10') {
    const payout = insuranceBet * 3;
    state.balance += payout;
    showToast(`Assurance payée ! +${payout} GC (Blackjack croupier)`, 'success');
  } else {
    showToast('Pas de Blackjack croupier — assurance perdue', 'accent');
  }
  renderBlackjack();
  updateHeader();
}

// =============================================
// PLINKO MULTI-BALL
// =============================================
function plinkoDrop() {
  const multiCount = state.plinkoMultiBalls || 1;
  if (state.balance < state.plinkoBet * multiCount) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  const multipliers = { low: [1.1,1.3,1.5,2,3,5,3,2,1.5,1.3,1.1], medium: [0.5,1,2,5,10,20,10,5,2,1,0.5], high: [0.1,0.5,2,10,50,100,50,10,2,0.5,0.1] };
  const mults = multipliers[state.plinkoRisk] || multipliers.medium;
  let totalWin = 0;
  let msg = '';
  for (let b = 0; b < multiCount; b++) {
    state.balance -= state.plinkoBet;
    const slot = Math.floor(Math.random() * mults.length);
    const mult = mults[slot];
    const win = Math.floor(state.plinkoBet * mult);
    state.balance += win;
    totalWin += win;
    msg += `${mult}x `;
  }
  const resultEl = document.getElementById('plinko-result');
  if (resultEl) {
    resultEl.textContent = multiCount > 1 ? `🎯 ${multiCount} billes: ${msg.trim()} → Total: ${totalWin >= 0 ? '+' : ''}${totalWin} GC` : `🎯 ${msg.trim()} → ${totalWin >= state.plinkoBet ? '+' : ''}${totalWin} GC`;
    resultEl.className = `game-result ${totalWin >= state.plinkoBet * multiCount ? 'win' : 'lose'}`;
  }
  updateHeader();
}

// =============================================
// CRASH AUTO CASHOUT
// =============================================
function crashStart() {
  if (state.balance < state.crashBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.crashBet;
  state.crashRunning = true;
  state.crashCashedOut = false;
  state.crashMultiplier = 1.00;
  updateHeader();

  const crashPoint = 1 + Math.random() * 9;
  const multEl = document.getElementById('crash-multiplier');
  const btn = document.getElementById('crash-action-btn');
  if (btn) btn.textContent = '💰 Cash Out';

  const autoCashout = state.crashAutoCashout || 0;

  const interval = setInterval(() => {
    if (!state.crashRunning) { clearInterval(interval); return; }
    state.crashMultiplier += 0.01 + (Math.random() * 0.05);
    if (multEl) multEl.textContent = state.crashMultiplier.toFixed(2) + 'x';

    // Auto cashout check
    if (autoCashout > 0 && state.crashMultiplier >= autoCashout && !state.crashCashedOut) {
      crashCashOut();
      clearInterval(interval);
      return;
    }

    if (state.crashMultiplier >= crashPoint) {
      clearInterval(interval);
      state.crashRunning = false;
      if (multEl) { multEl.textContent = '💥 CRASH !'; multEl.classList.add('crashed'); }
      if (!state.crashCashedOut) {
        document.getElementById('crash-result').textContent = '💥 Crash ! Vous avez tout perdu';
        document.getElementById('crash-result').className = 'game-result lose';
      }
      if (btn) btn.textContent = '🚀 Rejouer';
      setTimeout(() => { if (multEl) multEl.classList.remove('crashed'); }, 2000);
    }
  }, 50);
}

// =============================================
// CRAPS — MORE BET TYPES
// =============================================
function renderCraps() {
  const el = document.getElementById('page-craps');
  if (!el) return;
  const dice = state.crapsDice || [1, 1];
  const betTypes = [
    { key: 'pass', label: 'Pass Line', payout: '1:1' },
    { key: 'dontpass', label: 'Don\'t Pass', payout: '1:1' },
    { key: 'field', label: 'Field', payout: '2:1' },
    { key: 'any7', label: 'Any 7', payout: '4:1' },
    { key: 'come', label: 'Come', payout: '1:1' },
    { key: 'dontcome', label: 'Don\'t Come', payout: '1:1' },
    { key: 'place6', label: 'Place 6', payout: '7:6' },
    { key: 'place8', label: 'Place 8', payout: '7:6' },
    { key: 'hardway', label: 'Hard Way', payout: '7:1' },
    { key: 'yo', label: 'Yo (11)', payout: '15:1' },
  ];
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🎲 Dés / Craps</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="craps-table">
          <div class="craps-dice">
            <div class="craps-die">${dice[0]}</div>
            <div class="craps-die">${dice[1]}</div>
          </div>
          <div style="text-align:center;font-size:24px;font-weight:700;color:var(--gold)" id="craps-total">Total : ${dice[0] + dice[1]}</div>
          <div class="craps-bets" style="margin-top:16px">
            ${betTypes.map(b => `
              <button class="craps-bet-btn ${state.crapsBetType === b.key ? 'active' : ''}" onclick="state.crapsBetType='${b.key}';renderCraps()">${b.label} (${b.payout})</button>
            `).join('')}
          </div>
          <div class="game-controls" style="justify-content:center;margin-top:16px;flex-wrap:wrap">
            <div class="bet-selector">
              <span class="label">Mise :</span>
              <div class="bet-amount">
                ${[10, 25, 50, 100].map(v => `
                  <button class="bet-quick ${state.crapsBet === v ? 'active' : ''}"
                    onclick="state.crapsBet=${v};renderCraps()"
                    style="${state.crapsBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
                `).join('')}
              </div>
            </div>
            <button class="btn btn-primary btn-lg" onclick="crapsRoll()">🎲 Lancer</button>
          </div>
          <div class="game-result" id="craps-result"></div>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

function crapsRoll() {
  if (state.balance < state.crapsBet) {
    showToast('Solde insuffisant !', 'error');
    return;
  }
  state.balance -= state.crapsBet;
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  state.crapsDice = [d1, d2];
  const total = d1 + d2;
  let won = false;

  switch(state.crapsBetType) {
    case 'pass': won = total === 7 || total === 11; break;
    case 'dontpass': won = total === 2 || total === 3; break;
    case 'field': won = [2,3,4,9,10,11,12].includes(total); break;
    case 'any7': won = total === 7; break;
    case 'come': won = total === 7 || total === 11; break;
    case 'dontcome': won = total === 2 || total === 3; break;
    case 'place6': won = total === 6; break;
    case 'place8': won = total === 8; break;
    case 'hardway': won = d1 === d2 && (total === 4 || total === 6 || total === 8 || total === 10); break;
    case 'yo': won = total === 11; break;
  }

  if (won) {
    const mults = { pass: 2, dontpass: 2, field: 2, any7: 5, come: 2, dontcome: 2, place6: 7/6, place8: 7/6, hardway: 8, yo: 16 };
    const win = Math.floor(state.crapsBet * (mults[state.crapsBetType] || 2));
    state.balance += win;
    document.getElementById('craps-result').textContent = `🎉 Gagné ! +${win} GC`;
    document.getElementById('craps-result').className = 'game-result win';
  } else {
    document.getElementById('craps-result').textContent = '❌ Perdu';
    document.getElementById('craps-result').className = 'game-result lose';
  }
  renderCraps();
  updateHeader();
}

// =============================================
// BINGO — SOLO/MULTI MODE
// =============================================
function renderBingo() {
  const el = document.getElementById('page-bingo');
  if (!el) return;

  if (!state.bingoCard) {
    state.bingoCard = [];
    for (let r = 0; r < 5; r++) {
      const row = [];
      for (let c = 0; c < 5; c++) {
        const letter = ['B','I','N','G','O'][c];
        const min = c * 15 + 1;
        const max = min + 14;
        row.push({ num: c === 2 && r === 2 ? 'FREE' : Math.floor(Math.random() * 15) + min, marked: c === 2 && r === 2 });
      }
      state.bingoCard.push(row);
    }
    state.bingoDrawn = [];
  }

  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#lobby">← Retour</button>
        <h1>🔢 Bingo</h1>
        <div class="balance-display">
          <span class="label">Solde</span>
          <span class="value game-balance">${state.balance.toLocaleString()}</span>
          <span class="caption" style="color:var(--text-muted)">GC</span>
        </div>
      </div>
      <div class="game-container">
        <div class="bingo-mode-toggle">
          <button class="btn btn-sm ${!state.bingoMulti ? 'btn-primary' : 'btn-ghost'}" onclick="state.bingoMulti=false;renderBingo()">Solo</button>
          <button class="btn btn-sm ${state.bingoMulti ? 'btn-primary' : 'btn-ghost'}" onclick="state.bingoMulti=true;renderBingo()">Multi</button>
        </div>
        ${state.bingoMulti ? '<div class="badge badge-accent" style="margin-bottom:12px;">👥 3 joueurs dans la salle · Jackpot: 5 000 GC</div>' : ''}
        <div style="text-align:center;margin-bottom:16px">
          <div style="display:flex;justify-content:center;gap:8px;margin-bottom:8px">
            ${['B','I','N','G','O'].map(l => `<span style="font-weight:700;color:var(--gold);font-size:18px">${l}</span>`).join('')}
          </div>
          <div class="bingo-card">
            ${state.bingoCard.flat().map(cell => `
              <div class="bingo-cell ${cell.marked ? 'marked' : ''} ${cell.num === 'FREE' ? 'free' : ''}">${cell.num}</div>
            `).join('')}
          </div>
        </div>
        <div class="bingo-numbers" id="bingo-numbers">
          ${state.bingoDrawn.map(n => `<span class="bingo-number drawn">${n}</span>`).join('')}
        </div>
        <div class="game-controls" style="justify-content:center;flex-wrap:wrap">
          <div class="bet-selector">
            <span class="label">Mise :</span>
            <div class="bet-amount">
              ${[10, 25, 50].map(v => `
                <button class="bet-quick ${state.bingoBet === v ? 'active' : ''}"
                  onclick="state.bingoBet=${v};renderBingo()"
                  style="${state.bingoBet === v ? 'border-color:var(--gold);color:var(--gold)' : ''}">${v}</button>
              `).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-lg" onclick="bingoDraw()">🔢 Tirer</button>
          <button class="btn btn-outline" onclick="resetBingo()">Nouvelle carte</button>
        </div>
        <div class="game-result" id="bingo-result"></div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}

// =============================================
// UPDATED renderPage to include new pages
// =============================================
function renderAdminEconomy() {
  const el = document.getElementById('page-admin-economy');
  if (!el) return;
  el.innerHTML = `
    <div class="app-container">
      <div class="page-header">
        <button class="back-btn" data-nav="#admin">← Admin</button>
        <h1>💰 Gestion Économique</h1>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <button class="nav-item" onclick="window.location.hash='#admin'">📊 Dashboard</button>
          <button class="nav-item active">💰 Économie</button>
          <button class="nav-item" onclick="window.location.hash='#admin-users'">👥 Utilisateurs</button>
          <button class="nav-item" onclick="window.location.hash='#admin-logs'">📋 Audit</button>
        </div>
        <div class="admin-content">
          <div class="economy-group">
            <h3>🏠 House Account</h3>
            <div class="admin-stats" style="grid-template-columns:repeat(3,1fr)">
              <div class="admin-stat">
                <div class="label">Capital</div>
                <div class="value" style="color:var(--gold)">48 234 500</div>
              </div>
              <div class="admin-stat">
                <div class="label">Distribué (jetons gratuits)</div>
                <div class="value" style="color:var(--secondary)">1 765 500</div>
              </div>
              <div class="admin-stat">
                <div class="label">Rentabilité</div>
                <div class="value" style="color:var(--accent)">-3.5%</div>
              </div>
            </div>
            <button class="btn btn-primary" onclick="showToast('House Account rechargé de 1 000 000 GC','success')">💳 Recharger House Account (+1 000 000)</button>
          </div>
          <div class="economy-group">
            <h3>🎁 Récompenses</h3>
            <div class="economy-item">
              <span class="label">Bonus de bienvenue</span>
              <input type="range" min="1000" max="25000" value="5000" oninput="this.nextElementSibling.textContent=this.value">
              <span class="value">5 000</span>
            </div>
            <div class="economy-item">
              <span class="label">Daily Reward (base)</span>
              <input type="range" min="100" max="5000" value="1000" oninput="this.nextElementSibling.textContent=this.value">
              <span class="value">1 000</span>
            </div>
            <div class="economy-item">
              <span class="label">Daily Reward (streak jour 7)</span>
              <input type="range" min="500" max="10000" value="2500" oninput="this.nextElementSibling.textContent=this.value">
              <span class="value">2 500</span>
            </div>
          </div>
          <div class="economy-group">
            <h3>🎮 House Edge par jeu</h3>
            ${[
              { name: 'Slot 3 Rlx', edge: 4 },
              { name: 'Slot 4 Rlx', edge: 3.5 },
              { name: 'Slot 5 Rlx', edge: 3 },
              { name: 'Blackjack', edge: 0.5 },
              { name: 'Roulette', edge: 2.7 },
              { name: 'Crash', edge: 2 },
              { name: 'Mines', edge: 1 },
              { name: 'Plinko', edge: 2 },
              { name: 'Limbo', edge: 1 },
              { name: 'Craps', edge: 1.36 },
            ].map(g => `
              <div class="economy-item">
                <span class="label">${g.name}</span>
                <input type="range" min="0.1" max="20" step="0.1" value="${g.edge}" oninput="this.nextElementSibling.textContent=this.value+'%'">
                <span class="value">${g.edge}%</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary" onclick="showToast('Paramètres économiques sauvegardés !','success')">💾 Sauvegarder</button>
        </div>
      </div>
      <div class="legal-notice">Ce jeu est un divertissement sans argent réel</div>
    </div>
  `;
}
