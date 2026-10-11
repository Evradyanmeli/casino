import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBalanceStore } from '@/store/balanceStore';
import { gamesApi, type BlackjackState } from '@/services/games';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import GameHeader from './GameHeader';
import { PlayingCard, CasinoChip, useReducedMotion } from './GameVisuals';

function HandValue({ value, isBlackjack, isBusted }: { value: number; isBlackjack: boolean; isBusted: boolean }) {
  if (isBlackjack) return <span className="text-gold font-bold">Blackjack!</span>;
  if (isBusted) return <span className="text-red-500 font-bold">{'>'} 21</span>;
  return <span className="text-white font-bold">{value}</span>;
}

export default function BlackjackGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const [gameState, setGameState] = useState<BlackjackState | null>(null);
  const [bet, setBet] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const reducedMotion = useReducedMotion();
  const busy = useRef(true);
  const mounted = useRef(false);
  const revealTimer = useRef<{ id: ReturnType<typeof setTimeout>; resolve: () => void } | null>(null);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    busy.current = true;
    setLoading(true);
    gamesApi.blackjackState().then(state => { if (active) setGameState(state); })
      .catch(err => { if (active) setError(err.response?.data?.error || 'Session indisponible'); })
      .finally(() => { if (active) { busy.current = false; setLoading(false); } });
    return () => {
      active = false;
      mounted.current = false;
      if (revealTimer.current) { clearTimeout(revealTimer.current.id); revealTimer.current.resolve(); revealTimer.current = null; }
    };
  }, []);

  const handleAction = useCallback(async (action: () => Promise<BlackjackState>) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await action();
      if (!mounted.current) return;
      setGameState(result);
      if (!reducedMotion) {
        const lastDelay = Math.max(result.dealerCards.length - 1,
          ...result.hands.map(hand => result.dealerCards.length + hand.cards.length - 1)) * 100;
        await new Promise<void>(resolve => { revealTimer.current = {
          id: setTimeout(() => { revealTimer.current = null; resolve(); }, lastDelay + 400), resolve,
        }; });
      }
    } catch (err: any) {
      if (!mounted.current) return;
      const msg = err.response?.data?.error || err.message || '';
      if (msg === 'Session introuvable') {
        setGameState(null);
        setError('Session introuvable. La mise precedente ne doit pas etre consideree comme remboursee.');
      } else {
        setError(msg || 'Une erreur est survenue');
      }
    } finally {
      if (mounted.current) { busy.current = false; setLoading(false); }
    }
  }, [reducedMotion]);

  const startRound = () => handleAction(() => gamesApi.blackjackStart(bet));
  const activeIndex = gameState ? gameState.activeHandIndex : 0;
  const hit = () => gameState && handleAction(() => gamesApi.blackjackHit(gameState.sessionId, activeIndex));
  const stand = () => gameState && handleAction(() => gamesApi.blackjackStand(gameState.sessionId, activeIndex));
  const doubleDown = () => gameState && handleAction(() => gamesApi.blackjackDouble(gameState.sessionId, activeIndex));
  const split = () => gameState && handleAction(() => gamesApi.blackjackSplit(gameState.sessionId, activeIndex));
  const takeInsurance = () => gameState && handleAction(() => gamesApi.blackjackInsurance(gameState.sessionId, Math.floor(gameState.hands[0].bet / 2)));

  const activeHand = gameState?.hands[activeIndex];
  const canSplit = gameState?.state === 'playing' && activeHand?.cards.length === 2 &&
    activeHand.cards[0].rank === activeHand.cards[1].rank;
  const canDouble = gameState?.state === 'playing' && activeHand?.cards.length === 2;
  const showInsurance = gameState?.state === 'playing' && gameState.insuranceAvailable;
  const isComplete = gameState?.state === 'complete';

  if (!gameState) {
    return (
      <div className="max-w-5xl mx-auto space-y-5" aria-busy={loading}>
        <GameHeader title="Blackjack" eyebrow="Table de cartes" description="Approchez-vous de 21 sans le depasser." onBack={() => navigate('/lobby')} />
        <div className="casino-stage p-5 sm:p-8 flex flex-col items-center gap-6">
          <div className="flex justify-center gap-3" aria-hidden="true">
            <PlayingCard hidden /><PlayingCard hidden />
          </div>
        <div className="casino-panel p-5 sm:p-6 max-w-md w-full text-center space-y-6">
          <p className="text-gray-400">Solde: {balance} crédits</p>
          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Mise</label>
            <div className="flex flex-wrap gap-2 justify-center">
              {[10, 25, 50, 100].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  aria-label={`Mise ${v} credits`}
                  aria-pressed={bet === v}
                  disabled={loading}
                  className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold transition-all ${
                    bet === v ? 'bg-gold text-[#0D0D1A]' : 'bg-[#2A2A3E] text-gray-300 hover:bg-[#3A3A4E]'
                  }`}
                >
                  <CasinoChip value={v} />
                </button>
              ))}
            </div>
          </div>
          <button onClick={startRound} disabled={loading || bet > balance}
            className="btn-primary min-h-[44px] w-full disabled:opacity-50">
            {loading ? 'Chargement...' : 'Distribuer'}
          </button>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5" aria-busy={loading}>
      <GameHeader title="Blackjack" eyebrow="Table de cartes" onBack={() => navigate('/lobby')}>
        <span className="text-sm text-gray-300">Mise totale: {gameState.hands.reduce((total, hand) => total + hand.bet, 0) + gameState.insuranceBet} credits</span>
      </GameHeader>
      <div className="casino-stage flex flex-col relative">
        <div className="relative z-10 flex flex-col items-center py-6 px-3 sm:px-6">

          {showInsurance && !isComplete && (
            <div className="bg-yellow-900/40 border border-yellow-600/30 rounded-lg px-4 py-2 mb-4 text-center">
              <p className="text-yellow-300 text-sm mb-2">Assurance disponible</p>
              <button onClick={takeInsurance} disabled={loading}
                className="min-h-[44px] bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
                Assurance {Math.floor(gameState.hands[0].bet / 2)}
              </button>
            </div>
          )}

          <div className="mb-8 text-center w-full">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Croupier</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: gameState.dealerHidden ? Math.max(2, gameState.dealerCards.length) : gameState.dealerCards.length }, (_, i) => (
                <PlayingCard key={i} card={gameState.dealerCards[i]} hidden={gameState.dealerHidden && (i === 1 || !gameState.dealerCards[i])} delay={i * 100} />
              ))}
            </div>
            <p className="mt-2">
              <HandValue value={gameState.dealerValue} isBlackjack={false} isBusted={false} />
            </p>
          </div>

          <p className="text-gold/70 text-[10px] tracking-[0.2em] uppercase text-center mb-6">Blackjack paie 3 pour 2</p>
          <div className="w-full grid gap-4 sm:grid-cols-2">
            {gameState.hands.map((hand, hi) => (
              <div key={hi} className={`mb-6 text-center rounded-xl p-3 min-w-0 ${gameState.hands.length === 1 ? 'sm:col-span-2' : ''} ${hi === activeIndex && !isComplete ? 'ring-1 ring-gold bg-black/10' : ''}`}>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Main {hi + 1} · Mise {hand.bet}{hi === activeIndex && !isComplete ? ' · A vous' : ''}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {hand.cards.map((card, i) => (
                    <PlayingCard key={i} card={card} delay={(gameState.dealerCards.length + i) * 100} />
                  ))}
                </div>
                <p className="mt-2">
                  <HandValue value={hand.value} isBlackjack={hand.isBlackjack} isBusted={hand.isBusted} />
                </p>
              </div>
            ))}
          </div>

          {isComplete && !loading && (
            <div className="casino-panel p-4 text-center mb-4" role="status" aria-live="polite">
              <ResultSummary payout={gameState.hands.reduce((total, hand) => total + hand.payout, 0) + gameState.insurancePayout} bet={gameState.hands.reduce((total, hand) => total + hand.bet, 0) + gameState.insuranceBet} />
              {gameState.insuranceBet > 0 && <p className="text-sm text-gray-300 mt-2">Assurance incluse: mise {gameState.insuranceBet}, retour {gameState.insurancePayout}</p>}
              <button onClick={() => setGameState(null)} className="btn-primary min-h-[44px] mt-4">
                Nouvelle partie
              </button>
            </div>
          )}

          {!isComplete && (
            <div className="casino-panel p-3 flex gap-2 sm:gap-3 flex-wrap justify-center mt-auto mb-4 [&_button]:min-h-[44px]">
              <button onClick={hit} disabled={loading || gameState.state !== 'playing'}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                Carte
              </button>
              <button onClick={stand} disabled={loading || gameState.state !== 'playing'}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                Rester
              </button>
              <button onClick={doubleDown} disabled={loading || !canDouble}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                Doubler
              </button>
              <button onClick={split} disabled={loading || !canSplit}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                Split
              </button>
            </div>
          )}

          {error && <p role="alert" className="text-red-400 text-sm mt-2 text-center">{error}</p>}
          {loading && <p role="status" className="text-gray-400 text-sm mt-2 text-center">Chargement...</p>}
        </div>
      </div>
    </div>
  );
}
