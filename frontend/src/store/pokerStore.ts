import { create } from 'zustand';
import { getPokerSocket } from '@/services/pokerSocket';
import { useAuthStore } from '@/store/authStore';
import { useBalanceStore } from '@/store/balanceStore';

export interface PokerCard {
  suit: string;
  rank: string;
}

export interface PokerPlayer {
  userId: string;
  username: string;
  seat: number;
  chips: number;
  holeCards?: PokerCard[];
  currentBet: number;
  totalBet: number;
  folded: boolean;
  isAllIn: boolean;
  isBot: boolean;
}

export interface SidePot {
  amount: number;
  eligibleUsers: string[];
}

export interface HandResult {
  winners: { userId: string; username: string; hand: string; handRank: number; holeCards: PokerCard[] }[];
  communityCards: PokerCard[];
  pot: number;
  winningAmounts: { userId: string; amount: number }[];
  playerHands: { userId: string; username: string; holeCards: PokerCard[]; hand: string; handRank: number; folded: boolean }[];
}

export interface PokerState {
  tables: { id: string; name: string; maxPlayers: number; smallBlind: number; bigBlind: number; minBuyIn: number; maxBuyIn: number; playerCount: number; phase: string }[];
  selectedTable: string | null;
  table: any | null;
  players: PokerPlayer[];
  communityCards: PokerCard[];
  pot: number;
  sidePots: SidePot[];
  phase: string;
  myCards: PokerCard[];
  isMyTurn: boolean;
  isAtTable: boolean;
  mySeat: number | null;
  dealerIndex: number;
  currentPlayerIndex: number;
  lastAction: { userId: string; action: string; amount: number } | null;
  handInProgress: boolean;
  lastHandResults: HandResult | null;
  minBet: number;
  currentRaise: number;
  loading: boolean;
  error: string;

  setTables: (tables: any[]) => void;
  setSelectedTable: (id: string | null) => void;
  setTableState: (state: any) => void;
  setGameUpdate: (state: any) => void;
  joinTable: (tableId: string) => Promise<void>;
  startBotGame: (buyIn: number) => Promise<void>;
  resumeSession: () => Promise<void>;
  leaveTable: (tableId: string) => Promise<boolean>;
  sitDown: (tableId: string, seat: number | null, buyIn: number) => Promise<void>;
  standUp: (tableId: string) => Promise<boolean>;
  rebuy: (tableId: string, amount: number) => Promise<void>;
  handleAction: (action: string, amount?: number) => Promise<void>;
  getTables: () => void;
  setLoading: (v: boolean) => void;
  setError: (e: string) => void;
  reset: () => void;
}

const initialState = {
  tables: [],
  selectedTable: null,
  table: null,
  players: [],
  communityCards: [],
  pot: 0,
  sidePots: [],
  phase: 'waiting',
  myCards: [],
  isMyTurn: false,
  isAtTable: false,
  mySeat: null,
  dealerIndex: -1,
  currentPlayerIndex: -1,
  lastAction: null,
  handInProgress: false,
  lastHandResults: null,
  minBet: 0,
  currentRaise: 0,
  loading: false,
  error: '',
};

