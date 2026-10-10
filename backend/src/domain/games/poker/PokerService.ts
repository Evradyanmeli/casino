import { PrismaClient } from '@prisma/client';
import { Deck, Card } from './deck.js';
import { evaluateHand, compareHands, getWinner, HandRank, EvaluatedHand } from './handEvaluator.js';
import { botDecide } from './botAI.js';
import { EconomyService } from '../../economy/EconomyService.js';
import { SerialQueue } from '../../../infrastructure/socket/SerialQueue.js';
import { openEscrow, saveEscrow } from '../Escrow.js';

export interface PokerPlayer {
  userId: string;
  username: string;
  seat: number;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  totalBet: number;
  folded: boolean;
  isAllIn: boolean;
  isBot: boolean;
  acted?: boolean;
  skillLevel?: 'easy' | 'medium' | 'hard';
  escrowId?: string;
  leaveAfterHand?: boolean;
}

export interface PokerTable {
  ownerId?: string;
  id: string;
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  players: PokerPlayer[];
  spectators: string[];
  deck: Deck;
  communityCards: Card[];
  pot: number;
  sidePots: { amount: number; eligibleUsers: string[] }[];
  currentPlayerIndex: number;
  dealerIndex: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  minBet: number;
  currentRaise: number;
  lastAction: { userId: string; action: string; amount: number } | null;
  handId: number;
  lastHandResults: HandResult | null;
  handInProgress: boolean;
  actionCount: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
}

export interface HandResult {
  winners: { userId: string; username: string; hand: string; handRank: number; holeCards: Card[] }[];
  communityCards: Card[];
  pot: number;
  winningAmounts: { userId: string; amount: number }[];
  playerHands: { userId: string; username: string; holeCards: Card[]; hand: string; handRank: number; folded: boolean }[];
}

export interface TableInfo {
  id: string;
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  playerCount: number;
  phase: string;
}

