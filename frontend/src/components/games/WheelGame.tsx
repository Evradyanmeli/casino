import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResultSummary from './ResultSummary';
import { nextWheelAngle, signedNet } from './gameMath';
import { useGameError } from './useGameError';
import { gamesApi, type WheelState } from '@/services/games';

const SEGMENTS = [
  { multiplier: 50, color: '#FF1744' },
  { multiplier: 10, color: '#FF9100' },
  { multiplier: 5, color: '#FFD740' },
  { multiplier: 3, color: '#69F0AE' },
  { multiplier: 2, color: '#40C4FF' },
  { multiplier: 1.5, color: '#7C4DFF' },
  { multiplier: 1, color: '#E0E0E0' },
  { multiplier: 0, color: '#262636' },
];

const WEIGHTS = [1, 4, 8, 15, 20, 20, 32, 277 / 0.95 - 100];
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);

function buildConicGradient(segments = SEGMENTS, weights = WEIGHTS): string {
  let angle = 0;
  const parts: string[] = [];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  segments.forEach((seg, i) => {
    const pct = (weights[i] / total) * 100;
    parts.push(`${seg.color} ${angle}deg ${angle + pct * 3.6}deg`);
    angle += pct * 3.6;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

export default function WheelGame() {
  const navigate = useNavigate();
  const [game, setGame] = useState<WheelState | null>(null);
  const [bet, setBet] = useState(10);
  const [roundBet, setRoundBet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [error, setError] = useGameError();
  const [history, setHistory] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleSpin = async () => {
    setLoading(true); setError('');
    try {
      const res = await gamesApi.wheel.spin(bet);
      setGame(res);
      setRoundBet(bet);

      const targetAngle = nextWheelAngle(spinAngle, res.result.index, res.segments.map(s => s.weight));
      setSpinAngle(targetAngle);
      setSpinning(true);
      timeoutRef.current = setTimeout(() => {
        setSpinning(false);
        setHistory(h => [{ multiplier: res.result.segment.multiplier, payout: res.payout, bet }, ...h.slice(0, 9)]);
      }, 3000);
    } catch (err: any) { setError(err.response?.data?.error || err.message || 'Erreur de spin'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
          ← Retour
        </button>
        <h2 className="text-2xl font-display text-gold">Roue de la Fortune</h2>
        <div className="w-20" />
      </div>

      <div className="flex flex-wrap justify-center gap-3" aria-label="Multiplicateurs de la roue">
        {SEGMENTS.map(segment => <span key={segment.multiplier} className="text-sm flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: segment.color }} />{segment.multiplier}x</span>)}
      </div>
      <div className="relative w-64 h-64 mx-auto">
        <div
          className="w-full h-full rounded-full border-4 border-gray-700 shadow-xl transition-transform duration-[3000ms] ease-out"
          style={{
            background: buildConicGradient(game?.segments, game?.segments.map(s => s.weight)),
            transform: `rotate(${spinAngle}deg)`,
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#0D0D1A] border-2 border-gray-700 flex items-center justify-center">
            <span className="text-gold text-sm font-bold">CASINO</span>
          </div>
        </div>
      </div>

      {game && !spinning && (
        <div className="card text-center space-y-2">
          <p className="text-white">
            Résultat: <span className="font-bold text-gold">{game.result.segment.multiplier}x</span>
          </p>
          <ResultSummary payout={game.payout} bet={roundBet} />
        </div>
      )}

      <div className="card space-y-4">
        <label className="text-white text-sm">Mise</label>
        <input type="number" aria-label="Mise" disabled={loading || spinning} value={bet} onChange={e => setBet(Number(e.target.value))}
          className="input-field" min={1} />
        <button onClick={handleSpin} disabled={loading || spinning}
          className="btn-primary w-full">
          {spinning ? 'Tourne...' : loading ? '...' : 'Tourner'}
        </button>
        {error && <p className="text-error text-sm">{error}</p>}
      </div>

      {history.length > 0 && (
        <div className="card">
          <h3 className="text-white text-sm font-semibold mb-2">Historique</h3>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-[#2A2A3E] text-gold">
                {h.multiplier}x, brut {h.payout}, net {signedNet(h.payout, h.bet)} GC
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