export const usePokerStore = create<PokerState>((set, get) => ({
  ...initialState,

  setTables: (tables) => set({ tables }),

  setSelectedTable: (id) => set({ selectedTable: id }),

  setTableState: (state) => {
    if (!state?.table) {
      set({ ...initialState, tables: get().tables, error: 'Table indisponible. Retour aux tables.' });
      return;
    }
    set({
      table: state.table,
      players: state.players || [],
      communityCards: state.table?.communityCards || [],
      pot: state.table?.pot || 0,
      sidePots: state.table?.sidePots || [],
      phase: state.table?.phase || 'waiting',
      myCards: state.myCards || [],
      isMyTurn: state.isMyTurn || false,
      isAtTable: state.isAtTable || false,
      mySeat: state.mySeat ?? null,
      dealerIndex: state.table?.dealerIndex ?? -1,
      currentPlayerIndex: state.table?.currentPlayerIndex ?? -1,
      lastAction: state.table?.lastAction || null,
      handInProgress: state.table?.handInProgress || false,
      lastHandResults: state.table?.lastHandResults || null,
      minBet: state.table?.minBet || 0,
      currentRaise: state.table?.currentRaise || 0,
      loading: false,
      error: '',
    });
  },

  setGameUpdate: (state) => {
    if (!state) return;
    const table = state.table ?? state;
    if (table.id !== get().selectedTable) return;
    if (state.table) {
      get().setTableState(state);
      return;
    }
    const userId = useAuthStore.getState().user?.id;
    const ownPlayer = table.players?.find((player: PokerPlayer) => player.userId === userId);
    get().setTableState({
      table,
      players: table.players,
      myCards: ownPlayer && table.phase !== 'waiting' ? get().myCards : [],
      mySeat: ownPlayer?.seat ?? null,
      isAtTable: !!ownPlayer,
      isMyTurn: !!ownPlayer && table.players[table.currentPlayerIndex]?.userId === userId,
    });
  },

  joinTable: async (tableId) => {
    if (get().loading) return;
    set({ loading: true, error: '' });
    set({ selectedTable: tableId });
    try {
      const response = await pokerRequest('poker:join-table', { tableId });
      get().setTableState(response.state);
      set({ selectedTable: tableId });
    } catch (err: any) { set({ ...initialState, tables: get().tables, error: err.message }); }
  },

  startBotGame: async (buyIn) => {
    if (get().loading) return;
    set({ loading: true, error: '' });
    try {
      const response = await pokerRequest('poker:start-bots', { buyIn });
      set({ selectedTable: response.state.table.id });
      get().setTableState(response.state);
    } catch (err: any) { set({ loading: false, error: err.message }); }
    await syncPokerBalance();
  },

  resumeSession: async () => {
    set({ loading: true, error: '' });
    try {
      const response = await pokerRequest('poker:resume', {});
      if (response.state?.table) {
        set({ selectedTable: response.state.table.id });
        get().setTableState(response.state);
      } else set({ ...initialState, tables: get().tables });
    } catch (err: any) { set({ loading: false, error: err.message }); }
    await syncPokerBalance();
  },

  leaveTable: async (tableId) => {
    if (get().loading) return false;
    set({ loading: true, error: '' });
    try {
      await pokerRequest('poker:leave-table', { tableId });
      set({ ...initialState, tables: get().tables });
      get().getTables();
      await syncPokerBalance();
      return true;
    } catch (err: any) {
      set({ loading: false, error: err.message });
      await syncPokerBalance();
      return false;
    }
  },

  sitDown: async (tableId, seat, buyIn) => {
    if (get().loading) return;
    set({ loading: true, error: '' });
    try {
      const response = await pokerRequest('poker:sit-down', { tableId, seat, buyIn });
      get().setTableState(response.state);
      set({ selectedTable: tableId });
    } catch (err: any) { set({ loading: false, error: err.message }); }
    await syncPokerBalance();
  },

  standUp: async (tableId) => {
    if (get().loading) return false;
    set({ loading: true, error: '' });
    try {
      await pokerRequest('poker:stand-up', { tableId });
      set({ ...initialState, tables: get().tables });
      get().getTables();
      await syncPokerBalance();
      return true;
    } catch (err: any) {
      set({ loading: false, error: err.message });
      await syncPokerBalance();
      return false;
    }
  },

  rebuy: async (tableId, amount) => {
    if (get().loading) return;
    set({ loading: true, error: '' });
    try {
      const response = await pokerRequest('poker:rebuy', { tableId, amount });
      get().setTableState(response.state);
    } catch (err: any) { set({ loading: false, error: err.message }); }
    await syncPokerBalance();
  },

  handleAction: async (action, amount) => {
    const { selectedTable, loading } = get();
    if (!selectedTable || loading) return;
    set({ loading: true, error: '' });
    try {
      const response = await pokerRequest('poker:action', { tableId: selectedTable, action, amount });
      get().setGameUpdate(response.state);
    } catch (err: any) { set({ loading: false, error: err.message }); }
    await syncPokerBalance();
  },

  getTables: () => {
    const socket = getPokerSocket();
    socket.emit('poker:get-tables', (response: any) => {
      if (response.success) {
        set({ tables: response.tables });
      } else {
        set({ error: response.error || 'Liste des tables indisponible' });
      }
    });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  reset: () => set({ ...initialState }),
}));

async function pokerRequest(event: string, data: unknown): Promise<any> {
  const socket = getPokerSocket();
  if (!socket.connected) throw new Error('Connexion Poker indisponible. Aucune nouvelle operation envoyee.');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation non confirmee. Reconnectez-vous pour verifier la session avant de reessayer.')), 15000);
    socket.emit(event, data, (response: any) => {
      clearTimeout(timer);
      if (response?.success) resolve(response);
      else reject(new Error(response?.error || 'Operation Poker refusee'));
    });
  });
}

async function syncPokerBalance() {
  try {
    await useBalanceStore.getState().syncBalance();
  } catch (err: any) {
    const store = usePokerStore.getState();
    store.setError([store.error, err.message || 'Synchronisation du solde impossible'].filter(Boolean).join(' ; '));
  }
}

export function subscribePoker() {
  const socket = getPokerSocket();
  usePokerStore.getState().setLoading(true);
  const onConnect = () => {
    const store = usePokerStore.getState();
    store.getTables();
    void store.resumeSession();
  };
  const onUpdate = (state: any) => usePokerStore.getState().setGameUpdate(state);
  const onTables = (tables: PokerState['tables']) => usePokerStore.getState().setTables(tables);
  const onError = (error: Error) => usePokerStore.getState().setError(error.message || 'Connexion Poker impossible');
  const onEnded = ({ tableId }: { tableId: string }) => {
    const store = usePokerStore.getState();
    if (store.selectedTable !== tableId) return;
    usePokerStore.setState({ ...initialState, tables: store.tables });
    void syncPokerBalance();
  };
  socket.on('connect', onConnect);
  socket.on('poker:game-update', onUpdate);
  socket.on('poker:table-update', onUpdate);
  socket.on('poker:tables-update', onTables);
  socket.on('connect_error', onError);
  socket.on('poker:session-ended', onEnded);
  if (socket.connected) onConnect();
  return () => {
    socket.off('connect', onConnect);
    socket.off('poker:game-update', onUpdate);
    socket.off('poker:table-update', onUpdate);
    socket.off('poker:tables-update', onTables);
    socket.off('connect_error', onError);
    socket.off('poker:session-ended', onEnded);
  };
}
