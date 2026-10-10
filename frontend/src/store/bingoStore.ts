import { create } from 'zustand';
import { getBingoSocket } from '@/services/bingoSocket';
import { useBalanceStore } from '@/store/balanceStore';

export interface BingoCard {
  id: string;
  numbers: number[][];
  marked: boolean[][];
}

export interface BingoRoomInfo {
  id: string;
  pattern: string;
  ticketPrice: number;
  maxPlayers: number;
  playerCount: number;
  phase: string;
}

export interface BingoPlayer {
  userId: string;
  username: string;
}

export interface BingoWinner {
  userId: string;
  username: string;
  prize: number;
}

export interface BingoState {
  rooms: BingoRoomInfo[];
  currentRoom: any | null;
  myCard: BingoCard | null;
  players: BingoPlayer[];
  calledNumbers: number[];
  phase: string;
  pattern: string;
  prize: number;
  lastCalledNumber: number | null;
  winner: BingoWinner | null;
  ballCount: number;
  isInRoom: boolean;
  loading: boolean;
  error: string;

  setRooms: (rooms: BingoRoomInfo[]) => void;
  setRoomState: (state: any) => void;
  addCalledNumber: (number: number) => void;
  setWinner: (winner: BingoWinner) => void;
  getRooms: () => void;
  createRoom: (pattern: string, ticketPrice: number, maxPlayers: number) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  startGame: (roomId: string) => void;
  callBingo: (roomId: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string) => void;
  reset: () => void;
}

const initialState = {
  rooms: [],
  currentRoom: null,
  myCard: null,
  players: [],
  calledNumbers: [],
  phase: 'waiting',
  pattern: 'line',
  prize: 0,
  lastCalledNumber: null,
  winner: null,
  ballCount: 75,
  isInRoom: false,
  loading: false,
  error: '',
};
let joiningRoom: string | null = null;

export const useBingoStore = create<BingoState>((set, get) => ({
  ...initialState,

  setRooms: (rooms) => set({ rooms }),

  setRoomState: (state) => {
    if (!state?.room) {
      set({ ...initialState, rooms: get().rooms, error: 'Salon indisponible. Retour aux salons.' });
      return;
    }
    set({
      currentRoom: state.room,
      players: state.room?.players || [],
      calledNumbers: state.room?.calledNumbers || [],
      lastCalledNumber: state.room.calledNumbers?.[state.room.calledNumbers.length - 1] ?? null,
      phase: state.room?.phase || 'waiting',
      pattern: state.room?.pattern || 'line',
      prize: state.room?.prize || 0,
      ballCount: state.room?.ballCount ?? 75,
      winner: state.room?.winner || null,
      myCard: state.myCard || null,
      isInRoom: state.isInRoom || false,
      loading: false,
      error: '',
    });
  },

  addCalledNumber: (number) => {
    const { calledNumbers, myCard } = get();
    if (calledNumbers.includes(number)) return;

    const newCalled = [...calledNumbers, number];
    const card = myCard ? { ...myCard, marked: myCard.marked.map(row => [...row]) } : null;

    if (card) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (card.numbers[r][c] === number) {
            card.marked[r][c] = true;
          }
        }
      }
    }

    set({
      calledNumbers: newCalled,
      ballCount: 75 - newCalled.length,
      lastCalledNumber: number,
      myCard: card,
    });
  },

  setWinner: (winner) => set({ winner, phase: 'complete' }),

  getRooms: () => {
    const socket = getBingoSocket();
    set({ loading: true, error: '' });
    socket.emit('bingo:get-rooms', (response: any) => {
      if (response.success) {
        set({ rooms: response.rooms, loading: false });
      } else {
        set({ loading: false, error: response.error || 'Erreur' });
      }
    });
  },

  createRoom: (pattern, ticketPrice, maxPlayers) => {
    const socket = getBingoSocket();
    set({ loading: true, error: '' });
    socket.emit('bingo:create-room', { pattern, ticketPrice, maxPlayers }, (response: any) => {
      if (response.success) {
        get().joinRoom(response.room.id);
      } else {
        set({ loading: false, error: response.error || 'Erreur en créant le salon' });
      }
    });
  },

  joinRoom: (roomId) => {
    if (joiningRoom) return;
    joiningRoom = roomId;
    const socket = getBingoSocket();
    set({ loading: true, error: '' });
    socket.emit('bingo:join-room', { roomId }, async (response: any) => {
      joiningRoom = null;
      if (response.success) {
        get().setRoomState(response.state);
      } else {
        if (response.error === 'Salon introuvable') {
          set({ ...initialState, rooms: get().rooms, error: response.error });
          get().getRooms();
          set({ error: response.error });
        } else {
          set({ loading: false, error: response.error || 'Erreur en rejoignant le salon' });
        }
      }
      await syncBingoBalance();
    });
  },

  leaveRoom: (roomId) => {
    const socket = getBingoSocket();
    set({ loading: true, error: '' });
    socket.emit('bingo:leave-room', { roomId }, async (response: any) => {
      if (response.success) {
        set({ ...initialState, rooms: get().rooms });
        get().getRooms();
      } else {
        set({ loading: false, error: response.error || 'Depart refuse' });
      }
      await syncBingoBalance();
    });
  },

  startGame: (roomId) => {
    const socket = getBingoSocket();
    set({ loading: true, error: '' });
    socket.emit('bingo:start-game', { roomId }, (response: any) => {
      if (response.success) {
        set({ loading: false });
      } else {
        set({ loading: false, error: response.error || 'Erreur au démarrage' });
      }
    });
  },

  callBingo: (roomId) => {
    const socket = getBingoSocket();
    set({ loading: true, error: '' });
    socket.emit('bingo:call', { roomId }, async (response: any) => {
      if (response.success) {
        if (!response.result.valid) {
          set({ loading: false, error: 'Motif non complété !' });
        } else {
          set({ loading: false });
        }
      } else {
        set({ loading: false, error: response.error || 'Erreur' });
      }
      await syncBingoBalance();
    });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  reset: () => { joiningRoom = null; set({ ...initialState }); },
}));

