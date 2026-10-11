import api from './api';
import type { DashboardStats, AdminUserRow, GameStat, GameConfig, SystemSetting, AuditLog, ChatMessageFull, HouseBalance } from '@/types';

export function capitalUsage(house: HouseBalance): number {
  return house.capital > 0 ? ((house.capital - (house.totalBalance ?? house.balance)) / house.capital) * 100 : 0;
}

export const economyDefaults: Record<string, number> = {
  welcome_bonus: 5000, daily_reward_base: 1000, daily_reward_streak_7: 2500,
  daily_reward_streak_30: 10000, competition_prize_first: 2500,
  competition_prize_second: 1500, competition_prize_third: 1000,
  default_house_edge: 5,
};

export function parseSettingValue(key: string, text: string): unknown {
  if (key === 'task_reward_base' || key === 'task_reward_all') throw new Error('Unsupported setting');
  const value: unknown = JSON.parse(text);
  if (Object.hasOwnProperty.call(economyDefaults, key) &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      (key === 'default_house_edge' ? value >= 100 : !Number.isSafeInteger(value)) ||
      (key.startsWith('daily_reward_') && value === 0) ||
      (key.startsWith('competition_prize_') && value > 2147483647))) {
    throw new Error('Invalid setting value');
  }
  return value;
}

export const adminApi = {
  getDashboard: (period: '24h' | '7d' | '30d' = '24h') => api.get<DashboardStats>('/admin/dashboard', { params: { period } }).then(r => r.data),
  getUsers: (page: number, limit: number, search?: string) =>
    api.get<{ users: AdminUserRow[]; total: number }>('/admin/users', { params: { page, limit, search } }).then(r => r.data),
  getUserDetails: (id: string) => api.get(`/admin/users/${id}`).then(r => r.data),
  toggleBan: (id: string) => api.post(`/admin/users/${id}/ban`).then(r => r.data),
  adjustBalance: (id: string, amount: number, reason: string) =>
    api.post(`/admin/users/${id}/adjust-balance`, { amount, reason }).then(r => r.data),
  getGameStats: (game?: string) => api.get<GameStat[]>('/admin/games/stats', { params: { game } }).then(r => r.data),
  getRecentGames: () => api.get('/admin/games/recent').then(r => r.data),
  getSettings: () => api.get<SystemSetting[]>('/admin/settings').then(r => r.data),
  updateSetting: (key: string, value: any) => api.put('/admin/settings', { key, value }).then(r => r.data),
  updateSettings: (settings: { key: string; value: unknown }[]) => api.put('/admin/settings', { settings }).then(r => r.data),
  getHouseBalance: () => api.get<HouseBalance>('/admin/economy/house-balance').then(r => r.data),
  rechargeHouse: (amount: number) => api.post('/admin/economy/house-recharge', { amount }).then(r => r.data),
  getGameConfigs: () => api.get<GameConfig[]>('/admin/games/config').then(r => r.data),
  updateGameConfig: (gameType: string, data: { houseEdge?: number; minBet?: number; maxBet?: number; active?: boolean }) =>
    api.put<GameConfig>('/admin/games/config', { gameType, ...data }).then(r => r.data),
  getChatMessages: (room?: string, limit?: number) =>
    api.get<ChatMessageFull[]>('/admin/chat/messages', { params: { room, limit } }).then(r => r.data),
  deleteChatMessage: (id: string) => api.delete(`/admin/chat/messages/${id}`).then(r => r.data),
  banUserFromChat: (userId: string) => api.post(`/admin/chat/ban/${userId}`).then(r => r.data),
  createAnnouncement: (title: string, content: string, type?: string) =>
    api.post('/admin/notifications', { title, content, type }).then(r => r.data),
  getAuditLogs: (params?: { adminId?: string; action?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) =>
    api.get<{ logs: AuditLog[]; total: number }>('/admin/audit-logs', { params }).then(r => r.data),
};
