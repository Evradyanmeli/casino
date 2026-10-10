import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 15000,
});
let refreshing: Promise<void> | null = null;

api.interceptors.request.use((config) => {
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
