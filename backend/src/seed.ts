import bcrypt from 'bcryptjs';
import { prisma } from './infrastructure/database/prisma.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production.');
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const playerPassword = process.env.SEED_PLAYER_PASSWORD;
  if (!adminPassword || !playerPassword || adminPassword.length < 12 || playerPassword.length < 12) {
    throw new Error('Set SEED_ADMIN_PASSWORD and SEED_PLAYER_PASSWORD to private values of at least 12 characters.');
  }
  console.log('Seeding database...');

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@casino.com' },
    update: {},
    create: {
      email: 'admin@casino.com',
      pseudo: 'admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      birthDate: new Date('1990-01-01'),
    },
  });
  console.log(`Admin user created: ${admin.email} (${admin.id})`);

  const playerHash = await bcrypt.hash(playerPassword, 12);
  const player = await prisma.user.upsert({
    where: { email: 'player@demo.com' },
    update: {},
    create: {
      email: 'player@demo.com',
      pseudo: 'demoPlayer',
      passwordHash: playerHash,
      role: 'USER',
      birthDate: new Date('1995-06-15'),
    },
  });
  console.log(`Test user created: ${player.email} (${player.id})`);

  await prisma.transaction.create({
    data: {
      userId: player.id,
      amount: 5000n,
      type: 'bonus',
      description: 'Welcome bonus',
    },
  });

  await prisma.dailyReward.upsert({
    where: { userId: player.id },
    update: {},
    create: {
      userId: player.id,
      streak: 3,
      lastClaim: new Date(Date.now() - 25 * 60 * 60 * 1000),
    },
  });

  const now = new Date();
  for (let i = 0; i < 5; i++) {
    const betAmount = BigInt(Math.floor(Math.random() * 100) + 10);
    const winAmount = Math.random() > 0.4 ? betAmount * BigInt(Math.floor(Math.random() * 5) + 1) : 0n;
    const won = winAmount > 0n;

    await prisma.gameSession.create({
      data: {
        userId: player.id,
        gameType: 'slots',
        betAmount,
        winAmount,
        resultData: { reels: ['🍒', '🍒', '🍒'], won },
        endedAt: new Date(now.getTime() - i * 3600000),
        createdAt: new Date(now.getTime() - i * 3600000),
      },
    });

    await prisma.transaction.create({
      data: {
        userId: player.id,
        amount: -betAmount,
        type: 'bet',
        description: 'Slots spin',
      },
    });

    if (won) {
      await prisma.transaction.create({
        data: {
          userId: player.id,
          amount: winAmount,
          type: 'win',
          description: 'Slots win',
        },
      });
    }
  }

  const notificationTypes = [
    { type: 'welcome', content: 'Welcome to CasinoX! Enjoy your first 5000 chips on us.' },
    { type: 'promo', content: 'Weekend bonus: 50% extra on all deposits this Saturday!' },
    { type: 'level_up', content: 'Congratulations! You reached level 2.' },
    { type: 'reward', content: 'Daily reward streak: 3 days! Claim your bonus now.' },
    { type: 'system', content: 'New game mode "Mega Slots" is now available. Try it out!' },
  ];

  for (const n of notificationTypes) {
    await prisma.notification.create({
      data: {
        userId: player.id,
        type: n.type,
        content: n.content,
        read: Math.random() > 0.5,
        createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 3600000),
      },
    });
  }

  const badges = [
    { slug: 'first_game', name: 'Première partie', description: 'Jouez votre première partie', icon: '🎮', category: 'game', condition: { type: 'games_played', count: 1 }, xpReward: 50 },
    { slug: 'games_10', name: 'Habitué', description: 'Jouez 10 parties', icon: '🎰', category: 'game', condition: { type: 'games_played', count: 10 }, xpReward: 100 },
    { slug: 'games_100', name: 'Pro du jeu', description: 'Jouez 100 parties', icon: '🏆', category: 'game', condition: { type: 'games_played', count: 100 }, xpReward: 500 },
    { slug: 'games_1000', name: 'Légende du casino', description: 'Jouez 1000 parties', icon: '👑', category: 'game', condition: { type: 'games_played', count: 1000 }, xpReward: 2000 },
    { slug: 'slots_50', name: 'Fan de machines à sous', description: 'Jouez 50 parties de machines à sous', icon: '🍒', category: 'game', condition: { type: 'games_played', count: 50, game: 'slots' }, xpReward: 200 },
    { slug: 'big_win', name: 'Gros gain', description: 'Gagnez 10 000 GC en une partie', icon: '💎', category: 'game', condition: { type: 'total_won', amount: 10000 }, xpReward: 300 },
    { slug: 'huge_win', name: 'Gain colossal', description: 'Gagnez 100 000 GC au total', icon: '💰', category: 'game', condition: { type: 'total_won', amount: 100000 }, xpReward: 1000 },
    { slug: 'level_5', name: 'Apprenti', description: 'Atteignez le niveau 5', icon: '⭐', category: 'game', condition: { type: 'level_reached', level: 5 }, xpReward: 150 },
    { slug: 'level_10', name: 'Expert', description: 'Atteignez le niveau 10', icon: '🌟', category: 'game', condition: { type: 'level_reached', level: 10 }, xpReward: 500 },
    { slug: 'level_25', name: 'Maître', description: 'Atteignez le niveau 25', icon: '💫', category: 'game', condition: { type: 'level_reached', level: 25 }, xpReward: 2000 },
    { slug: 'streak_3', name: 'Fidèle', description: 'Réclamez la récompense quotidienne 3 jours de suite', icon: '🔥', category: 'social', condition: { type: 'streak', count: 3 }, xpReward: 100 },
    { slug: 'streak_7', name: 'Semaine complète', description: 'Réclamez la récompense quotidienne 7 jours de suite', icon: '📅', category: 'social', condition: { type: 'streak', count: 7 }, xpReward: 300 },
    { slug: 'streak_30', name: 'Dévoué', description: 'Réclamez la récompense quotidienne 30 jours de suite', icon: '🏅', category: 'social', condition: { type: 'streak', count: 30 }, xpReward: 1000 },
    { slug: 'vip_100k', name: 'Investisseur', description: 'Déposez 100 000 GC au total', icon: '💳', category: 'vip', condition: { type: 'vip_deposit', amount: 100000 }, xpReward: 500 },
    { slug: 'vip_1m', name: 'VIP', description: 'Déposez 1 000 000 GC au total', icon: '💎', category: 'vip', condition: { type: 'vip_deposit', amount: 1000000 }, xpReward: 5000 },
    { slug: 'vip_10m', name: 'VIP Premium', description: 'Déposez 10 000 000 GC au total', icon: '👑', category: 'vip', condition: { type: 'vip_deposit', amount: 10000000 }, xpReward: 25000 },
    { slug: 'social_friend', name: 'Social', description: 'Jouez avec des amis', icon: '🤝', category: 'social', condition: { type: 'games_played', count: 1 }, xpReward: 50 },
    { slug: 'special_birthday', name: 'Anniversaire', description: 'Bonne année !', icon: '🎂', category: 'special', condition: { type: 'games_played', count: 1 }, xpReward: 100 },
    { slug: 'special_winner', name: 'Champion', description: 'Gagnez 50 parties', icon: '🎖️', category: 'special', condition: { type: 'games_played', count: 50 }, xpReward: 500 },
    { slug: 'special_lucky', name: 'Chanceux', description: 'Atteignez le niveau 3', icon: '🍀', category: 'special', condition: { type: 'level_reached', level: 3 }, xpReward: 75 },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: {},
      create: badge,
    });
  }

  const tasks = [
    { slug: 'daily_play_3', title: 'Jouez 3 parties', description: 'Jouez à n\'importe quel jeu 3 fois', type: 'daily', condition: { action: 'play_game', count: 3 }, reward: { xp: 50, coins: 200 }, expiresIn: 24 },
    { slug: 'daily_play_5', title: 'Jouez 5 parties', description: 'Jouez à n\'importe quel jeu 5 fois', type: 'daily', condition: { action: 'play_game', count: 5 }, reward: { xp: 100, coins: 500 }, expiresIn: 24 },
    { slug: 'daily_slots_3', title: 'Machine à sous x3', description: 'Jouez 3 fois aux machines à sous', type: 'daily', condition: { action: 'play_game', game: 'slots', count: 3 }, reward: { xp: 75, coins: 300 }, expiresIn: 24 },
    { slug: 'daily_win_1000', title: 'Gagnez 1000 GC', description: 'Gagnez 1000 GC au total', type: 'daily', condition: { action: 'win_amount', count: 1000 }, reward: { xp: 150, coins: 1000 }, expiresIn: 24 },
    { slug: 'daily_bet_500', title: 'Misez 500 GC', description: 'Misez 500 GC au total', type: 'daily', condition: { action: 'bet_amount', count: 500 }, reward: { xp: 80, coins: 400 }, expiresIn: 24 },
    { slug: 'daily_win_streak_3', title: 'Série de 3 victoires', description: 'Gagnez 3 parties consécutives', type: 'daily', condition: { action: 'win_streak', count: 3 }, reward: { xp: 200, coins: 1500 }, expiresIn: 24 },
    { slug: 'daily_login', title: 'Connexion quotidienne', description: 'Connectez-vous aujourd\'hui', type: 'daily', condition: { action: 'daily_login', count: 1 }, reward: { xp: 25, coins: 100 }, expiresIn: 24 },
    { slug: 'daily_mines_2', title: 'Mines x2', description: 'Jouez 2 fois aux Mines', type: 'daily', condition: { action: 'play_game', game: 'mines', count: 2 }, reward: { xp: 60, coins: 250 }, expiresIn: 24 },
    { slug: 'daily_crash_2', title: 'Crash x2', description: 'Jouez 2 fois au Crash', type: 'daily', condition: { action: 'play_game', game: 'crash', count: 2 }, reward: { xp: 60, coins: 250 }, expiresIn: 24 },
    { slug: 'daily_limbo_3', title: 'Limbo x3', description: 'Jouez 3 fois au Limbo', type: 'daily', condition: { action: 'play_game', game: 'limbo', count: 3 }, reward: { xp: 70, coins: 300 }, expiresIn: 24 },
    { slug: 'weekly_play_25', title: '25 parties cette semaine', description: 'Jouez 25 parties cette semaine', type: 'weekly', condition: { action: 'play_game', count: 25 }, reward: { xp: 500, coins: 5000 }, expiresIn: 168 },
    { slug: 'weekly_win_10000', title: 'Gagnez 10 000 GC', description: 'Gagnez 10 000 GC cette semaine', type: 'weekly', condition: { action: 'win_amount', count: 10000 }, reward: { xp: 1000, coins: 10000 }, expiresIn: 168 },
    { slug: 'weekly_bet_5000', title: 'Misez 5000 GC', description: 'Misez 5000 GC cette semaine', type: 'weekly', condition: { action: 'bet_amount', count: 5000 }, reward: { xp: 750, coins: 7500 }, expiresIn: 168 },
    { slug: 'weekly_slots_10', title: '10 parties de machines à sous', description: 'Jouez 10 fois aux machines à sous', type: 'weekly', condition: { action: 'play_game', game: 'slots', count: 10 }, reward: { xp: 400, coins: 4000 }, expiresIn: 168 },
    { slug: 'weekly_streak_5', title: 'Série de 5 victoires', description: 'Gagnez 5 parties consécutives', type: 'weekly', condition: { action: 'win_streak', count: 5 }, reward: { xp: 1500, coins: 20000 }, expiresIn: 168 },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { slug: task.slug },
      update: {},
      create: task,
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
