import { PrismaClient } from '@prisma/client';
import { generateCard, BingoCard } from './cardGenerator.js';
import { checkPattern, Pattern } from './patternChecker.js';
import { EconomyService } from '../../economy/EconomyService.js';
import { SerialQueue } from '../../../infrastructure/socket/SerialQueue.js';
import { openEscrow, saveEscrow } from '../Escrow.js';

export interface BingoRoom {
  id: string;
  pattern: Pattern;
  ticketPrice: number;
  maxPlayers: number;
  players: { userId: string; username: string; card: BingoCard; escrowId?: string }[];
  calledNumbers: number[];
  phase: 'waiting' | 'playing' | 'complete';
  prize: number;
  ballCount: number;
  winner: { userId: string; username: string; prize: number } | null;
}

export interface BingoRoomInfo {
  id: string;
  pattern: Pattern;
  ticketPrice: number;
  maxPlayers: number;
  playerCount: number;
  phase: string;
}

type EmitFn = (event: string, roomId: string, data: any) => void;

export class BingoService {
  private rooms: Map<string, BingoRoom> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private userRoomMap: Map<string, string> = new Map();
  private roomCounter = 0;
  private economyService?: EconomyService;
  private emit: EmitFn = () => {};
  private queue = new SerialQueue();

  async joinRoom(userId: string, username: string, roomId: string): Promise<any> {
    return this.queue.run('membership', () => this.queue.run(roomId, () => this.joinRoomLocked(userId, username, roomId)));
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    return this.queue.run('membership', () => this.queue.run(roomId, () => this.leaveRoomLocked(userId, roomId)));
  }

  async startGame(roomId: string, userId?: string): Promise<void> {
    return this.queue.run(roomId, () => this.startGameLocked(roomId, userId));
  }

  async callBingo(userId: string, roomId: string): Promise<{ valid: boolean; prize: number }> {
    return this.queue.run(roomId, () => this.callBingoLocked(userId, roomId));
  }

  constructor(private prisma: PrismaClient) {}

  setEmitFunction(fn: EmitFn): void {
    this.emit = fn;
  }

  setEconomyService(service: EconomyService): void {
    this.economyService = service;
  }

  private async getEconomy(): Promise<EconomyService> {
    if (!this.economyService) {
      this.economyService = new EconomyService(this.prisma);
    }
    return this.economyService;
  }

  private nextRoomId(): string {
    this.roomCounter++;
    return `bingo-${this.roomCounter}-${Date.now()}`;
  }

