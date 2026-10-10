import api from './api';

export interface RGSettings {
  depositLimit: { enabled: boolean; daily?: number; weekly?: number; monthly?: number };
  lossLimit: { enabled: boolean; daily?: number; weekly?: number; monthly?: number };
  sessionLimit: { enabled: boolean; minutes?: number };
  selfExclusion: { enabled: boolean; until?: string };
  realityCheck: { enabled: boolean; intervalMinutes?: number };
}

export const rgApi = {
  getSettings: () => api.get<RGSettings>('/responsible-gaming/settings').then(r => r.data),
  updateDepositLimit: (daily?: number, weekly?: number, monthly?: number) =>
    api.put('/responsible-gaming/deposit-limit', { daily: daily ?? null, weekly: weekly ?? null, monthly: monthly ?? null, enabled: [daily, weekly, monthly].some(n => n !== undefined) }).then(r => r.data),
  updateLossLimit: (daily?: number, weekly?: number, monthly?: number) =>
    api.put('/responsible-gaming/loss-limit', { daily: daily ?? null, weekly: weekly ?? null, monthly: monthly ?? null, enabled: [daily, weekly, monthly].some(n => n !== undefined) }).then(r => r.data),
  updateSessionLimit: (minutes?: number) =>
    api.put('/responsible-gaming/session-limit', { minutes: minutes ?? null, enabled: minutes !== undefined }).then(r => r.data),
  setSelfExclusion: (days: number) =>
    api.post('/responsible-gaming/self-exclude', { days }).then(r => r.data),
  cancelSelfExclusion: () =>
    api.post('/responsible-gaming/cancel-self-exclude').then(r => r.data),
  enableRealityCheck: (intervalMinutes: number) =>
    api.put('/responsible-gaming/reality-check', { intervalMinutes: intervalMinutes || null, enabled: intervalMinutes > 0 }).then(r => r.data),
};
