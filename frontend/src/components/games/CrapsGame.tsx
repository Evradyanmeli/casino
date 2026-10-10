import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import { useBalanceStore } from '@/store/balanceStore';
import { gamesApi, type CrapsState } from '@/services/games';

const DOT_MAP: Record<number, number[][]> = {
  1: [[0,0,0, 0,1,0, 0,0,0]],
  2: [[0,0,1, 0,0,0, 1,0,0]],
  3: [[0,0,1, 0,1,0, 1,0,0]],
  4: [[1,0,1, 0,0,0, 1,0,1]],
  5: [[1,0,1, 0,1,0, 1,0,1]],
  6: [[1,0,1, 1,0,1, 1,0,1]],
};

function DiceFace({ value }: { value: number }) {
  const dots = DOT_MAP[value]?.[0] ?? [];
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 bg-white rounded-lg p-2 shadow-inner">
      {dots.map((d, i) => (
        <div key={i} className={`rounded-full ${d ? 'bg-gray-900' : ''} w-3 h-3`} />
      ))}
    </div>
  );
}

function DiceAnimation({ dice, rolling }: { dice: [number, number] | null; rolling: boolean }) {
  return (
    <div className="flex gap-6 justify-center my-6">
      <div className={`transition-transform duration-300 ${rolling ? 'animate-dice-roll' : ''}`}>
        <DiceFace value={dice?.[0] ?? 1} />
      </div>
      <div className={`transition-transform duration-300 ${rolling ? 'animate-dice-roll' : ''}`}
        style={rolling ? { animationDelay: '0.1s' } : undefined}>
        <DiceFace value={dice?.[1] ?? 1} />
      </div>
    </div>
  );
}

export default function CrapsGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const [roundBet, setRoundBet] = useState(0);
  const [game, setGame] = useState<CrapsState | null>(null);
  const [passBet, setPassBet] = useState(10);
  const [oddsBet, setOddsBet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useGameError();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    gamesApi.craps.getState().then(state => { if (active) { setGame(state); if (state) setRoundBet(state.passBet); } })
      .catch(err => { if (active) setError(err.response?.data?.error || 'Session indisponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleStart = async () => {
    setLoading(true); setError('');
    try {
      const res = await gamesApi.craps.start(passBet);
      setGame(res);
      setRoundBet(passBet);
      if (res.phase === 'resolved') {
        setRolling(true);
        timeoutRef.current = setTimeout(() => setRolling(false), 600);
      }
    } catch (err: any) { setError(err.response?.data?.error || err.message || 'Erreur de démarrage'); }
    finally { setLoading(false); }
  };

  const handleOdds = async () => {
    if (!game) return;
    setLoading(true); setError('');
    try {
      const res = await gamesApi.craps.addOdds(game.sessionId, oddsBet);
      setGame(res);
    } catch (err: any) { setError(err.response?.data?.error || err.message || 'Erreur de mise odds'); }
    finally { setLoading(false); }
  };

  const handleRoll = async () => {
    if (!game) return;
    setLoading(true); setError(''); setRolling(true);
    try {
      const res = await gamesApi.craps.roll(game.sessionId);
      timeoutRef.current = setTimeout(() => { setGame(res); setRolling(false); }, 600);
    } catch (err: any) { setError(err.response?.data?.error || err.message || 'Erreur de lancer'); setRolling(false); }
    finally { setLoading(false); }
  };

  const reset = () => { setGame(null); setOddsBet(0); setError(''); };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
          ← Retour
        </button>
        <h2 className="text-2xl font-display text-gold">Craps</h2>
        <div className="text-sm text-gray-400">
          Solde: <span className="text-gold font-semibold">{balance.toLocaleString()}</span>
        </div>
      </div>

      {!game && (
        <div className="card space-y-4">
          <label className="text-white text-sm">Mise Pass Line</label>
          <input type="number" value={passBet} onChange={e => setPassBet(Number(e.target.value))}
            className="input-field" min={1} />
          <button onClick={handleStart} disabled={loading}
            className="btn-primary w-full">{loading ? '...' : 'Commencer'}</button>
        </div>
      )}

      {game && (
        <>
          <DiceAnimation dice={game.dice} rolling={rolling} />

          <div className="card space-y-3 text-center">
            {game.phase === 'comeout' && <p className="text-white">Phase de sortie - Lancez les dés</p>}
            {game.phase === 'point' && (
              <>
                <p className="text-accent text-lg">Point établi: <span className="font-bold">{game.point}</span></p>
                <DiceFace value={game.point!} />
              </>
            )}

            {game.phase === 'resolved' && <ResultSummary payout={game.payout} bet={roundBet + game.oddsBet} />}

            {game.diceTotal && (
              <p className="text-white">Total: <span className="font-bold">{game.diceTotal}</span></p>
            )}
          </div>

          {game.phase === 'point' && !game.oddsBet && (
            <div className="card space-y-4">
              <label className="text-white text-sm">Mise Odds (true odds, sans house edge)</label>
              <input type="number" value={oddsBet} onChange={e => setOddsBet(Number(e.target.value))}
                className="input-field" min={1} />
              <button onClick={handleOdds} disabled={loading}
                className="btn-outline w-full">Ajouter Odds</button>
            </div>
          )}

          {game.phase === 'point' && (
            <button onClick={handleRoll} disabled={loading || rolling}
              className="btn-primary w-full">
              {rolling ? 'Lancement...' : 'Lancer les dés'}
            </button>
          )}

          {game.phase === 'resolved' && (
            <button onClick={reset} className="btn-primary w-full">Nouvelle partie</button>
          )}

        </>
      )}
      {error && <p className="text-error text-sm text-center" role="alert">{error}</p>}
    </div>
  );
}
