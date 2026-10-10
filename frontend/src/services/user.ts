import api from './api';
import type { User, UserStats, Transaction } from '@/types';

export const userApi = {
  getProfile: () => api.get<User>('/users/me').then(r => r.data),
  updateProfile: (data: Partial<{ pseudo: string; avatar: string; customAvatar: string }>) =>
    api.put<User>('/users/me', data).then(r => r.data),
  getStats: () => api.get<UserStats>('/users/me/stats').then(r => r.data),
  getTransactions: (filter?: string) =>
    api.get<Transaction[]>('/users/me/transactions', { params: { filter } }).then(r => r.data),
};