const BOT_USERNAMES = [
  'AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot',
  'EpsilonBot', 'ZetaBot', 'EtaBot', 'ThetaBot',
  'IotaBot', 'KappaBot', 'LambdaBot', 'MuBot',
];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class PokerService {
  private tables: Map<string, PokerTable> = new Map();
  private botTimers: Map<string, NodeJS.Timeout> = new Map();
  private userTableMap: Map<string, string> = new Map();
  private economyService?: EconomyService;
  private tableCounter = 0;
  private broadcastFn: ((tableId: string, state: any) => void | Promise<void>) | null = null;
  private queue = new SerialQueue();
  private roundTimers = new Map<string, NodeJS.Timeout>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private closingTables = new Set<string>();
  private disposed = false;

  private async mutate<T>(tableId: string, work: () => Promise<T>): Promise<T> {
    return this.queue.run(tableId, async () => {
      const result = await work();
      try { await this.broadcastFn?.(tableId, this.getPlayerGameState(tableId, '')); }
      catch (err) { console.error('Poker broadcast failed', err); }
      return result;
    });
  }

  async joinTable(userId: string, tableId: string): Promise<any> {
    return this.queue.run('membership', () => this.mutate(tableId, () => this.joinTableLocked(userId, tableId)));
  }

  async sitDown(userId: string, tableId: string, seat: number | null, buyIn: number): Promise<any> {
    return this.queue.run('membership', () => this.mutate(tableId, () => this.sitDownLocked(userId, tableId, seat, buyIn)));
  }

  async standUp(userId: string, tableId: string): Promise<void> {
    return this.queue.run('membership', () => this.mutate(tableId, () => this.standUpLocked(userId, tableId)));
  }

  async leaveTable(userId: string, tableId: string): Promise<void> {
    return this.queue.run('membership', () => this.mutate(tableId, () => this.leaveTableLocked(userId, tableId)));
  }

  async handleAction(userId: string, tableId: string, action: string, amount?: number): Promise<any> {
    return this.mutate(tableId, () => this.handleActionLocked(userId, tableId, action, amount));
  }

  async startBotGame(userId: string, buyIn: number): Promise<any> {
    if (!Number.isSafeInteger(buyIn) || buyIn < 100 || buyIn > 1000) throw new Error('Buy-in doit etre entre 100 et 1000');
    if (this.disposed) throw new Error('Poker indisponible');
    return this.queue.run('membership', async () => {
      const previous = this.tables.get(this.userTableMap.get(userId) ?? '');
      if (previous?.ownerId === userId) {
        this.cancelDisconnect(userId);
        return this.getPlayerGameState(previous.id, userId);
      }
      if (previous?.players.some(p => p.userId === userId)) throw new Error('Quittez votre table actuelle');
      const table = await this.createTable('Partie contre les bots', 5, 4);
      table.ownerId = userId;
      try {
        const state = await this.mutate(table.id, () => this.sitDownLocked(userId, table.id, 0, buyIn));
        if (previous) previous.spectators = previous.spectators.filter(id => id !== userId);
        return state;
      } catch (err) {
        if (!table.players.length) this.tables.delete(table.id);
        throw err;
      }
    });
  }

  async resumeSession(userId: string): Promise<any> {
    return this.queue.run('membership', async () => {
      const id = this.userTableMap.get(userId);
      if (!id || !this.tables.has(id)) return null;
      return this.mutate(id, async () => {
        this.cancelDisconnect(userId);
        const player = this.tables.get(id)?.players.find(p => p.userId === userId);
        if (player) player.leaveAfterHand = false;
        return this.getPlayerGameState(id, userId);
      });
    });
  }

  private assertAccess(userId: string, table: PokerTable): void {
    if (table.ownerId && userId && table.ownerId !== userId && !table.players.some(p => p.userId === userId && p.isBot)) {
      throw new Error('Cette session de bots est privee');
    }
  }

  private cancelDisconnect(userId: string): void {
    clearTimeout(this.disconnectTimers.get(userId));
    this.disconnectTimers.delete(userId);
  }

  async rebuy(userId: string, tableId: string, amount: number): Promise<any> {
    return this.mutate(tableId, async () => {
      const table = this.tables.get(tableId);
      const player = table?.players.find(p => p.userId === userId && !p.isBot);
      if (!table || !player) throw new Error('Joueur introuvable');
      if (table.handInProgress) throw new Error('Attendez la fin de la main');
      if (player.chips > 0) return this.getPlayerGameState(tableId, userId);
      if (!Number.isSafeInteger(amount) || amount < table.minBuyIn || amount + player.chips > table.maxBuyIn) throw new Error('Rebuy invalide');
      const economy = await this.getEconomy();
      await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
        const wallet = new EconomyService(tx);
        await wallet.assertCanPlay(userId, 'poker');
        await wallet.deductBalance(userId, BigInt(amount), 'poker_buyin', tableId, 'Poker rebuy');
        if (player.escrowId) await saveEscrow(tx, player.escrowId, player.chips + amount);
      });
      player.chips += amount;
      this.checkGameState(table);
      return this.getPlayerGameState(tableId, userId);
    });
  }

  constructor(private prisma: PrismaClient) {
    this.createDefaultTables();
  }

  setEconomyService(service: EconomyService): void {
    this.economyService = service;
  }

  setBroadcastFn(fn: (tableId: string, state: any) => void | Promise<void>): void {
    this.broadcastFn = fn;
  }

  private async getEconomy(): Promise<EconomyService> {
    if (!this.economyService) {
      this.economyService = new EconomyService(this.prisma);
    }
    return this.economyService;
  }

  private nextTableId(): string {
    this.tableCounter++;
    return `poker-${this.tableCounter}-${Date.now()}`;
  }

  private createDefaultTables(): void {
    const tables = [
      { name: 'Table Micro', smallBlind: 5, bigBlind: 10, maxPlayers: 6, minBuyIn: 100, maxBuyIn: 1000 },
      { name: 'Table Petit', smallBlind: 10, bigBlind: 20, maxPlayers: 6, minBuyIn: 200, maxBuyIn: 2000 },
      { name: 'Table Moyen', smallBlind: 25, bigBlind: 50, maxPlayers: 6, minBuyIn: 500, maxBuyIn: 5000 },
      { name: 'Table Gros', smallBlind: 50, bigBlind: 100, maxPlayers: 6, minBuyIn: 1000, maxBuyIn: 10000 },
      { name: 'Table VIP', smallBlind: 100, bigBlind: 200, maxPlayers: 6, minBuyIn: 2000, maxBuyIn: 50000 },
    ];

    for (const t of tables) {
      const table: PokerTable = {
        id: this.nextTableId(),
        name: t.name,
        maxPlayers: t.maxPlayers,
        smallBlind: t.smallBlind,
        bigBlind: t.bigBlind,
        minBuyIn: t.minBuyIn,
        maxBuyIn: t.maxBuyIn,
        players: [],
        spectators: [],
        deck: new Deck(),
        communityCards: [],
        pot: 0,
        sidePots: [],
        currentPlayerIndex: -1,
        dealerIndex: -1,
        phase: 'waiting',
        minBet: t.bigBlind,
        currentRaise: 0,
        lastAction: null,
        handId: 0,
        lastHandResults: null,
        handInProgress: false,
        actionCount: 0,
        smallBlindIndex: -1,
        bigBlindIndex: -1,
      };
      this.tables.set(table.id, table);
    }
  }

  async getTables(): Promise<TableInfo[]> {
    return Array.from(this.tables.values()).filter(t => !t.ownerId).map(t => ({
      id: t.id,
      name: t.name,
      maxPlayers: t.maxPlayers,
      smallBlind: t.smallBlind,
      bigBlind: t.bigBlind,
      minBuyIn: t.minBuyIn,
      maxBuyIn: t.maxBuyIn,
      playerCount: t.players.length,
      phase: t.phase,
    }));
  }

  async createTable(name: string, smallBlind: number, maxPlayers: number): Promise<PokerTable> {
    if (!Number.isSafeInteger(smallBlind) || smallBlind < 1 || smallBlind > Math.floor(Number.MAX_SAFE_INTEGER / 1000) || !Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) throw new Error('Table invalide');
    const bigBlind = smallBlind * 2;
    const minBuyIn = bigBlind * 10;
    const maxBuyIn = bigBlind * 100;

    const table: PokerTable = {
      id: this.nextTableId(),
      name,
      maxPlayers: maxPlayers || 6,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      players: [],
      spectators: [],
      deck: new Deck(),
      communityCards: [],
      pot: 0,
      sidePots: [],
      currentPlayerIndex: -1,
      dealerIndex: -1,
      phase: 'waiting',
      minBet: bigBlind,
      currentRaise: 0,
      lastAction: null,
      handId: 0,
      lastHandResults: null,
      handInProgress: false,
      actionCount: 0,
      smallBlindIndex: -1,
      bigBlindIndex: -1,
    };
    this.tables.set(table.id, table);
    return table;
  }

  async getTableState(tableId: string): Promise<any> {
    const table = this.tables.get(tableId);
    if (!table) return null;

    return {
      id: table.id,
      name: table.name,
      maxPlayers: table.maxPlayers,
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      minBuyIn: table.minBuyIn,
      maxBuyIn: table.maxBuyIn,
      players: table.players.map(p => ({
        userId: p.userId,
        username: p.username,
        seat: p.seat,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet,
        folded: p.folded,
        isAllIn: p.isAllIn,
        isBot: p.isBot,
      })),
      communityCards: table.communityCards,
      pot: table.pot,
      sidePots: table.sidePots,
      phase: table.phase,
      currentPlayerIndex: table.currentPlayerIndex,
      dealerIndex: table.dealerIndex,
      minBet: table.minBet,
      currentRaise: table.currentRaise,
      lastAction: table.lastAction,
      handInProgress: table.handInProgress,
      lastHandResults: table.lastHandResults,
    };
  }

  private async joinTableLocked(userId: string, tableId: string): Promise<any> {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('Table introuvable');
    this.assertAccess(userId, table);
    this.cancelDisconnect(userId);
    await (await this.getEconomy()).assertCanPlay(userId, 'poker');
    const previous = this.userTableMap.get(userId);
    if (previous && previous !== tableId && this.tables.get(previous)?.players.some(p => p.userId === userId)) throw new Error('Quittez votre table actuelle');

    if (table.players.find(p => p.userId === userId)) {
      return this.getPlayerGameState(tableId, userId);
    }

    if (!table.spectators.includes(userId)) {
      table.spectators.push(userId);
    }

    this.userTableMap.set(userId, tableId);
    return this.getPlayerGameState(tableId, userId);
  }

  private async leaveTableLocked(userId: string, tableId: string): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) return;
    this.assertAccess(userId, table);

    await this.standUpLocked(userId, tableId);

    table.spectators = table.spectators.filter(s => s !== userId);
    if (this.userTableMap.get(userId) === tableId) this.userTableMap.delete(userId);

  }

  private getAvailableSeat(table: PokerTable): number | null {
    const taken = new Set(table.players.map(p => p.seat));
    for (let i = 0; i < table.maxPlayers; i++) {
      if (!taken.has(i)) return i;
    }
    return null;
  }

  private async sitDownLocked(userId: string, tableId: string, seat: number | null, buyIn: number): Promise<any> {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('Table introuvable');
    this.assertAccess(userId, table);
    this.cancelDisconnect(userId);

    if (table.players.find(p => p.userId === userId)) {
      return this.getPlayerGameState(tableId, userId);
    }
    if (table.handInProgress) throw new Error('Attendez la fin de la main');
    const previous = this.userTableMap.get(userId);
    if (previous && previous !== tableId && this.tables.get(previous)?.players.some(p => p.userId === userId)) throw new Error('Quittez votre table actuelle');

    const actualSeat = seat !== null ? seat : this.getAvailableSeat(table);
    if (actualSeat === null || !Number.isInteger(actualSeat) || actualSeat < 0 || actualSeat >= table.maxPlayers || table.players.find(p => p.seat === actualSeat)) {
      throw new Error('Siège indisponible');
    }

    if (!Number.isSafeInteger(buyIn) || buyIn < table.minBuyIn || buyIn > table.maxBuyIn) {
      throw new Error(`Buy-in doit être entre ${table.minBuyIn} et ${table.maxBuyIn}`);
    }

    const economy = await this.getEconomy();
    let escrowId = '';
    const user = await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      const wallet = new EconomyService(tx);
      await wallet.assertCanPlay(userId, 'poker');
      const account = await tx.user.findUnique({ where: { id: userId }, select: { pseudo: true } });
      if (!account) throw new Error('Joueur introuvable');
      escrowId = await openEscrow(tx, userId, buyIn, 'poker_buyin', tableId, 'Poker buy-in');
      return account;
    });

    const player: PokerPlayer = {
      userId,
      username: user?.pseudo || 'Joueur',
      seat: actualSeat,
      chips: buyIn,
      escrowId,
      holeCards: [],
      currentBet: 0,
      totalBet: 0,
      folded: false,
      isAllIn: false,
      isBot: false,
    };

    table.players.push(player);
    this.userTableMap.set(userId, tableId);

    if (table.dealerIndex === -1) {
      table.dealerIndex = table.players.length - 1;
    }

    table.spectators = table.spectators.filter(s => s !== userId);

    if (table.ownerId && !table.handInProgress) {
      await this.fillWithBots(table);
    }

    this.checkGameState(table);
    return this.getPlayerGameState(tableId, userId);
  }

  private async fillWithBots(table: PokerTable): Promise<void> {
    const humanCount = table.players.filter(p => !p.isBot).length;
    const totalNeeded = Math.min(4, table.maxPlayers);
    const botCount = totalNeeded - table.players.length;

    const takenSeats = new Set(table.players.map(p => p.seat));
    const availableSeats: number[] = [];
    for (let i = 0; i < table.maxPlayers; i++) {
      if (!takenSeats.has(i)) availableSeats.push(i);
    }

    const shuffledSeats = shuffleArray(availableSeats);
    const usedUsernames = new Set(table.players.map(p => p.username));

    for (let i = 0; i < botCount && i < shuffledSeats.length; i++) {
      const username = shuffleArray(BOT_USERNAMES).find(u => !usedUsernames.has(u)) || `Bot${Math.random().toString(36).slice(2, 6)}`;
      usedUsernames.add(username);

      const skillLevels: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
      const skill = skillLevels[Math.floor(Math.random() * skillLevels.length)];

      const bot: PokerPlayer = {
        userId: `bot-${table.id}-${shuffledSeats[i]}`,
        username,
        seat: shuffledSeats[i],
        chips: 5000,
        holeCards: [],
        currentBet: 0,
        totalBet: 0,
        folded: false,
        isAllIn: false,
        isBot: true,
        skillLevel: skill,
      };

      table.players.push(bot);
    }

    if (table.dealerIndex === -1 && table.players.length > 0) {
      table.dealerIndex = 0;
    }

    this.checkGameState(table);
  }

  private async standUpLocked(userId: string, tableId: string, wallet?: EconomyService): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) return;
    this.assertAccess(userId, table);

    const player = table.players.find(p => p.userId === userId);
    if (!player) return;
    if (table.ownerId === userId && !this.closingTables.has(tableId)) return this.closeBotSession(userId, table);
    if (table.handInProgress) throw new Error('Attendez la fin de la main avant le retrait');
    if (player.escrowId || player.chips > 0) {
      const economy = wallet ?? await this.getEconomy();
      await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
        if (player.escrowId) await saveEscrow(tx, player.escrowId, player.chips, true);
        if (player.chips > 0) await new EconomyService(tx).addBalance(userId, BigInt(player.chips), 'poker_cashout', tableId, 'Poker cash-out');
      });
    }

    table.players = table.players.filter(p => p.userId !== userId);
    this.userTableMap.delete(userId);
    this.cancelDisconnect(userId);

    if (table.players.length === 0 || table.players.filter(p => !p.isBot).length === 0) {
      table.players = [];
      table.dealerIndex = -1;
      table.phase = 'waiting';
      table.handInProgress = false;
      table.communityCards = [];
      table.pot = 0;
      this.cancelBotTimer(tableId);
      clearTimeout(this.roundTimers.get(tableId));
      this.roundTimers.delete(tableId);
      table.sidePots = [];
      table.currentPlayerIndex = -1;
      table.lastAction = null;
      table.lastHandResults = null;
      table.currentRaise = 0;
      table.deck.reset();
      if (table.ownerId) this.tables.delete(tableId);
    }

    table.dealerIndex = Math.min(table.dealerIndex, table.players.length - 1);
  }

  private async closeBotSession(userId: string, original: PokerTable): Promise<void> {
    const id = original.id;
    this.closingTables.add(id);
    this.cancelBotTimer(id);
    clearTimeout(this.roundTimers.get(id));
    this.roundTimers.delete(id);
    this.cancelDisconnect(userId);
    const staged: PokerTable = { ...structuredClone({ ...original, deck: undefined }), deck: original.deck.clone() };
    try {
      const economy = await this.getEconomy();
      await economy.runInTransaction(async tx => {
        const wallet = new EconomyService(tx);
        this.tables.set(id, staged);
        const player = staged.players.find(p => p.userId === userId)!;
        if (staged.handInProgress && !player.isAllIn && !player.folded) {
          const index = staged.players.indexOf(player);
          const current = staged.currentPlayerIndex;
          this.handleFold(staged, index);
          if (index !== current) staged.currentPlayerIndex = (current - 1 + staged.players.length) % staged.players.length;
          this.advanceGame(staged);
        }
        // Run the same bot decisions synchronously; do not refund committed bets or fold an all-in.
        for (let actions = 0; staged.handInProgress; actions++) {
          if (actions >= 2000) throw new Error('Cloture de la main impossible; session conservee');
          if (staged.phase === 'showdown') { await this.showdown(staged, wallet); continue; }
          const bot = staged.players[staged.currentPlayerIndex];
          if (!bot?.isBot) throw new Error('Acteur inattendu pendant la cloture');
          const decision = this.botDecision(staged, bot);
          await this.handleActionLocked(bot.userId, id, decision.action, decision.amount, wallet);
        }
        await this.standUpLocked(userId, id, wallet);
      });
    } catch (err) {
      this.tables.set(id, original);
      this.userTableMap.set(userId, id);
      this.closingTables.delete(id);
      if (original.handInProgress) this.scheduleBots(original);
      else if (original.phase === 'showdown') this.endHand(original);
      throw err;
    } finally { this.closingTables.delete(id); }
  }

  private getNextActivePlayerIndex(table: PokerTable, fromIndex: number): number {
    const playerCount = table.players.length;
    for (let i = 1; i <= playerCount; i++) {
      const idx = (fromIndex + i) % playerCount;
      const p = table.players[idx];
      if (!p.folded && !p.isAllIn) return idx;
    }
    return -1;
  }

  private getNextPlayerIndex(table: PokerTable, fromIndex: number): number {
    const playerCount = table.players.length;
    for (let i = 1; i <= playerCount; i++) {
      const idx = (fromIndex + i) % playerCount;
      const p = table.players[idx];
      if (!p.folded) return idx;
    }
    return -1;
  }

  private activePlayers(table: PokerTable): PokerPlayer[] {
    return table.players.filter(p => !p.folded);
  }

  private activeAndAllInPlayers(table: PokerTable): PokerPlayer[] {
    return table.players.filter(p => !p.folded);
  }

  private playersCanAct(table: PokerTable): PokerPlayer[] {
    return table.players.filter(p => !p.folded && !p.isAllIn);
  }

  private checkGameState(table: PokerTable): void {
    if (table.handInProgress) return;
    if (table.phase === 'showdown') return;
    const active = table.players.filter(p => p.chips > 0);
    if (active.length >= 2 && active.some(p => !p.isBot)) {
      this.startHand(table);
    }
  }

  private startHand(table: PokerTable): void {
    table.players = table.players.filter(p => p.chips > 0 || !p.isBot);
    table.handId++;
    table.deck = new Deck();
    table.deck.shuffle();
    table.communityCards = [];
    table.pot = 0;
    table.sidePots = [];
    table.currentRaise = 0;
    table.lastAction = null;
    table.handInProgress = true;
    table.lastHandResults = null;

    for (const p of table.players) {
      p.holeCards = [];
      p.currentBet = 0;
      p.totalBet = 0;
      p.folded = p.chips === 0;
      p.isAllIn = p.chips === 0;
      p.acted = false;
    }

    const activePlayers = table.players.filter(p => p.chips > 0);

    if (activePlayers.length < 2) {
      table.handInProgress = false;
      return;
    }

    let dealerIdx = activePlayers.findIndex(p => table.players.indexOf(p) === table.dealerIndex);
    dealerIdx = (dealerIdx + 1) % activePlayers.length;
    table.dealerIndex = table.players.indexOf(activePlayers[dealerIdx]);

    const sbIdx = (dealerIdx + 1) % activePlayers.length;
    const bbIdx = (dealerIdx + 2) % activePlayers.length;

    table.smallBlindIndex = table.players.indexOf(activePlayers[sbIdx]);
    table.bigBlindIndex = table.players.indexOf(activePlayers[bbIdx]);

    if (activePlayers.length === 2) {
      table.smallBlindIndex = table.dealerIndex;
      table.bigBlindIndex = table.players.indexOf(activePlayers[(dealerIdx + 1) % activePlayers.length]);
    }

    const sb = table.players[table.smallBlindIndex];
    const bb = table.players[table.bigBlindIndex];

    const sbAmount = Math.min(table.smallBlind, sb.chips);
    sb.currentBet = sbAmount;
    sb.totalBet = sbAmount;
    sb.chips -= sbAmount;
    table.pot += sbAmount;

    const bbAmount = Math.min(table.bigBlind, bb.chips);
    bb.currentBet = bbAmount;
    bb.totalBet = bbAmount;
    bb.chips -= bbAmount;
    table.pot += bbAmount;

    if (sb.chips === 0) sb.isAllIn = true;
    if (bb.chips === 0) bb.isAllIn = true;

    table.currentRaise = Math.max(sbAmount, bbAmount);
    table.minBet = table.bigBlind;

    this.dealHoleCards(table);

    table.phase = 'preflop';
    table.actionCount = 0;

    let startingPlayerIdx: number;
    if (activePlayers.length === 2) {
      startingPlayerIdx = table.dealerIndex;
    } else {
      startingPlayerIdx = (bbIdx + 1) % activePlayers.length;
    }

    const startingIndex = activePlayers.length === 2 ? table.dealerIndex : table.players.indexOf(activePlayers[startingPlayerIdx]);
    table.currentPlayerIndex = this.getNextActivePlayerIndex(table, (startingIndex - 1 + table.players.length) % table.players.length);

    if (table.currentPlayerIndex === -1) {
      this.dealRemainingAndShowdown(table);
      this.scheduleBots(table);
      return;
    }

    table.currentRaise = Math.max(sbAmount, bbAmount);

    this.scheduleBots(table);
  }

  private dealHoleCards(table: PokerTable): void {
    for (const p of table.players) {
      if (p.chips > 0 || p.currentBet > 0) {
        p.holeCards.push(table.deck.deal());
        p.holeCards.push(table.deck.deal());
      }
    }
  }

  private dealCommunityCards(table: PokerTable, phase: string): void {
    if (phase === 'flop') {
      table.deck.deal();
      table.communityCards.push(table.deck.deal());
      table.communityCards.push(table.deck.deal());
      table.communityCards.push(table.deck.deal());
      table.phase = 'flop';
    } else if (phase === 'turn') {
      table.deck.deal();
      table.communityCards.push(table.deck.deal());
      table.phase = 'turn';
    } else if (phase === 'river') {
      table.deck.deal();
      table.communityCards.push(table.deck.deal());
      table.phase = 'river';
    }
  }

  private async handleActionLocked(userId: string, tableId: string, action: string, amount?: number, wallet?: EconomyService): Promise<any> {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('Table introuvable');
    this.assertAccess(userId, table);
    if (!table.handInProgress) throw new Error('Aucune main en cours');
    if ((table.phase as string) === 'showdown') {
      try {
        await this.showdown(table, wallet);
      } catch (err) {
        this.scheduleBots(table);
        throw err;
      }
      return this.getPlayerGameState(tableId, userId);
    }

    const playerIndex = table.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) throw new Error('Vous n\'êtes pas à cette table');
    if (playerIndex !== table.currentPlayerIndex) throw new Error('Ce n\'est pas votre tour');

    const player = table.players[playerIndex];
    if (player.folded) throw new Error('Vous avez déjà couché');
    if (!player.isBot) await (await this.getEconomy()).assertCanPlay(userId, 'poker');

    this.cancelBotTimer(tableId);

    switch (action) {
      case 'fold':
        this.handleFold(table, playerIndex);
        break;
      case 'check':
        this.handleCheck(table, playerIndex);
        break;
      case 'call':
        this.handleCall(table, playerIndex);
        break;
      case 'raise':
        this.handleRaise(table, playerIndex, amount ?? table.bigBlind);
        break;
      case 'all-in':
        this.handleAllIn(table, playerIndex);
        break;
      default:
        throw new Error('Action invalide');
    }

    player.acted = true;
    this.advanceGame(table);
    if ((table.phase as string) === 'showdown') {
      try {
        await this.showdown(table, wallet);
      } catch (err) {
        this.scheduleBots(table);
        throw err;
      }
      return this.getPlayerGameState(tableId, userId);
    }

    const state = this.getPlayerGameState(tableId, userId);
    this.scheduleBots(table);
    return state;
  }

  private handleFold(table: PokerTable, playerIndex: number): void {
    const player = table.players[playerIndex];
    player.folded = true;
    table.lastAction = { userId: player.userId, action: 'fold', amount: 0 };
  }

  private handleCheck(table: PokerTable, playerIndex: number): void {
    const player = table.players[playerIndex];
    if (player.currentBet < table.currentRaise) throw new Error('Vous devez suivre ou coucher');
    table.lastAction = { userId: player.userId, action: 'check', amount: 0 };
  }

  private handleCall(table: PokerTable, playerIndex: number): void {
    const player = table.players[playerIndex];
    const callAmount = Math.min(Math.max(0, table.currentRaise - player.currentBet), player.chips);

    if (callAmount >= player.chips) {
      this.handleAllIn(table, playerIndex);
      return;
    }

    player.chips -= callAmount;
    player.currentBet += callAmount;
    player.totalBet += callAmount;
    table.pot += callAmount;
    table.lastAction = { userId: player.userId, action: 'call', amount: callAmount };
  }

  private handleRaise(table: PokerTable, playerIndex: number, amount: number): void {
    const player = table.players[playerIndex];
    if (!Number.isSafeInteger(amount) || amount < table.currentRaise + table.minBet) throw new Error('Relance invalide');
    const totalPut = Math.min(amount, player.chips + player.currentBet);

    if (totalPut >= player.chips + player.currentBet) {
      this.handleAllIn(table, playerIndex);
      return;
    }

    const chipsAdded = totalPut - player.currentBet;
    player.chips -= chipsAdded;
    player.currentBet = totalPut;
    player.totalBet += chipsAdded;
    table.pot += chipsAdded;
    table.minBet = totalPut - table.currentRaise;
    table.currentRaise = totalPut;
    for (const p of table.players) p.acted = false;
    table.lastAction = { userId: player.userId, action: 'raise', amount: chipsAdded };
  }

  private handleAllIn(table: PokerTable, playerIndex: number): void {
    const player = table.players[playerIndex];
    const chipsAdded = player.chips;

    player.currentBet += chipsAdded;
    player.totalBet += chipsAdded;
    table.pot += chipsAdded;
    player.chips = 0;
    player.isAllIn = true;

    if (player.currentBet > table.currentRaise) {
      if (player.currentBet - table.currentRaise >= table.minBet) {
        table.minBet = player.currentBet - table.currentRaise;
        for (const p of table.players) p.acted = false;
      }
      table.currentRaise = player.currentBet;
    }
    table.lastAction = { userId: player.userId, action: 'all-in', amount: chipsAdded };
  }

  private advanceGame(table: PokerTable): void {
    if (table.phase === 'showdown') return;

    const activeCount = this.activePlayers(table).length;
    const canActCount = this.playersCanAct(table).length;

    if (activeCount <= 1) {
      const lastStanding = this.activePlayers(table)[0];
      if (lastStanding) {
        table.lastHandResults = {
          winners: [{ userId: lastStanding.userId, username: lastStanding.username, hand: 'Automatic', handRank: -1, holeCards: [] }],
          communityCards: table.communityCards,
          pot: table.pot,
          winningAmounts: [{ userId: lastStanding.userId, amount: table.pot }],
          playerHands: table.players.filter(p => !p.folded).map(p => ({
            userId: p.userId,
            username: p.username,
            holeCards: [],
            hand: 'Fold',
            handRank: -1,
            folded: p.folded,
          })),
        };
        table.phase = 'showdown';
      }
      return;
    }

    if (canActCount === 0 || (canActCount === 1 && this.playersCanAct(table)[0].currentBet >= table.currentRaise)) {
      this.dealRemainingAndShowdown(table);
      return;
    }

    const raiserIndex = this.findLastRaiser(table);

    if (this.isBettingRoundComplete(table, raiserIndex)) {
      this.nextPhase(table);
      return;
    }

    const nextIdx = this.getNextActivePlayerIndex(table, table.currentPlayerIndex);
    if (nextIdx === -1) {
      this.nextPhase(table);
      return;
    }
    table.currentPlayerIndex = nextIdx;
    table.actionCount++;
  }

  private findLastRaiser(table: PokerTable): number {
    let lastRaiser = -1;
    let highestBet = 0;
    for (let i = 0; i < table.players.length; i++) {
      const p = table.players[i];
      if (!p.folded && p.currentBet > highestBet) {
        highestBet = p.currentBet;
        lastRaiser = i;
      }
    }
    return lastRaiser;
  }

  private isBettingRoundComplete(table: PokerTable, raiserIndex: number): boolean {
    return this.playersCanAct(table).every(p => p.acted && p.currentBet === table.currentRaise);
  }

  private nextPhase(table: PokerTable): void {
    table.actionCount = 0;

    for (const p of table.players) {
      p.currentBet = 0;
      p.acted = false;
    }

    switch (table.phase) {
      case 'preflop':
        this.dealCommunityCards(table, 'flop');
        break;
      case 'flop':
        this.dealCommunityCards(table, 'turn');
        break;
      case 'turn':
        this.dealCommunityCards(table, 'river');
        break;
      case 'river':
        this.dealRemainingAndShowdown(table);
        return;
    }

    const canAct = this.playersCanAct(table);
    if (canAct.length <= 1) {
      this.dealRemainingAndShowdown(table);
      return;
    }

    const firstToAct = this.getNextActivePlayerIndex(table, (table.dealerIndex) % table.players.length);
    if (firstToAct === -1) {
      this.dealRemainingAndShowdown(table);
      return;
    }
    table.currentPlayerIndex = firstToAct;
    table.currentRaise = 0;
    table.minBet = table.bigBlind;
  }

  private dealRemainingAndShowdown(table: PokerTable): void {
    if (table.phase === 'preflop' || table.phase === 'waiting') {
      this.dealCommunityCards(table, 'flop');
    }
    if (table.phase === 'flop') {
      this.dealCommunityCards(table, 'turn');
    }
    if (table.phase === 'turn') {
      this.dealCommunityCards(table, 'river');
    }
    table.phase = 'showdown';
  }

  private async showdown(table: PokerTable, wallet?: EconomyService): Promise<void> {
    if (!table.handInProgress) return;
    const activePlayers = this.activePlayers(table);
    if (activePlayers.length === 0) {
      this.endHand(table);
      return;
    }

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      const holeInfo: Card[] = [];
      table.lastHandResults = {
        winners: [{ userId: winner.userId, username: winner.username, hand: 'Automatic', handRank: -1, holeCards: holeInfo }],
        communityCards: table.communityCards,
        pot: table.pot,
        winningAmounts: [{ userId: winner.userId, amount: table.pot }],
        playerHands: table.players.filter(p => !p.folded).map(p => ({
          userId: p.userId,
          username: p.username,
          holeCards: [],
          hand: 'Automatic',
          handRank: -1,
          folded: p.folded,
        })),
      };
      await this.saveHandResult(table, wallet);
      winner.chips += table.pot;
      this.endHand(table);
      return;
    }

    const allPlayers = this.activeAndAllInPlayers(table);
    this.calculateSidePots(table);

    const winners = new Map<string, { userId: string; hand: EvaluatedHand }>();
    const winningAmounts: { userId: string; amount: number }[] = [];
    for (const sidePot of table.sidePots) {
      const contenders = table.players.filter(p => sidePot.eligibleUsers.includes(p.userId));
      if (!contenders.length) throw new Error('Pot sans joueur eligible');
      const potWinners = getWinner(contenders.map(p => ({ userId: p.userId, holeCards: p.holeCards, communityCards: table.communityCards })))
        .sort((a, b) => table.players.find(p => p.userId === a.userId)!.seat - table.players.find(p => p.userId === b.userId)!.seat);
      const share = Math.floor(sidePot.amount / potWinners.length);
      let remainder = sidePot.amount % potWinners.length;
      for (const w of potWinners) {
        winners.set(w.userId, w);
        const amount = share + (remainder-- > 0 ? 1 : 0);
        const existing = winningAmounts.find(p => p.userId === w.userId);
        if (existing) existing.amount += amount;
        else winningAmounts.push({ userId: w.userId, amount });
      }
    }
    if (winningAmounts.reduce((sum, w) => sum + w.amount, 0) !== table.pot) throw new Error('Pot incoherent');

    const handResults = allPlayers.map(p => {
      const hand = evaluateHand(p.holeCards, table.communityCards);
      return {
        userId: p.userId,
        username: p.username,
        holeCards: p.holeCards,
        hand: hand.handName,
        handRank: hand.rank,
        folded: p.folded,
      };
    });

    table.lastHandResults = {
      winners: Array.from(winners.values()).map(w => {
        const player = table.players.find(p => p.userId === w.userId)!;
        return {
          userId: w.userId,
          username: player.username,
          hand: w.hand.handName,
          handRank: w.hand.rank,
          holeCards: player.holeCards,
        };
      }),
      communityCards: table.communityCards,
      pot: table.pot,
      winningAmounts,
      playerHands: handResults,
    };

    await this.saveHandResult(table, wallet);
    for (const award of winningAmounts) table.players.find(p => p.userId === award.userId)!.chips += award.amount;
    this.endHand(table);
  }

  private calculateSidePots(table: PokerTable): void {
    table.sidePots = [];
    const levels = [...new Set(table.players.map(p => p.totalBet).filter(amount => amount > 0))].sort((a, b) => a - b);
    let previousAmount = 0;
    for (const level of levels) {
      const contribution = level - previousAmount;
      if (contribution <= 0) continue;

      const contributors = table.players.filter(p => p.totalBet >= level);
      const eligible = contributors.filter(p => !p.folded);
      const potAmount = contribution * contributors.length;

      table.sidePots.push({
        amount: potAmount,
        eligibleUsers: eligible.map(p => p.userId),
      });

      previousAmount = level;
    }
  }

  private async saveHandResult(table: PokerTable, wallet?: EconomyService): Promise<void> {
      if (!table.lastHandResults) return;
      const result = table.lastHandResults;
      const humanPlayers = table.players.filter(p => !p.isBot && p.holeCards.length === 2);
      const economy = wallet ?? await this.getEconomy();
      await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      for (const human of humanPlayers) {
        const winningAmount = result.winningAmounts.find(w => w.userId === human.userId);
        const winAmount = winningAmount ? BigInt(winningAmount.amount) : 0n;
        const betAmount = BigInt(human.totalBet);
        if (human.escrowId) await saveEscrow(tx, human.escrowId, human.chips + Number(winAmount));

        // Winnings stay in escrow chips until a normal cash-out.
        await tx.gameSession.create({
          data: {
            userId: human.userId,
            gameType: 'poker',
            betAmount,
            winAmount,
            resultData: {
              handId: table.handId,
              tableId: table.id,
              communityCards: table.communityCards.map(c => ({ suit: c.suit, rank: c.rank })),
              holeCards: human.holeCards.map(c => ({ suit: c.suit, rank: c.rank })),
              winner: !!winningAmount,
              winningAmount: winAmount.toString(),
              netAmount: (winAmount - betAmount).toString(),
              folded: human.folded,
            },
          },
        });
      }
      });
  }

  private endHand(table: PokerTable): void {
    table.handInProgress = false;
    table.phase = 'showdown';
    table.pot = 0;
    this.cancelBotTimer(table.id);
    for (const p of table.players) {
      p.currentBet = 0;
      p.totalBet = 0;
      p.holeCards = [];
    }
    if (this.closingTables.has(table.id) || this.disposed) return;

    clearTimeout(this.roundTimers.get(table.id));
    const handId = table.handId;
    this.roundTimers.set(table.id, setTimeout(() => {
      void this.mutate(table.id, async () => {
        if (this.tables.get(table.id) !== table) return;
        this.roundTimers.delete(table.id);
        if (!table.handInProgress && table.handId === handId) {
          for (const player of [...table.players].filter(p => p.leaveAfterHand)) await this.standUpLocked(player.userId, table.id);
          table.phase = 'waiting';
          for (const bot of table.players.filter(p => p.isBot && p.chips === 0)) bot.chips = 5000;
          this.checkGameState(table);
        }
      }).catch(err => console.error('Poker next hand failed', err));
    }, 3000));
  }

  private findLastAggressor(table: PokerTable): number | null {
    for (let i = 0; i < table.players.length; i++) {
      const p = table.players[i];
      if (!p.folded && p.currentBet > 0) return i;
    }
    return null;
  }

  private scheduleBots(table: PokerTable): void {
    this.cancelBotTimer(table.id);
    if (this.disposed || this.closingTables.has(table.id) || this.tables.get(table.id) !== table) return;

    if (!table.handInProgress || table.phase === 'waiting') return;
    if (table.phase === 'showdown') {
      this.botTimers.set(table.id, setTimeout(() => {
        void this.mutate(table.id, () => this.showdown(table)).catch(err => {
          console.error('Poker showdown failed', err);
          this.scheduleBots(table);
        });
      }, 1000));
      return;
    }

    const currentPlayer = table.players[table.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) return;

    const delay = 1000 + Math.random() * 2000;
    const handId = table.handId;
    const actorId = currentPlayer.userId;
    const timer = setTimeout(() => {
      void this.mutate(table.id, async () => {
      if (this.tables.get(table.id) !== table) return;
      if (table.handId !== handId || table.players[table.currentPlayerIndex]?.userId !== actorId) return;
      if (!table.handInProgress || table.phase === 'showdown' || table.phase === 'waiting') return;
      if (table.currentPlayerIndex < 0 || table.currentPlayerIndex >= table.players.length) return;

      const bot = table.players[table.currentPlayerIndex];
      if (!bot || !bot.isBot || bot.folded) return;

      const decision = this.botDecision(table, bot);
      await this.handleActionLocked(bot.userId, table.id, decision.action, decision.amount);
      }).catch(err => {
        console.error('Poker bot failed', err);
        this.scheduleBots(table);
      });
    }, delay);

    this.botTimers.set(table.id, timer);
  }

  private botDecision(table: PokerTable, bot: PokerPlayer) {
      const decision = botDecide({
        holeCards: bot.holeCards,
        communityCards: table.communityCards,
        pot: table.pot,
        currentBet: table.currentRaise,
        playerBet: bot.currentBet,
        chips: bot.chips,
        playersInHand: this.activePlayers(table).length,
        currentRaise: table.currentRaise,
        bigBlind: table.bigBlind,
        phase: table.phase as any,
        skillLevel: bot.skillLevel || 'medium',
      });
      if (decision.action === 'check' && bot.currentBet < table.currentRaise) return { action: 'call', amount: 0 };
      return { action: decision.action, amount: decision.action === 'raise' ? Math.max(Math.ceil(decision.amount), table.currentRaise + table.minBet) : decision.amount };
  }

  private cancelBotTimer(tableId: string): void {
    const timer = this.botTimers.get(tableId);
    if (timer) {
      clearTimeout(timer);
      this.botTimers.delete(tableId);
    }
  }

  async handleDisconnect(userId: string): Promise<void> {
    const tableId = this.userTableMap.get(userId);
    if (!tableId || this.disposed) return;
    this.cancelDisconnect(userId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      void this.expireDisconnect(userId, tableId).catch(err => {
        console.error('Poker disconnect settlement failed', err);
        if (this.userTableMap.get(userId) === tableId) void this.handleDisconnect(userId);
      });
    }, 30000);
    timer.unref();
    this.disconnectTimers.set(userId, timer);
  }

  private async expireDisconnect(userId: string, tableId: string): Promise<void> {
    await this.queue.run('membership', () => this.mutate(tableId, async () => {
    if (this.userTableMap.get(userId) !== tableId) return;
    const table = this.tables.get(tableId);
    if (!table) return;
    if (table.ownerId === userId) return this.closeBotSession(userId, table);

    const player = table.players.find(p => p.userId === userId);
    if (!player) return this.leaveTableLocked(userId, tableId);
    player.leaveAfterHand = true;

    if (table.handInProgress && table.phase !== 'showdown' && !player.isAllIn && !player.folded) {
      const playerIndex = table.players.indexOf(player);
      const currentIndex = table.currentPlayerIndex;
      this.cancelBotTimer(tableId);
      this.handleFold(table, playerIndex);
      // Preserve the next actor when the disconnected player was not on turn.
      if (playerIndex !== currentIndex) table.currentPlayerIndex = (currentIndex - 1 + table.players.length) % table.players.length;
      this.advanceGame(table);
      if ((table.phase as string) === 'showdown') await this.showdown(table);
      this.scheduleBots(table);
    }
    if (!table.handInProgress) await this.standUpLocked(userId, tableId);
    }));
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.botTimers.values()) clearTimeout(timer);
    for (const timer of this.roundTimers.values()) clearTimeout(timer);
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.botTimers.clear();
    this.roundTimers.clear();
    this.disconnectTimers.clear();
  }

  getPlayerGameState(tableId: string, userId: string): any {
    const table = this.tables.get(tableId);
    if (!table) return null;
    this.assertAccess(userId, table);

    const player = table.players.find(p => p.userId === userId);
    const isAtTable = !!player;

    return {
      table: {
        id: table.id,
        name: table.name,
        mode: table.ownerId ? 'bots' : 'shared',
        maxPlayers: table.maxPlayers,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        minBuyIn: table.minBuyIn,
        maxBuyIn: table.maxBuyIn,
        phase: table.phase,
        pot: table.pot,
        sidePots: table.sidePots,
        communityCards: table.communityCards,
        dealerIndex: table.dealerIndex,
        currentPlayerIndex: table.currentPlayerIndex,
        minBet: table.minBet,
        currentRaise: table.currentRaise,
        lastAction: table.lastAction,
        handInProgress: table.handInProgress,
        lastHandResults: table.lastHandResults,
      },
      players: table.players.map(p => ({
        userId: p.userId,
        username: p.username,
        seat: p.seat,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet,
        folded: p.folded,
        isAllIn: p.isAllIn,
        isBot: p.isBot,
        holeCards: p.userId === userId ? p.holeCards : [],
      })),
      mySeat: player?.seat ?? null,
      myCards: player?.holeCards ?? [],
      isMyTurn: table.handInProgress && table.phase !== 'showdown' && table.players[table.currentPlayerIndex]?.userId === userId,
      isAtTable,
    };
  }
}
