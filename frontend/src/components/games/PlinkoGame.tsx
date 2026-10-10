import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi, type PlinkoResult } from '@/services/games';
import { PLINKO_MULTIPLIERS } from './gameMath';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';

export default function PlinkoGame() {
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [roundBet, setRoundBet] = useState(0);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [rows, setRows] = useState(12);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useGameError();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = (rows + 1) * 50;
  const height = 40 + rows * 30 + 60;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) {
      setLoading(false);
      if (result) setError('Animation indisponible ; le resultat serveur est affiche.');
      setFinished(!!result);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const table = result ? result.multipliers : PLINKO_MULTIPLIERS[risk][rows];
    const draw = (now: number) => {
      const progress = result ? Math.min((now - start) / (rows * 100), 1) : 0;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0D0D1A';
      ctx.fillRect(0, 0, width, height);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= row; col++) {
          ctx.beginPath();
          ctx.arc(width / 2 + (col - row / 2) * 50, 55 + row * 30, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#5A5A7E';
          ctx.fill();
        }
      }
      for (let slot = 0; slot <= rows; slot++) {
        const hit = progress === 1 && result?.slot === slot;
        ctx.fillStyle = hit ? '#FFD700' : '#1A3A1A';
        ctx.fillRect(slot * 50 + 1, height - 40, 48, 30);
        ctx.fillStyle = hit ? '#0D0D1A' : '#DDD';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${table[slot]}x`, slot * 50 + 25, height - 21);
      }
      if (!result) return;
      const step = progress * rows;
      const completed = Math.floor(step);
      const col = result.path.slice(0, completed).reduce((sum, direction) => sum + direction, 0);
      const partial = step - completed;
      const direction = result.path[completed] ?? 0;
      // Follow the server path, but land on its authoritative bucket.
      const x = progress === 1 ? result.slot * 50 + 25 : width / 2 + (col + direction * partial - step / 2) * 50;
      const y = progress === 1 ? height - 25 : 40 + step * 30;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      if (progress < 1) {
        frame = requestAnimationFrame(draw);
      } else {
        setFinished(true);
        setLoading(false);
      }
    };
    draw(start);
    return () => cancelAnimationFrame(frame);
  }, [result, rows, risk, width, height]);

  const handleDrop = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setFinished(false);
    try {
      const res = await gamesApi.plinko.drop(bet, risk, rows);
      setRoundBet(bet);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur de lancer');
      setLoading(false);
    }
  };

  const changeConfig = () => { setResult(null); setFinished(false); };
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold text-sm">← Retour</button>
        <h2 className="text-2xl font-display text-gold">Plinko</h2>
      </div>
      <canvas ref={canvasRef} width={width} height={height} aria-label="Plateau Plinko" className="block w-full max-w-full h-auto rounded-xl border border-gray-800" />
      <div className="card space-y-4">
        <fieldset disabled={loading} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="plinko-bet" className="text-white text-sm">Mise</label>
            <input id="plinko-bet" type="number" value={bet} onChange={e => setBet(Math.max(1, Number(e.target.value)))} className="input-field" min={1} />
          </div>
          <div>
            <label htmlFor="plinko-risk" className="text-white text-sm">Risque</label>
            <select id="plinko-risk" value={risk} onChange={e => { changeConfig(); setRisk(e.target.value as typeof risk); }} className="input-field">
              <option value="low">Bas</option><option value="medium">Moyen</option><option value="high">Haut</option>
            </select>
          </div>
          <div>
            <label htmlFor="plinko-rows" className="text-white text-sm">Rangees</label>
            <select id="plinko-rows" value={rows} onChange={e => { changeConfig(); setRows(Number(e.target.value)); }} className="input-field">
              <option value={8}>8</option><option value={12}>12</option><option value={16}>16</option>
            </select>
          </div>
        </fieldset>
        <button onClick={handleDrop} disabled={loading} className="btn-primary w-full">{loading ? 'En cours...' : 'Lacher la bille'}</button>
        {error && <p className="text-error text-sm" role="alert">{error}</p>}
        {result && finished && <div className="text-center space-y-1"><p className="text-gold">Case {result.slot + 1} : {result.multiplier}x</p><ResultSummary payout={result.payout} bet={roundBet} /></div>}
      </div>
    </div>
  );
}
