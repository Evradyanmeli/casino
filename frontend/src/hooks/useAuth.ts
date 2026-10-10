import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useBalanceStore } from '@/store/balanceStore';
import { userApi } from '@/services/user';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();
  const { setBalance, syncBalance } = useBalanceStore();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !user) {
      setLoading(true);
      userApi.getProfile()
        .then((user) => {
          setUser(user);
          setBalance(Number(user.balance));
          void syncBalance().catch(() => {});
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return { user, isAuthenticated, isLoading };
}
