import api from './api';

export interface DailyRewardInfo {
  available: boolean;
  streak: number;
  amount: number;
  nextIn: string;
}

export interface ClaimResult {
  amount: number;
  streak: number;
  newBalance: number;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
}

export const economyApi = {
  getBalance: () => api.get<{ balance: number }>('/economy/balance').then(r => r.data),
  getDailyInfo: () => api.get<DailyRewardInfo>('/economy/daily-info').then(r => r.data),
  claimDailyReward: () => api.post<ClaimResult>('/economy/daily-reward').then(r => r.data),
  getTransactions: (filter?: string, limit?: number, offset?: number) =>
    api.get<{ transactions: Transaction[] }>('/economy/transactions', { params: { filter, limit, offset } }).then(r => r.data),
};
