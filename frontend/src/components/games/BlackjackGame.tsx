import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBalanceStore } from '@/store/balanceStore';
import { gamesApi, type BlackjackState } from '@/services/games';
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

function CardView({ card, hidden, delay = 0 }: { card: { suit: string; rank: string }; hidden?: boolean; delay?: number }) {
  if (hidden) {
    return (
      <div
        className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 shadow-md flex items-center justify-center animate-card-deal"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="text-white text-xl font-display">?</div>
      </div>
    );
  }
  const color = SUIT_COLORS[card.suit] || 'text-gray-900';
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;
  return (
    <div
      className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white border-2 border-gray-300 shadow-md flex flex-col items-center justify-between p-1.5 select-none animate-card-deal"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`self-start text-xs sm:text-sm font-bold leading-none ${color}`}>
        {card.rank}
      </div>
      <div className={`text-lg sm:text-2xl ${color}`}>
        {symbol}
      </div>
      <div className={`self-end text-xs sm:text-sm font-bold leading-none rotate-180 ${color}`}>
        {card.rank}
      </div>
    </div>
  );
}

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
  useEffect(() => {
    let active = true;
    setLoading(true);
    gamesApi.blackjackState().then(state => { if (active) setGameState(state); })
      .catch(err => { if (active) setError(err.response?.data?.error || 'Session indisponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleAction = useCallback(async (action: () => Promise<BlackjackState>) => {
    setLoading(true);
    setError('');
    try {
      const result = await action();
      setGameState(result);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '';
      if (msg === 'Session introuvable') {
        setGameState(null);
        setError('Session introuvable. La mise precedente ne doit pas etre consideree comme remboursee.');
      } else {
        setError(msg || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center p-4">
        <div className="bg-[#1A1A2E] rounded-2xl p-8 border border-gray-800 max-w-sm w-full text-center space-y-6">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm block mb-2">
            ← Retour
          </button>
          <h2 className="text-2xl font-display text-gold">Blackjack</h2>
          <p className="text-gray-400">Solde: {balance} crédits</p>
          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Mise</label>
            <div className="flex gap-2 justify-center">
              {[10, 25, 50, 100].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    bet === v ? 'bg-gold text-[#0D0D1A]' : 'bg-[#2A2A3E] text-gray-300 hover:bg-[#3A3A4E]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startRound} disabled={loading || bet > balance}
            className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Chargement...' : 'Distribuer'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex flex-col">
      <div className="flex-1 bg-gradient-to-b from-green-900 via-green-800 to-green-900 m-4 sm:m-6 rounded-2xl shadow-2xl border border-green-700/30 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,215,0,0.3) 0%, transparent 50%)' }} />

        <div className="relative z-10 flex flex-col items-center py-6 px-4 flex-1">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm self-start mb-2">
            ← Retour
          </button>
          <h2 className="text-2xl font-display text-gold mb-6">Blackjack</h2>

          {showInsurance && !isComplete && (
            <div className="bg-yellow-900/40 border border-yellow-600/30 rounded-lg px-4 py-2 mb-4 text-center">
              <p className="text-yellow-300 text-sm mb-2">Assurance disponible</p>
              <button onClick={takeInsurance} disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
                Assurance {Math.floor(gameState.hands[0].bet / 2)}
              </button>
            </div>
          )}

          <div className="mb-8 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Croupier</p>
            <div className="flex gap-2 justify-center">
              {gameState.dealerCards.map((card, i) => (
                <CardView key={i} card={card} hidden={gameState.dealerHidden && i === 1} delay={i * 100} />
              ))}
            </div>
            <p className="mt-2">
              <HandValue value={gameState.dealerValue} isBlackjack={false} isBusted={false} />
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {gameState.hands.map((hand, hi) => (
              <div key={hi} className={`mb-6 text-center ${hi === activeIndex && !isComplete ? 'ring-2 ring-gold rounded-lg p-2' : ''}`}>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Main {hi + 1} ({hand.bet})
                </p>
                <div className="flex gap-2 justify-center">
                  {hand.cards.map((card, i) => (
                    <CardView key={i} card={card} delay={(gameState.dealerCards.length + i) * 100} />
                  ))}
                </div>
                <p className="mt-2">
                  <HandValue value={hand.value} isBlackjack={hand.isBlackjack} isBusted={hand.isBusted} />
                </p>
              </div>
            ))}
          </div>

          {isComplete && (
            <div className="text-center mb-4">
              {gameState.hands.map((hand, i) => (
                <ResultSummary key={i} payout={hand.payout} bet={hand.bet} />
              ))}
              <button onClick={() => setGameState(null)} className="btn-primary mt-4">
                Nouvelle partie
              </button>
            </div>
          )}

          {!isComplete && (
            <div className="flex gap-2 sm:gap-3 flex-wrap justify-center mt-auto pb-4">
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

          {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
          {loading && <p className="text-gray-400 text-sm mt-2 text-center">Chargement...</p>}
        </div>
      </div>
    </div>
  );
}
