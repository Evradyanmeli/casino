import api from './api';
import type { AuthResponse } from '@/types';

export const authApi = {
  register: (data: { email: string; pseudo: string; password: string; birthDate: string }) =>
    api.post<AuthResponse>('/auth/register', data).then(r => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data).then(r => r.data),

  loginWithGoogle: () => {
    window.location.href = '/api/v1/auth/google';
  },

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string }>('/auth/refresh', { refreshToken }).then(r => r.data),

  resetPassword: (email: string) =>
    api.post<{ message: string }>('/auth/reset-password', { email }).then(r => r.data),
};
