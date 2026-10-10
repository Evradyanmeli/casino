import { FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';
import { PokerService } from '../../domain/games/poker/PokerService.js';
import { BingoService } from '../../domain/games/bingo/BingoService.js';
import fp from 'fastify-plugin';
import { EconomyService } from '../../domain/economy/EconomyService.js';
import type { Socket } from 'socket.io';

let io: SocketServer;
let pokerService: PokerService;
let bingoService: BingoService;

export function getIO(): SocketServer {
  return io;
}

export function getPokerService(): PokerService {
  return pokerService;
}

export function getBingoService(): BingoService {
  return bingoService;
}

export function createSocketAuth(app: FastifyInstance, gameType?: string) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Token requis');
      const decoded = app.jwt.verify<{ sub: string }>(token);
      if (typeof decoded.sub !== 'string' || !decoded.sub) throw new Error('Identité invalide');
      const user = await app.prisma.user.findUnique({ where: { id: decoded.sub }, select: { status: true, pseudo: true } });
      if (!user || user.status !== 'ACTIVE') throw new Error('Compte indisponible');
      if (gameType) await new EconomyService(app.prisma).assertCanPlay(decoded.sub, gameType);
      socket.data.userId = decoded.sub;
      socket.data.pseudo = user.pseudo;
      next();
    } catch {
      next(new Error('Authentification échouée ou accès au jeu refusé'));
    }
  };
}

