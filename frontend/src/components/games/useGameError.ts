import { useEffect, useState } from 'react';
import { GAME_BALANCE_ERROR } from '@/services/games';

export function useGameError() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onBalanceError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setError(previous => [previous, message].filter(Boolean).join(' ; '));
    };
    window.addEventListener(GAME_BALANCE_ERROR, onBalanceError);
    return () => window.removeEventListener(GAME_BALANCE_ERROR, onBalanceError);
  }, []);
  return [error, setError] as const;
}
