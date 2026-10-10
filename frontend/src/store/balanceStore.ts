import { create } from 'zustand';
import { economyApi } from '@/services/economy';

interface BalanceState {
  balance: number;
  isLoading: boolean;
  error: string | null;
  setBalance: (balance: number) => void;
  addBalance: (amount: number) => void;
  syncBalance: () => Promise<void>;
}

let revision = 0;
export const useBalanceStore = create<BalanceState>((set) => ({
  balance: 0,
  isLoading: false,
  error: null,
  setBalance: (balance) => { revision++; set({ balance, error: null, isLoading: false }); },
  addBalance: (amount) => { revision++; set((state) => ({ balance: state.balance + amount, isLoading: false })); },
  syncBalance: async () => {
    const request = ++revision;
    set({ isLoading: true, error: null });
    try {
      const { balance } = await economyApi.getBalance();
      if (request !== revision) return;
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Solde invalide');
      set({ balance, isLoading: false, error: null });
      window.dispatchEvent(new CustomEvent('xp-updated'));
    } catch (err) {
      if (request === revision) set({ isLoading: false, error: 'Solde non actualise' });
      throw err;
    }
  },
}));