export async function attachFastifySocket(app: FastifyInstance) {
  const httpServer = app.server;
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  pokerService = new PokerService(app.prisma);
  pokerService.setBroadcastFn(async (tableId, _state) => {
    const sockets = await poker.in(`table:${tableId}`).fetchSockets();
    for (const s of sockets) {
      const uid = s.data.userId || '';
      const personalState = await pokerService.getPlayerGameState(tableId, uid);
      if (personalState) s.emit('poker:game-update', personalState);
      else s.emit('poker:session-ended', { tableId });
    }
    await broadcastTableList();
  });
  bingoService = new BingoService(app.prisma);

  const authMiddleware = createSocketAuth(app);

  io.use(authMiddleware);

  const poker = io.of('/poker');
  poker.use(createSocketAuth(app, 'poker'));

  async function broadcastGameState(tableId: string) {
    for (const peer of await poker.in(`table:${tableId}`).fetchSockets()) {
      const state = pokerService.getPlayerGameState(tableId, peer.data.userId);
      if (state) peer.emit('poker:game-update', state);
      else peer.emit('poker:session-ended', { tableId });
    }
  }

  async function broadcastTableList(): Promise<void> {
    try {
      const tables = await pokerService.getTables();
      poker.emit('poker:tables-update', tables);
    } catch {}
  }

  poker.on('connection', (socket) => {
    const userId = socket.data.userId;

    socket.on('poker:start-bots', async (data: { buyIn: number }, callback) => {
      try {
        const state = await pokerService.startBotGame(userId, data?.buyIn);
        for (const room of socket.rooms) if (room.startsWith('table:') && room !== `table:${state.table.id}`) await socket.leave(room);
        await socket.join(`table:${state.table.id}`);
        if (typeof callback === 'function') callback({ success: true, state });
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:resume', async (_data, callback) => {
      try {
        const state = await pokerService.resumeSession(userId);
        if (state) await socket.join(`table:${state.table.id}`);
        if (typeof callback === 'function') callback({ success: true, state });
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:get-tables', async (callback) => {
      try {
        const tables = await pokerService.getTables();
        if (callback) callback({ success: true, tables });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:join-table', async (data: { tableId: string }, callback) => {
      try {
        const state = await pokerService.joinTable(userId, data.tableId);
        await socket.join(`table:${data.tableId}`);
        if (callback) callback({ success: true, state });
        broadcastTableList();

        const tableState = await pokerService.getTableState(data.tableId);
        poker.to(`table:${data.tableId}`).emit('poker:table-update', tableState);
        await broadcastGameState(data.tableId);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:leave-table', async (data: { tableId: string }, callback) => {
      try {
        await pokerService.leaveTable(userId, data.tableId);
        socket.leave(`table:${data.tableId}`);
        if (callback) callback({ success: true });
        broadcastTableList();

        const tableState = await pokerService.getTableState(data.tableId);
        if (tableState) {
          poker.to(`table:${data.tableId}`).emit('poker:table-update', tableState);
        }
        await broadcastGameState(data.tableId);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:sit-down', async (data: { tableId: string; seat: number | null; buyIn: number }, callback) => {
      try {
        const state = await pokerService.sitDown(userId, data.tableId, data.seat, data.buyIn);
        await socket.join(`table:${data.tableId}`);
        if (callback) callback({ success: true, state });
        broadcastTableList();

        const tableState = await pokerService.getTableState(data.tableId);
        poker.to(`table:${data.tableId}`).emit('poker:table-update', tableState);
        await broadcastGameState(data.tableId);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:stand-up', async (data: { tableId: string }, callback) => {
      try {
        await pokerService.standUp(userId, data.tableId);
        socket.leave(`table:${data.tableId}`);
        if (callback) callback({ success: true });
        broadcastTableList();

        const tableState = await pokerService.getTableState(data.tableId);
        if (tableState) {
          poker.to(`table:${data.tableId}`).emit('poker:table-update', tableState);
        }
        await broadcastGameState(data.tableId);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:action', async (data: { tableId: string; action: string; amount?: number }, callback) => {
      try {
        const state = await pokerService.handleAction(userId, data.tableId, data.action, data.amount);
        if (callback) callback({ success: true, state });

        broadcastTableList();

        const sockets = await poker.in(`table:${data.tableId}`).fetchSockets();
        for (const s of sockets) {
          const uid = s.data.userId || '';
          const personalState = await pokerService.getPlayerGameState(data.tableId, uid);
          s.emit('poker:game-update', personalState);
        }
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('poker:rebuy', async (data: { tableId: string; amount: number }, callback) => {
      try {
        const state = await pokerService.rebuy(userId, data.tableId, data.amount);
        if (typeof callback === 'function') callback({ success: true, state });
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      if (!Array.from(poker.sockets.values()).some(peer => peer.data.userId === userId)) {
        void pokerService.handleDisconnect(userId).catch(err => app.log.error(err));
      }
    });
  });

  const bingo = io.of('/bingo');
  bingo.use(createSocketAuth(app, 'bingo'));

  bingoService.setEmitFunction((event, roomId, data) => {
    if (!roomId) bingo.emit(event, data);
    else bingo.to(`room:${roomId}`).emit(event, data);
  });

  const chat = io.of('/chat');
  chat.use(authMiddleware);

  const messageTimestamps = new Map<string, number>();
  const PROFANITY_LIST = ['merde', 'putain', 'connard', 'salope', 'enculé', 'fuck', 'shit', 'bitch', 'asshole'];

  function filterProfanity(text: string): string {
    let filtered = text;
    for (const word of PROFANITY_LIST) {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    }
    return filtered;
  }

  const connectChat = (socket: Socket) => {
    const userId = socket.data.userId;

    void socket.join('global');
    socket.emit('chat:status', { status: 'healthy', room: 'global' });

    socket.on('chat:message', async (data: { message: string }, callback) => {
      const fail = (message: string) => {
        socket.emit('chat:error', { message });
        if (typeof callback === 'function') callback({ success: false, error: message });
      };
      if (typeof data?.message !== 'string' || !data.message.trim() || data.message.trim().length > 500) return fail('Message invalide (1 à 500 caractères)');
      const now = Date.now();
      const lastMessage = messageTimestamps.get(userId);
      if (lastMessage !== undefined && now - lastMessage < 2000) {
        return fail('Vous envoyez des messages trop rapidement');
      }
      messageTimestamps.set(userId, now);

      try {
      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { pseudo: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') return fail('Compte indisponible');
      const mute = await app.prisma.systemSetting.findUnique({ where: { key: 'chat_muted_user_ids' } });
      if (Array.isArray(mute?.value) && mute.value.includes(userId)) return fail('Vous ne pouvez pas envoyer de messages dans le chat');
      const filteredMessage = filterProfanity(data.message.trim());
      const saved = await app.prisma.chatMessage.create({ data: { userId, content: filteredMessage, room: 'global' } });
      const payload = {
        id: saved.id,
        userId,
        username: user.pseudo,
        message: filteredMessage,
        timestamp: saved.createdAt.toISOString(),
        room: 'global',
      };
      chat.to('global').emit('chat:new-message', payload);
      io.to('global').emit('chat:new-message', payload);
      if (typeof callback === 'function') callback({ success: true, message: payload });
      } catch (err) {
        app.log.error(err);
        fail('Message non envoyé, veuillez réessayer');
      }
    });
    socket.on('chat:get-messages', async (callback) => {
      try {
        const messages = await app.prisma.chatMessage.findMany({ where: { room: 'global' }, orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { pseudo: true } } } });
        if (typeof callback === 'function') callback({ success: true, messages: messages.reverse().map(m => ({ id: m.id, userId: m.userId, username: m.user.pseudo, message: m.content, timestamp: m.createdAt.toISOString(), room: m.room })) });
      } catch (err) {
        app.log.error(err);
        if (typeof callback === 'function') callback({ success: false, error: 'Historique indisponible' });
      }
    });
  };
  chat.on('connection', connectChat);
  io.on('connection', connectChat);

  bingo.on('connection', (socket) => {
    const userId = socket.data.userId;
    const username = socket.data.pseudo;

    socket.on('bingo:get-rooms', async (callback) => {
      try {
        const rooms = await bingoService.getRooms();
        if (callback) callback({ success: true, rooms });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('bingo:create-room', async (data: { pattern: string; ticketPrice: number; maxPlayers: number }, callback) => {
      try {
        const room = await bingoService.createRoom(data.pattern, data.ticketPrice, data.maxPlayers);
        if (callback) callback({ success: true, room });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('bingo:join-room', async (data: { roomId: string }, callback) => {
      try {
        const state = await bingoService.joinRoom(userId, username, data.roomId);
        await socket.join(`room:${data.roomId}`);
        if (callback) callback({ success: true, state });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('bingo:leave-room', async (data: { roomId: string }, callback) => {
      try {
        await bingoService.leaveRoom(userId, data.roomId);
        socket.leave(`room:${data.roomId}`);
        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('bingo:start-game', async (data: { roomId: string }, callback) => {
      try {
        await bingoService.startGame(data.roomId, userId);
        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('bingo:daub', async (data: { roomId: string; number: number }, callback) => {
      try {
        const result = await bingoService.daubNumber(userId, data.roomId, data.number);
        if (callback) callback({ success: true, result });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('bingo:call', async (data: { roomId: string }, callback) => {
      try {
        const result = await bingoService.callBingo(userId, data.roomId);
        if (callback) callback({ success: true, result });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      if (!Array.from(bingo.sockets.values()).some(peer => peer.data.userId === userId)) {
        void bingoService.handleDisconnect(userId).catch(err => app.log.error(err));
      }
    });
  });
  app.addHook('onClose', async () => {
    pokerService.dispose();
    bingoService.dispose();
    await new Promise<void>(resolve => io.close(() => resolve()));
  });
}

export default fp(attachFastifySocket);