async function syncBingoBalance() {
  try {
    await useBalanceStore.getState().syncBalance();
  } catch (err: any) {
    const store = useBingoStore.getState();
    store.setError([store.error, err.message || 'Synchronisation du solde impossible'].filter(Boolean).join(' ; '));
  }
}

export function subscribeBingo() {
  const socket = getBingoSocket();
  const onConnect = () => {
    joiningRoom = null;
    const store = useBingoStore.getState();
    store.getRooms();
    if (store.currentRoom?.id) store.joinRoom(store.currentRoom.id);
    void syncBingoBalance();
  };
  const onRooms = (rooms: BingoRoomInfo[]) => useBingoStore.getState().setRooms(rooms);
  const onUpdate = (data: any) => {
    const store = useBingoStore.getState();
    const room = data?.room ?? data;
    if (!room || room.id !== store.currentRoom?.id) return;
    if (data.room) {
      store.setRoomState(data);
    } else {
      const needsCard = store.phase === 'waiting' && room.phase === 'playing';
      store.setRoomState({ room, myCard: needsCard ? null : store.myCard, isInRoom: store.isInRoom });
      // The existing public start event omits the newly generated private card.
      if (needsCard) store.joinRoom(room.id);
    }
  };
  const onNumber = (data: { number: number }) => useBingoStore.getState().addCalledNumber(data.number);
  const onWinner = (winner: BingoWinner) => {
    useBingoStore.getState().setWinner(winner);
    void syncBingoBalance();
  };
  const onError = (error: Error) => useBingoStore.getState().setError(error.message || 'Connexion Bingo impossible');
  socket.on('connect', onConnect);
  socket.on('bingo:rooms-update', onRooms);
  socket.on('bingo:game-update', onUpdate);
  socket.on('bingo:number-called', onNumber);
  socket.on('bingo:winner', onWinner);
  socket.on('connect_error', onError);
  if (socket.connected) onConnect();
  return () => {
    socket.off('connect', onConnect);
    socket.off('bingo:rooms-update', onRooms);
    socket.off('bingo:game-update', onUpdate);
    socket.off('bingo:number-called', onNumber);
    socket.off('bingo:winner', onWinner);
    socket.off('connect_error', onError);
  };
}
