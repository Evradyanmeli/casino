import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 15000,
});
let refreshing: Promise<void> | null = null;

export function financialRequestKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Local HTTP hostnames are not secure contexts; getRandomValues remains available.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

api.interceptors.request.use((config) => {
  const path = config.url?.split('?')[0] ?? '';
  const financialPost = /^\/(?:shop\/purchase\/[^/]+|games\/(?:slots\/spin|roulette\/spin|limbo\/play|wheel\/spin|keno\/play|plinko\/drop|blackjack\/(?:start|double|split|insurance)|videopoker\/deal|mines\/start|craps\/(?:start|odds)|crash\/bet)|economy\/daily-reward|progression\/tasks\/[^/]+\/claim|progression\/race\/claim|admin\/users\/[^/]+\/adjust-balance|admin\/economy\/house-recharge)$/.test(path);
  if (config.method?.toLowerCase() === 'post' && financialPost && !config.headers.has('Idempotency-Key')) {
    config.headers.set('Idempotency-Key', financialRequestKey());
  }
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config?._retry && !error.config?.url?.startsWith('/auth/')) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          error.config._retry = true;
          if (!refreshing) refreshing = axios.post('/api/v1/auth/refresh', { refreshToken }).then(({ data }) => {
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
          }).finally(() => { refreshing = null; });
          await refreshing;
          error.config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
          return api.request(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.pathname = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
