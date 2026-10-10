import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import { gamesApi, type KenoState } from '@/services/games';

export default function KenoGame() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bet, setBet] = useState(5);
  const [game, setGame] = useState<KenoState | null>(null);
  const [roundBet, setRoundBet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [revealedDrawn, setRevealedDrawn] = useState<number[]>([]);
  const revealTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const toggleNumber = (n: number) => {
    if (game) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < 10) next.add(n);
      return next;
    });
  };

  useEffect(() => {
    return () => { revealTimeouts.current.forEach(t => clearTimeout(t)); };
  }, []);

  useEffect(() => {
    if (!game?.drawnNumbers) return;
    setRevealedDrawn([]);
    const numbers = game.drawnNumbers;
    const timeouts = numbers.map((n, i) => setTimeout(() => {
      setRevealedDrawn(prev => [...prev, n]);
    }, i * 100));
    revealTimeouts.current = timeouts;
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [game?.drawnNumbers]);

  const handlePlay = async () => {
    if (selected.size === 0) return;
    setLoading(true); setError('');
    try {
      const res = await gamesApi.keno.play(bet, [...selected].sort((a, b) => a - b));
      setGame(res);
      setRoundBet(bet);
    } catch (err: any) { setError(err.response?.data?.error || err.message || 'Erreur de jeu'); }
    finally { setLoading(false); }
  };

  const reset = () => { setGame(null); setSelected(new Set()); setError(''); setRevealedDrawn([]); };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
          ← Retour
        </button>
        <h2 className="text-2xl font-display text-gold">Keno</h2>
        <div className="w-20" />
      </div>

      <div className="card">
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
          {Array.from({ length: 80 }, (_, i) => i + 1).map(n => {
            const isSelected = selected.has(n);
            const isDrawn = revealedDrawn.includes(n);
            const isMatch = isSelected && isDrawn;
            let cls = 'w-8 h-8 rounded text-xs font-bold cursor-pointer transition-colors flex items-center justify-center ';
            if (isMatch) cls += 'bg-gold text-[#0D0D1A]';
            else if (isDrawn) cls += 'bg-accent text-white';
            else if (isSelected) cls += 'bg-gold/30 text-gold border border-gold/50';
            else cls += 'bg-[#1A1A2E] text-gray-400 hover:bg-[#2A2A3E] border border-gray-800';
            if (game) cls = cls.replace('cursor-pointer', 'cursor-default');
            return (
              <button key={n} onClick={() => toggleNumber(n)} aria-pressed={isSelected}
                className={cls} disabled={!!game || loading}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card space-y-3">
        <p className="text-white text-sm">
          Sélectionnés: <span className="text-gold font-bold">{selected.size}</span>/10
        </p>

        {!game && (
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-white text-sm">Mise</label>
              <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))}
                className="input-field" min={1} />
            </div>
            <button onClick={handlePlay} disabled={loading || selected.size === 0}
              className="btn-primary h-fit">
              {loading ? '...' : 'Jouer'}
            </button>
          </div>
        )}

        {game && (
          <div className="text-center space-y-2">
            <p className="text-white">Matchs: <span className="text-gold font-bold">{game.matchCount}</span></p>
            <ResultSummary payout={game.payout} bet={roundBet} />
            <button onClick={reset} className="btn-primary w-full">Nouveau tirage</button>
          </div>
        )}

        {error && <p className="text-error text-sm">{error}</p>}
      </div>
    </div>
  );
}
