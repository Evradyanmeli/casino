import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, XCircle } from 'lucide-react';
import { limboApi, type LimboState } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import ResultSummary from './ResultSummary';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';

export default function LimboGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const [target, setTarget] = useState(2.0);
  const [bet, setBet] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [result, setResult] = useState<LimboState | null>(null);
  const [history, setHistory] = useState<{ won: boolean; multiplier: number; target: number; payout: number; bet: number }[]>([]);
  const [rolling, setRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef<number>(0);

  const play = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRolling(true);
    setResult(null);
    setDisplayValue(0);

    const suspenseStart = performance.now();
    const suspenseDuration = 800;
    let suspenseRAF = 0;

    const suspenseAnimate = (now: number) => {
      const elapsed = now - suspenseStart;
      const progress = Math.min(elapsed / suspenseDuration, 1);
      setDisplayValue(1 + progress * 5);
      if (progress < 1) {
        suspenseRAF = requestAnimationFrame(suspenseAnimate);
      }
    };
    suspenseRAF = requestAnimationFrame(suspenseAnimate);

    try {
      const res = await limboApi.play(bet, target);
      cancelAnimationFrame(suspenseRAF);
      const targetVal = res.resultMultiplier;
      const animStart = performance.now();
      const duration = 1200;

      const animate = (now: number) => {
        const elapsed = now - animStart;
        const progress = Math.min(elapsed / duration, 1);
        const current = targetVal * Math.min(progress, 1);
        setDisplayValue(current);
        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(targetVal);
          setRolling(false);
          setResult(res);
           setHistory(h => [{ won: res.payout > res.bet, multiplier: res.resultMultiplier, target: res.targetMultiplier, payout: res.payout, bet: res.bet }, ...h]);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    } catch (err: any) {
      cancelAnimationFrame(suspenseRAF);
      setError(err.response?.data?.error || err.message || 'Erreur de jeu');
      setRolling(false);
    } finally {
      setLoading(false);
    }
  }, [bet, target]);

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const probability = (99 / target).toFixed(1);

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-2xl font-display text-gold">Limbo</h1>
          <div className="text-sm text-gray-400">
            Solde: <span className="text-gold font-semibold">{balance.toLocaleString()}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="card text-center py-12">
          <div className="text-5xl sm:text-7xl font-display font-bold mb-2 transition-all duration-200 break-words">
            <span className={rolling ? 'text-accent' : result ? (result.won ? 'text-success' : 'text-error') : 'text-gray-600'}>
              {rolling ? displayValue.toFixed(2) : result ? `${result.resultMultiplier.toFixed(2)}x` : '---'}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {rolling ? 'Calcul en cours...' : result ? <ResultSummary payout={result.payout} bet={result.bet} /> : 'Prêt à jouer'}
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <label htmlFor="limbo-target" className="block text-sm text-gray-400 mb-1">
              Multiplicateur cible: <span className="text-gold font-semibold">{target.toFixed(2)}x</span>
            </label>
            <input
              id="limbo-target"
              disabled={loading || rolling}
              type="range"
              min={1.01}
              max={100}
              step={0.01}
              value={target}
              onChange={e => setTarget(Number(e.target.value))}
              className="w-full accent-gold"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1.01x</span>
              <span>100x</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Probabilité: {probability}% · Paiement: {target.toFixed(2)}x
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Mise</label>
            <div className="flex gap-2 flex-wrap">
              {[10, 25, 50, 100].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${bet === v ? 'border-gold text-gold bg-gold/10' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={play}
            disabled={loading || bet > balance || rolling}
            className="btn-primary w-full"
          >
            {loading || rolling ? 'En cours...' : bet > balance ? 'Solde insuffisant' : 'Jouer'}
          </button>
        </div>

        {history.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Historique</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {history.slice(0, 20).map((h, i) => (
                <div key={i} className={`text-sm flex justify-between ${h.won ? 'text-success' : 'text-error'}`}>
                  <span>{h.multiplier.toFixed(2)}x (cible: {h.target.toFixed(2)}x)</span>
                  <span className="font-semibold">Brut {h.payout}, net {signedNet(h.payout, h.bet)} GC</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