  async getRooms(): Promise<BingoRoomInfo[]> {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      pattern: r.pattern,
      ticketPrice: r.ticketPrice,
      maxPlayers: r.maxPlayers,
      playerCount: r.players.length,
      phase: r.phase,
    }));
  }

  async createRoom(pattern: string, ticketPrice: number, maxPlayers: number): Promise<BingoRoomInfo> {
    if (!['line', 'x', 'full'].includes(pattern)) throw new Error('Motif invalide');
    if (!Number.isSafeInteger(ticketPrice) || ticketPrice < 1 || ticketPrice > Math.floor(Number.MAX_SAFE_INTEGER / 100)) throw new Error('Prix du ticket invalide');
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) throw new Error('Nombre de joueurs invalide');

    const room: BingoRoom = {
      id: this.nextRoomId(),
      pattern: pattern as Pattern,
      ticketPrice,
      maxPlayers,
      players: [],
      calledNumbers: [],
      phase: 'waiting',
      prize: 0,
      ballCount: 75,
      winner: null,
    };

    this.rooms.set(room.id, room);
    this.emit('bingo:rooms-created', '', this.getRoomState(room));
    this.emit('bingo:rooms-update', '', await this.getRooms());
    return {
      id: room.id,
      pattern: room.pattern,
      ticketPrice: room.ticketPrice,
      maxPlayers: room.maxPlayers,
      playerCount: 0,
      phase: room.phase,
    };
  }

  private async joinRoomLocked(userId: string, username: string, roomId: string): Promise<any> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Salon introuvable');
    await (await this.getEconomy()).assertCanPlay(userId, 'bingo');
    if (room.players.find(p => p.userId === userId)) {
      return this.getPlayerGameState(roomId, userId);
    }
    if (room.phase !== 'waiting') throw new Error('La partie a déjà commencé');
    if (this.userRoomMap.has(userId) && this.userRoomMap.get(userId) !== roomId) throw new Error('Quittez votre salon actuel');
    if (room.players.length >= room.maxPlayers) throw new Error('Salon complet');

    const economy = await this.getEconomy();
    const card = generateCard();
    let escrowId = '';
    await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      const wallet = new EconomyService(tx);
      await wallet.assertCanPlay(userId, 'bingo', BigInt(room.ticketPrice));
      escrowId = await openEscrow(tx, userId, room.ticketPrice, 'bet', roomId, 'Bingo ticket');
    });
    room.players.push({ userId, username, card, escrowId });
    this.userRoomMap.set(userId, roomId);

    if (room.phase === 'waiting') room.prize = room.players.length * room.ticketPrice;

    this.emit('bingo:game-update', roomId, this.getRoomState(room));
    this.emit('bingo:rooms-update', '', await this.getRooms());

    return this.getPlayerGameState(roomId, userId);
  }

  private async leaveRoomLocked(userId: string, roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const idx = room.players.findIndex(p => p.userId === userId);
    // A running ticket remains eligible on reconnect; leaving is not a refund.
    if (room.phase === 'playing') return;
    if (idx !== -1) {
      if (room.phase === 'waiting') {
        const economy = await this.getEconomy();
        await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
          if (room.players[idx].escrowId) await saveEscrow(tx, room.players[idx].escrowId!, 0, true);
          await new EconomyService(tx).addBalance(userId, BigInt(room.ticketPrice), 'refund', roomId, 'Remboursement Bingo');
        });
      }
      room.players.splice(idx, 1);
    }

    this.userRoomMap.delete(userId);

    if (room.players.length === 0) {
      this.stopInterval(roomId);
      this.rooms.delete(roomId);
      this.emit('bingo:rooms-update', '', await this.getRooms());
      return;
    }

    if (room.phase === 'waiting') room.prize = room.players.length * room.ticketPrice;
    this.emit('bingo:game-update', roomId, this.getRoomState(room));
    this.emit('bingo:rooms-update', '', await this.getRooms());
  }

  private async startGameLocked(roomId: string, userId?: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Salon introuvable');
    if (room.phase !== 'waiting') throw new Error('La partie a déjà commencé');
    if (userId && !room.players.some(p => p.userId === userId)) throw new Error('Vous ne participez pas à ce salon');
    if (room.players.length < 2) throw new Error('Pas assez de joueurs');
    if (userId) await (await this.getEconomy()).assertCanPlay(userId, 'bingo');

    room.phase = 'playing';
    room.calledNumbers = [];

    this.emit('bingo:game-update', roomId, this.getRoomState(room));
    this.emit('bingo:rooms-update', '', await this.getRooms());

    this.startInterval(roomId);
  }

  private startInterval(roomId: string): void {
    this.stopInterval(roomId);
    const interval = setInterval(() => {
      void this.queue.run(roomId, async () => this.callNextNumber(roomId)).catch(err => console.error('Bingo draw failed', err));
    }, 3000);
    this.intervals.set(roomId, interval);
  }

  private stopInterval(roomId: string): void {
    const existing = this.intervals.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.intervals.delete(roomId);
    }
  }

  private async callNextNumber(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;

    const available: number[] = [];
    for (let n = 1; n <= 75; n++) {
      if (!room.calledNumbers.includes(n)) available.push(n);
    }

    if (available.length === 0) {
      const economy = await this.getEconomy();
      await economy.runInTransaction(async tx => {
        for (const player of room.players) {
          if (player.escrowId) await saveEscrow(tx, player.escrowId, 0, true);
          await new EconomyService(tx).addBalance(player.userId, BigInt(room.ticketPrice), 'refund', roomId, 'Bingo termine sans reclamation : ticket rembourse');
        }
      });
      this.endGame(room, null);
      return;
    }

    const number = available[Math.floor(Math.random() * available.length)];
    room.calledNumbers.push(number);

    for (const p of room.players) {
      this.markNumber(p.card, number);
    }

    this.emit('bingo:number-called', roomId, {
      number,
      calledNumbers: room.calledNumbers,
      ballCount: 75 - room.calledNumbers.length,
    });
  }

  private markNumber(card: BingoCard, number: number): void {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (card.numbers[row][col] === number) {
          card.marked[row][col] = true;
          return;
        }
      }
    }
  }

  async daubNumber(userId: string, roomId: string, number: number): Promise<{ correct: boolean; bingo: boolean }> {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'playing') return { correct: false, bingo: false };

    const player = room.players.find(p => p.userId === userId);
    if (!player) return { correct: false, bingo: false };

    if (!room.calledNumbers.includes(number)) return { correct: false, bingo: false };

    let found = false;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (player.card.numbers[row][col] === number) {
          player.card.marked[row][col] = true;
          found = true;
        }
      }
    }

    if (!found) return { correct: false, bingo: false };

    const bingo = checkPattern(player.card.marked, room.pattern);
    return { correct: true, bingo };
  }

  private async callBingoLocked(userId: string, roomId: string): Promise<{ valid: boolean; prize: number }> {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'playing') return { valid: false, prize: 0 };

    const player = room.players.find(p => p.userId === userId);
    if (!player) return { valid: false, prize: 0 };

    const marks = player.card.numbers.map(row => row.map(number => number === 0 || room.calledNumbers.includes(number)));
    const hasPattern = checkPattern(marks, room.pattern);
    if (!hasPattern) return { valid: false, prize: 0 };

    const totalBets = BigInt(room.ticketPrice) * BigInt(room.players.length);
    const prize = Number(totalBets * 95n / 100n);

    const economy = await this.getEconomy();
    await economy.runInTransaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      for (const participant of room.players) if (participant.escrowId) await saveEscrow(tx, participant.escrowId, 0, true);
      if (prize > 0) await new EconomyService(tx).addBalance(userId, BigInt(prize), 'win', roomId, 'Bingo gagné');
      for (const participant of room.players) await tx.gameSession.create({
      data: {
        userId: participant.userId,
        gameType: 'bingo',
        betAmount: BigInt(room.ticketPrice),
        winAmount: participant.userId === userId ? BigInt(prize) : 0n,
        resultData: {
          roomId: room.id,
          pattern: room.pattern,
          calledNumbers: room.calledNumbers,
          prize,
        },
      },
      });
    });

    room.winner = { userId: player.userId, username: player.username, prize };
    room.phase = 'complete';
    this.stopInterval(room.id);

    this.emit('bingo:winner', roomId, room.winner);
    this.emit('bingo:game-update', roomId, this.getRoomState(room));
    this.emit('bingo:rooms-update', '', await this.getRooms());

    return { valid: true, prize };
  }

  async handleDisconnect(userId: string): Promise<void> {
    const roomId = this.userRoomMap.get(userId);
    if (roomId) {
      await this.leaveRoom(userId, roomId);
    }
  }

  dispose(): void {
    for (const timer of this.intervals.values()) clearInterval(timer);
    this.intervals.clear();
  }

  private endGame(room: BingoRoom, winner: { userId: string; username: string } | null): void {
    room.phase = 'complete';
    this.stopInterval(room.id);

    if (winner) {
      const totalBets = BigInt(room.ticketPrice) * BigInt(room.players.length);
      const prize = Number(totalBets * 95n / 100n);
      room.winner = { userId: winner.userId, username: winner.username, prize };
    }

    this.emit('bingo:game-update', room.id, this.getRoomState(room));
    void this.getRooms().then(rooms => this.emit('bingo:rooms-update', '', rooms));
  }

  getRoomState(room: BingoRoom): any {
    return {
      id: room.id,
      pattern: room.pattern,
      ticketPrice: room.ticketPrice,
      maxPlayers: room.maxPlayers,
      players: room.players.map(p => ({ userId: p.userId, username: p.username })),
      calledNumbers: room.calledNumbers,
      phase: room.phase,
      prize: room.prize,
      ballCount: 75 - room.calledNumbers.length,
      winner: room.winner,
    };
  }

  getPlayerGameState(roomId: string, userId: string): any {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find(p => p.userId === userId);
    return {
      room: this.getRoomState(room),
      myCard: player?.card || null,
      isInRoom: !!player,
    };
  }
}
