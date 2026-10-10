import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { minesApi, type MinesState } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import { Bomb, Gem, Trophy, CircleDollarSign, XCircle } from 'lucide-react';
import ResultSummary from './ResultSummary';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';

const GRID_SIZE = 5;

export default function MinesGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const [mineCount, setMineCount] = useState(3);
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState<MinesState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [history, setHistory] = useState<{ payout: number; bet: number }[]>([]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    minesApi.getState().then(state => { if (active) { setGame(state); if (state) setBet(state.bet); } })
      .catch(err => { if (active) setError(err.response?.data?.error || 'Session indisponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const startGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await minesApi.start(bet, mineCount);
      setGame(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de démarrage');
    } finally {
      setLoading(false);
    }
  }, [bet, mineCount]);

  const revealTile = useCallback(async (tileIndex: number) => {
    if (!game || game.state !== 'playing' || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await minesApi.reveal(game.sessionId, tileIndex);
      setGame(result);
      if (result.state === 'lost' || result.state === 'won') {
        setHistory(h => [{ payout: result.payout, bet: result.bet }, ...h]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de révélation');
    } finally {
      setLoading(false);
    }
  }, [game, loading]);

  const cashOut = useCallback(async () => {
    if (!game || game.state !== 'playing' || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await minesApi.cashOut(game.sessionId);
      setGame(result);
      setHistory(h => [{ payout: result.payout, bet: result.bet }, ...h]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de cash out');
    } finally {
      setLoading(false);
    }
  }, [game, loading]);

  const reset = useCallback(() => {
    setGame(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-2xl font-display text-gold">Mines</h1>
          <div className="text-sm text-gray-400">
            Solde: <span className="text-gold font-semibold">{balance.toLocaleString()}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!game ? (
          <div className="card space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre de mines (1-24)</label>
              <input
                type="range"
                min={1}
                max={24}
                value={mineCount}
                onChange={e => setMineCount(Number(e.target.value))}
                className="w-full accent-gold"
              />
              <span className="text-gold font-semibold">{mineCount} mines</span>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Mise</label>
              <div className="flex gap-2">
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
              onClick={startGame}
              disabled={loading || bet > balance}
              className="btn-primary w-full"
            >
              {loading ? 'Démarrage...' : bet > balance ? 'Solde insuffisant' : 'Commencer la partie'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-400">Multiplicateur: </span>
                <span className="text-gold font-semibold">{game.multiplier.toFixed(2)}x</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Tiles: </span>
                <span className="text-accent font-semibold">{game.revealedCount}/{25 - game.mineCount}</span>
              </div>
              {game.state === 'playing' && game.revealedCount > 0 && (
                <button
                  onClick={cashOut}
                  disabled={loading}
                  className="bg-gold text-black font-bold px-6 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {loading ? '...' : `Cash Out (${Math.floor(game.bet * game.multiplier)})`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
              {game.grid.flat().map((cell, i) => {
                let bg = 'bg-[#1A1A2E] border-gray-700';
                    let content: ReactNode = '';
                let animCls = '';
                if (cell.revealed) {
                  if (cell.isMine) {
                    bg = 'bg-red-900/50 border-red-500';
                    content = <Bomb className="w-6 h-6 text-red-400" />;
                  } else {
                    bg = 'bg-green-900/30 border-green-500';
                    content = <Gem className="w-6 h-6 text-green-400" />;
                  }
                  animCls = 'animate-flip-tile';
                }
                return (
                  <button
                    key={i}
                    aria-label={`Case ${i + 1}, ${cell.revealed ? cell.isMine ? 'mine' : 'gemme' : 'masquee'}`}
                    onClick={() => revealTile(i)}
                    disabled={cell.revealed || game.state !== 'playing' || loading}
                    className={`aspect-square rounded-xl border text-2xl flex items-center justify-center transition-all duration-200 ${bg} ${animCls} ${!cell.revealed && game.state === 'playing' ? 'hover:border-gold hover:bg-gold/5 cursor-pointer' : ''}`}
                    style={cell.revealed ? { animationDelay: `${i * 50}ms` } : undefined}
                  >
                    {content}
                  </button>
                );
              })}
            </div>

            <div className="text-center text-sm text-gray-400">
              {game.state === 'lost' && <span className="text-error font-semibold"><XCircle className="w-5 h-5 inline-block mr-1" /> Perdu !</span>}
              {(game.state === 'won' || game.state === 'lost') && <ResultSummary payout={game.payout} bet={game.bet} />}
            </div>

            {(game.state === 'lost' || game.state === 'won') && (
              <button onClick={reset} className="btn-outline w-full">
                Nouvelle partie
              </button>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Historique</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className={`text-sm flex justify-between ${h.payout > h.bet ? 'text-success' : 'text-error'}`}>
                  <span>Retour brut {h.payout} GC</span>
                  <span className="font-semibold">Net {signedNet(h.payout, h.bet)} GC</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
