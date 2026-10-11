import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBalanceStore } from '@/store/balanceStore';
import { gamesApi, type VPState } from '@/services/games';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import GameHeader from './GameHeader';
import { PlayingCard, CasinoChip, useReducedMotion } from './GameVisuals';

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

export default function VideoPokerGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const [gameState, setGameState] = useState<VPState | null>(null);
  const [bet, setBet] = useState(1);
  const [holds, setHolds] = useState([false, false, false, false, false]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const reducedMotion = useReducedMotion();
  const [animPhase, setAnimPhase] = useState<'idle' | 'discard' | 'deal'>('idle');
  const animTimer = useRef<{ id: ReturnType<typeof setTimeout>; resolve: () => void } | null>(null);
  const busy = useRef(true);
  const mounted = useRef(false);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    busy.current = true;
    setLoading(true);
    gamesApi.vpState().then(state => {
      if (active) {
        setGameState(state);
        if (state) setHolds(state.held);
      }
    })
      .catch(err => { if (active) setError(err.response?.data?.error || 'Session indisponible'); })
      .finally(() => { if (active) { busy.current = false; setLoading(false); } });
    return () => {
      active = false;
      mounted.current = false;
      if (animTimer.current) {
        clearTimeout(animTimer.current.id);
        animTimer.current.resolve();
        animTimer.current = null;
      }
    };
  }, []);

  const toggleHold = (i: number) => {
    if (gameState?.phase === 'deal' && !busy.current) {
      setHolds(prev => prev.map((h, j) => j === i ? !h : h));
    }
  };

  const handleAction = useCallback(async (action: () => Promise<VPState>, animation?: 'deal' | 'draw') => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    const wait = (duration: number) => new Promise<void>(resolve => {
      animTimer.current = { id: setTimeout(() => { animTimer.current = null; resolve(); }, duration), resolve };
    });
    const discard = animation === 'draw' && holds.some(held => !held) && !reducedMotion;
    if (animation === 'deal') setHolds([false, false, false, false, false]);
    if (discard) setAnimPhase('discard');
    try {
      // Keep the old hand visible until both its discard and the request finish.
      const [result] = await Promise.all([action(), discard ? wait(580) : Promise.resolve()]);
      if (!mounted.current) return;
      setGameState(result);
      if (animation && !reducedMotion && (animation === 'deal' || discard)) {
        setAnimPhase('deal');
        await wait(850);
      }
    } catch (err: any) {
      if (mounted.current) setError(err.response?.data?.error || err.message || 'Une erreur est survenue');
    } finally {
      if (animTimer.current) {
        clearTimeout(animTimer.current.id);
        animTimer.current.resolve();
        animTimer.current = null;
      }
      if (mounted.current) {
        setAnimPhase('idle');
        busy.current = false;
        setLoading(false);
      }
    }
  }, [holds, reducedMotion]);

  const deal = () => {
    if (bet > balance) return;
    void handleAction(() => gamesApi.vpDeal(bet), 'deal');
  };

  const draw = () => {
    if (!gameState || gameState.phase !== 'deal') return;
    void handleAction(() => gamesApi.vpDraw(gameState.sessionId, holds), 'draw');
  };

  const newGame = () => {
    if (busy.current) return;
    setGameState(null);
    setHolds([false, false, false, false, false]);
    setError('');
    setAnimPhase('idle');
  };

  if (!gameState) {
    return (
      <div className="max-w-6xl mx-auto space-y-5" aria-busy={loading}>
        <GameHeader title="Video Poker" eyebrow="Jacks or Better" description="Cinq cartes, un tirage. Gardez les cartes de votre choix." onBack={() => navigate('/lobby')} />
        <div className="casino-stage p-4 sm:p-8 flex flex-col items-center gap-6">
          <div className="grid grid-cols-5 gap-1 sm:gap-3 w-full max-w-lg" aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => <PlayingCard key={i} hidden className="!w-full !h-auto aspect-[5/7]" />)}
          </div>
        <div className="casino-panel p-4 sm:p-6 max-w-md w-full text-center space-y-6">
          <p className="text-gray-400">Solde: {balance} crédits</p>
          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Mise (1-5 pièces)</label>
            <div className="flex flex-wrap gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  aria-label={`Mise ${v} piece${v > 1 ? 's' : ''}`}
                  disabled={loading}
                  aria-pressed={bet === v}
                  className={`min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all ${
                    bet === v ? 'bg-gold text-[#0D0D1A]' : 'bg-[#2A2A3E] text-gray-300 hover:bg-[#3A3A4E]'
                  }`}
                >
                  <CasinoChip value={v} />
                </button>
              ))}
            </div>
          </div>
          <button onClick={deal} disabled={loading || bet > balance}
            className="btn-primary min-h-[44px] w-full disabled:opacity-50">
            {loading ? 'Chargement...' : 'Distribuer'}
          </button>
          <p className="text-xs text-gray-300">Quinte Flush Royale: {bet === 5 ? '800x' : '250x'} · 800x uniquement avec 5 pieces.</p>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        </div>
        </div>
      </div>
    );
  }

  const isDiscard = animPhase === 'discard';

  return (
    <div className="max-w-6xl mx-auto space-y-5" aria-busy={loading} data-deal-phase={animPhase}>
      <GameHeader title="Video Poker" eyebrow="Jacks or Better" onBack={() => navigate('/lobby')} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-4">
      <div className="casino-stage min-w-0 flex flex-col relative">
        <div className="relative z-10 flex flex-col items-center py-6 px-3 sm:px-6 flex-1">
          <p className="text-gray-400 text-sm mb-6">Mise: {gameState.bet} pièce{gameState.bet > 1 ? 's' : ''}</p>

          <p className="text-sm text-gray-300 mb-4" role="status">{loading ? 'Tirage en cours...' : gameState.phase === 'deal' ? 'Touchez les cartes a garder.' : 'Tirage termine'}</p>
          <div className="grid grid-cols-5 gap-1 sm:gap-3 mb-8 w-full max-w-lg">
            {gameState.hand.map((card, i) => {
              let animClass = '';
              if (isDiscard && !reducedMotion) {
                const shouldDiscard = !holds[i];
                animClass = shouldDiscard ? 'animate-card-discard' : '';
              } else if (animPhase === 'deal' && !reducedMotion && !holds[i]) {
                animClass = 'animate-card-deal';
              }
              const held = gameState.phase === 'deal' ? holds[i] : gameState.held[i];
              return (
                <div
                  key={i}
                  data-card-slot={i}
                  className={`min-w-0 ${animClass}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <button type="button" className="w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold" aria-pressed={held} aria-label={`Carte ${i + 1}: ${card.rank} ${card.suit}, ${held ? 'gardee' : 'non gardee'}`} disabled={loading || gameState.phase !== 'deal'} onClick={() => toggleHold(i)}>
                  <PlayingCard
                    card={card}
                    selected={held}
                    className="!w-full !h-auto aspect-[5/7]"
                  />
                  <span className={`block mt-2 py-1 text-[10px] sm:text-xs font-bold tracking-wider rounded border ${held ? 'border-gold bg-gold text-black' : 'border-white/20 text-gray-300'}`}>{held ? 'HOLD' : 'GARDER'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {gameState.phase === 'complete' && animPhase === 'idle' && (
            <div className="casino-panel p-4 text-center mb-4" role="status" aria-live="polite">
              <p className="text-xl font-bold text-gold mb-1">{gameState.handName}</p>
               <ResultSummary payout={gameState.payout} bet={gameState.bet} />
              <button onClick={newGame} disabled={loading} className="btn-primary min-h-[44px] mt-4">
                Nouvelle partie
              </button>
            </div>
          )}

          {gameState.phase === 'deal' && (
            <div className="casino-panel p-3 flex flex-wrap justify-center gap-3 mt-auto [&_button]:min-h-[44px]">
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

          {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
          {loading && <p role="status" className="text-gray-400 text-sm mt-2">{isDiscard ? 'Remplacement des cartes...' : 'Distribution en cours...'}</p>}
        </div>
      </div>

      <div className="casino-panel p-4 min-w-0">
        <h3 className="text-gold font-display text-lg mb-4 text-center">Table des Paiements</h3>
        <div className="space-y-1">
          {PAYOUT_TABLE.map((row, i) => (
            <div key={i} className={`flex justify-between text-sm px-3 py-1.5 rounded ${
               gameState.phase === 'complete' && animPhase === 'idle' && gameState.handName === row.hand ? 'bg-gold/20 border border-gold/40' : ''
            }`}>
              <span className={gameState.phase === 'complete' && animPhase === 'idle' && gameState.handName === row.hand ? 'text-gold' : 'text-gray-300'}>{row.hand}</span>
              <span className="text-gray-300 font-mono shrink-0 ml-2">{gameState.bet === 5 ? row.maxBet || row.coeff : row.coeff}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center italic border-t border-gray-800 pt-3">
          Quinte Flush Royale: 800x avec mise max (5)
        </p>
      </div>
      </div>
    </div>
  );
}
