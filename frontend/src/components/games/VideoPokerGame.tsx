import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBalanceStore } from '@/store/balanceStore';
import { gamesApi, type VPState } from '@/services/games';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

const PAYOUT_TABLE = [
  { hand: 'Quinte Flush Royale', coeff: '250x', maxBet: '800x' },
  { hand: 'Quinte Flush', coeff: '50x' },
  { hand: 'Carré', coeff: '25x' },
  { hand: 'Full', coeff: '9x' },
  { hand: 'Couleur', coeff: '6x' },
  { hand: 'Quinte', coeff: '4x' },
  { hand: 'Brelan', coeff: '3x' },
  { hand: 'Deux Paires', coeff: '2x' },
  { hand: 'Paire (Valet ou +)', coeff: '1x' },
  { hand: 'Rien', coeff: '0x' },
];

function CardView({ card, held, onClick }: { card: { suit: string; rank: string }; held: boolean; onClick: () => void }) {
  const color = SUIT_COLORS[card.suit] || 'text-gray-900';
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;
  return (
    <button onClick={onClick} className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 select-none cursor-pointer ${
      held ? 'border-gold bg-yellow-50 shadow-lg shadow-gold/30 scale-105' : 'border-gray-300 bg-white hover:border-gray-400'
    }`}>
      {held && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gold text-[#0D0D1A] text-xs font-bold px-2 py-0.5 rounded-full">HOLD</div>}
      <div className={`self-start text-xs sm:text-sm font-bold leading-none ${color}`}>{card.rank}</div>
      <div className={`text-lg sm:text-2xl ${color}`}>{symbol}</div>
      <div className={`self-end text-xs sm:text-sm font-bold leading-none rotate-180 ${color}`}>{card.rank}</div>
    </button>
  );
}

export default function VideoPokerGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const [gameState, setGameState] = useState<VPState | null>(null);
  const [bet, setBet] = useState(1);
  const [holds, setHolds] = useState([false, false, false, false, false]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [animKey, setAnimKey] = useState(0);
  const [animPhase, setAnimPhase] = useState<'idle' | 'discard' | 'deal'>('idle');
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (animTimer.current) clearTimeout(animTimer.current); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    gamesApi.vpState().then(state => { if (active) setGameState(state); })
      .catch(err => { if (active) setError(err.response?.data?.error || 'Session indisponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggleHold = (i: number) => {
    if (gameState?.phase === 'deal' && !loading) {
      setHolds(prev => prev.map((h, j) => j === i ? !h : h));
    }
  };

  const handleAction = useCallback(async (action: () => Promise<VPState>) => {
    setLoading(true);
    setError('');
    try {
      const result = await action();
      setGameState(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }, []);

  const deal = () => {
    setHolds([false, false, false, false, false]);
    setAnimPhase('deal');
    setAnimKey(k => k + 1);
    handleAction(() => gamesApi.vpDeal(bet));
  };

  const draw = () => {
    if (!gameState) return;
    const nonHeldCount = holds.filter(h => !h).length;
    if (nonHeldCount > 0) {
      setAnimPhase('discard');
      setAnimKey(k => k + 1);
      animTimer.current = setTimeout(() => {
        setAnimPhase('deal');
        setAnimKey(k => k + 1);
      }, 300);
    }
    handleAction(() => gamesApi.vpDraw(gameState.sessionId, holds));
  };

  const newGame = () => {
    setGameState(null);
    setHolds([false, false, false, false, false]);
    setError('');
    setAnimPhase('idle');
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center p-4">
        <div className="bg-[#1A1A2E] rounded-2xl p-8 border border-gray-800 max-w-sm w-full text-center space-y-6">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm self-start mb-2">
            ← Retour
          </button>
          <h2 className="text-2xl font-display text-gold">Video Poker</h2>
          <p className="text-gray-400">Solde: {balance} crédits</p>
          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Mise (1-5 pièces)</label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  className={`w-10 h-10 rounded-lg font-bold transition-all ${
                    bet === v ? 'bg-gold text-[#0D0D1A]' : 'bg-[#2A2A3E] text-gray-300 hover:bg-[#3A3A4E]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button onClick={deal} disabled={loading || bet > balance}
            className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Chargement...' : 'Distribuer'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  const isDiscard = animPhase === 'discard';

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex flex-col lg:flex-row">
      <div className="flex-1 bg-gradient-to-b from-green-900 via-green-800 to-green-900 m-4 sm:m-6 rounded-2xl shadow-2xl border border-green-700/30 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,215,0,0.3) 0%, transparent 50%)' }} />

        <div className="relative z-10 flex flex-col items-center py-6 px-4 flex-1">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm self-start mb-2">
            ← Retour
          </button>
          <h2 className="text-2xl font-display text-gold mb-2">Video Poker</h2>
          <p className="text-gray-400 text-sm mb-6">Mise: {gameState.bet} pièce{gameState.bet > 1 ? 's' : ''}</p>

          <div className="flex gap-2 sm:gap-3 mb-8">
            {gameState.hand.map((card, i) => {
              let animClass = '';
              if (isDiscard && gameState.phase !== 'complete') {
                const shouldDiscard = !holds[i];
                animClass = shouldDiscard ? 'animate-card-discard' : '';
              } else if (animPhase === 'deal') {
                animClass = 'animate-card-deal';
              }
              return (
                <div
                  key={`${animKey}-${i}`}
                  className={animClass}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <CardView
                    card={card}
                    held={gameState.phase === 'deal' ? holds[i] : gameState.held[i]}
                    onClick={() => toggleHold(i)}
                  />
                </div>
              );
            })}
          </div>

          {gameState.phase === 'complete' && (
            <div className="text-center mb-4">
              <p className="text-xl font-bold text-gold mb-1">{gameState.handName}</p>
               <ResultSummary payout={gameState.payout} bet={gameState.bet} />
              <button onClick={newGame} className="btn-primary mt-4">
                Nouvelle partie
              </button>
            </div>
          )}

          {gameState.phase === 'deal' && (
            <div className="flex gap-3 mt-auto pb-4">
              <button onClick={draw} disabled={loading}
                className="bg-gold text-[#0D0D1A] font-bold py-2.5 px-8 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 shadow-lg text-lg">
                Piocher
              </button>
              <button onClick={() => handleAction(() => gamesApi.vpCancel(gameState.sessionId))} disabled={loading}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2.5 px-6 rounded-lg transition-all disabled:opacity-50 shadow-lg">
                Abandonner (mise perdue)
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          {loading && <p className="text-gray-400 text-sm mt-2">Chargement...</p>}
        </div>
      </div>

      <div className="lg:w-72 bg-[#1A1A2E] m-4 sm:m-6 lg:ml-0 lg:my-6 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-gold font-display text-lg mb-4 text-center">Table des Paiements</h3>
        <div className="space-y-1">
          {PAYOUT_TABLE.map((row, i) => (
            <div key={i} className={`flex justify-between text-sm px-3 py-1.5 rounded ${
              gameState.handName === row.hand ? 'bg-gold/20 border border-gold/40' : ''
            }`}>
              <span className={gameState.handName === row.hand ? 'text-gold' : 'text-gray-300'}>{row.hand}</span>
              <span className="text-gray-400 font-mono">{row.maxBet || row.coeff}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center italic border-t border-gray-800 pt-3">
          Quinte Flush Royale: 800x avec mise max (5)
        </p>
      </div>
    </div>
  );
}
