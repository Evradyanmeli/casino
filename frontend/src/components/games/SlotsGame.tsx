import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dices, Star, Check, Trophy, XCircle, ClipboardList } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ResultSummary from './ResultSummary';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';
import { gamesApi, type SpinResult, type PaylineResult } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';

const SYMBOL_EMOJIS: Record<string, string> = {
  CHERRY: '🍒', LEMON: '🍋', STAR: '⭐', SEVEN: '7️⃣', BELL: '🔔', DIAMOND: '💎', BAR: 'BAR',
  ORANGE: '🍊', GRAPE: '🍇', WATERMELON: '🍉', STRAWBERRY: '🍓', APPLE: '🍎', BANANA: '🍌',
  CROWN: '👑', TROPHY: '🏆', MONEY: '💰', FIRE: '🔥', TARGET: '🎯', SLOT: '🎰', SCATTER: '✨',
};

const VARIANT_NAMES: Record<string, string> = {
  classic: 'Classique',
  fruit: 'Fruits',
  diamond: 'Diamant',
};

const VARIANT_CONFIGS: Record<string, { reels: number; rows: number; paylines: number; betMax: number }> = {
  classic: { reels: 3, rows: 3, paylines: 3, betMax: 100 },
  fruit: { reels: 5, rows: 3, paylines: 5, betMax: 100 },
  diamond: { reels: 5, rows: 3, paylines: 10, betMax: 500 },
};

type SpinState = 'idle' | 'spinning' | 'done';

export function SlotsGame() {
  const navigate = useNavigate();
  const [variant, setVariant] = useState('classic');
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState<string[][]>([]);
  const [spinState, setSpinState] = useState<SpinState>('idle');
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [error, setError] = useGameError();
  const { balance, syncBalance } = useBalanceStore();
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [animatingReels, setAnimatingReels] = useState<boolean[]>([]);

  const config = VARIANT_CONFIGS[variant];
  const totalBet = bet * config.paylines;

  const initReels = useCallback(() => {
    const r: string[][] = [];
    for (let i = 0; i < config.reels; i++) {
      r.push(Array(config.rows).fill(''));
    }
    setReels(r);
    setAnimatingReels(Array(config.reels).fill(false));
  }, [config.reels, config.rows]);

  useEffect(() => {
    initReels();
    setResult(null);
    setError('');
  }, [variant, initReels]);

  const handleSpin = async () => {
    if (spinState === 'spinning') return;
    if (totalBet > balance) {
      setError('Solde insuffisant');
      return;
    }

    setError('');
    setSpinState('spinning');
    setAnimatingReels(Array(config.reels).fill(true));

    const animReels: string[][] = [];
    for (let i = 0; i < config.reels; i++) {
      const col: string[] = [];
      for (let j = 0; j < config.rows; j++) {
        const syms = Object.keys(SYMBOL_EMOJIS).filter(s => {
          if (variant === 'classic') return ['CHERRY', 'LEMON', 'STAR', 'SEVEN', 'BELL', 'DIAMOND', 'BAR'].includes(s);
          if (variant === 'fruit') return ['CHERRY', 'LEMON', 'ORANGE', 'GRAPE', 'WATERMELON', 'STRAWBERRY', 'APPLE', 'BANANA'].includes(s);
          return ['DIAMOND', 'CROWN', 'STAR', 'BELL', 'SEVEN', 'TROPHY', 'MONEY', 'FIRE', 'TARGET', 'SLOT', 'SCATTER'].includes(s);
        });
        col.push(syms[Math.floor(Math.random() * syms.length)]);
      }
      animReels.push(col);
    }
    setReels(animReels);

    try {
      const spinResult = await gamesApi.slotsSpin(variant, bet);
      setResult(spinResult);

      setTimeout(() => {
        setReels(spinResult.reels);
        setAnimatingReels(Array(config.reels).fill(false));
        setSpinState('done');

        setHistory(prev => [spinResult, ...prev].slice(0, 10));
        void syncBalance().catch(() => setError('Resultat enregistre, mais solde non actualise.'));
      }, 800);
    } catch {
      setAnimatingReels(Array(config.reels).fill(false));
      setSpinState('idle');
      setError('Erreur lors du spin');
    }
  };

  const getSymbolEmoji = (id: string) => SYMBOL_EMOJIS[id] || id;

  const formatNumber = (n: number) => n.toLocaleString('fr-FR');

  const paylineDescriptions: Record<string, string[]> = {
    classic: ['Ligne 1 (haut)', 'Ligne 2 (milieu)', 'Ligne 3 (bas)'],
    fruit: ['Ligne 1 (milieu)', 'Ligne 2 (haut)', 'Ligne 3 (bas)', 'Ligne 4 (V)', 'Ligne 5 (V inversé)'],
    diamond: [
      'Ligne 1 (milieu)', 'Ligne 2 (haut)', 'Ligne 3 (bas)', 'Ligne 4 (V)', 'Ligne 5 (V inversé)',
      'Ligne 6', 'Ligne 7', 'Ligne 8', 'Ligne 9', 'Ligne 10',
    ],
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-2xl font-display text-gold"><Dices className="w-6 h-6 inline-block mr-2" /> Slots</h1>
          <div className="flex items-center gap-2 bg-[#1A1A2E] border border-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">Solde</span>
            <span className="text-gold font-bold font-display">{formatNumber(balance)}</span>
            <span className="text-xs text-gray-500">GC</span>
          </div>
        </div>

        <div className="flex gap-1 bg-[#1A1A2E] p-1 rounded-lg mb-4">
          {['classic', 'fruit', 'diamond'].map(v => (
            <button
              key={v}
              onClick={() => { setVariant(v); setResult(null); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                variant === v
                  ? 'bg-[#232340] text-gold shadow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {VARIANT_NAMES[v]}
            </button>
          ))}
        </div>

        <div className="bg-gradient-to-b from-[#2A1A0A] to-[#1A0A00] border-2 border-gold rounded-xl p-6 shadow-[0_0_30px_rgba(255,215,0,0.2)] mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="font-display text-gold text-sm tracking-widest flex items-center gap-1"><Star className="w-3 h-3" /> {VARIANT_NAMES[variant].toUpperCase()} <Star className="w-3 h-3" /></span>
            <span className="font-display text-sm text-secondary">{config.reels}×{config.rows}</span>
          </div>

          <div className="bg-black border-2 border-gold rounded-lg p-2 mb-4 shadow-inner">
            <div className="flex gap-1.5 justify-center">
              {reels.map((col, ci) => (
                <div key={ci} className="flex-1 max-w-[100px]">
                  {col.map((sym, ri) => (
                    <div
                      key={ri}
                      ref={el => { reelRefs.current[ci * config.rows + ri] = el; }}
                      className={`h-[100px] flex items-center justify-center bg-[#0a0a0a] border border-gray-800 rounded m-0.5 text-4xl
                        ${animatingReels[ci] ? 'animate-pulse blur-sm' : ''}
                        ${spinState === 'done' ? 'animate-bounce-once' : ''}
                      `}
                    >
                      {sym ? getSymbolEmoji(sym) : '?'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/40 border border-gray-700 rounded-lg p-3 mb-3">
            <div className="flex justify-around">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Mise/ligne</div>
                <div className="text-gold font-display text-sm">{bet}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Lignes</div>
                <div className="text-gold font-display text-sm">{config.paylines}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total</div>
                <div className="text-gold font-display text-sm">{totalBet}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Gain</div>
                <div className={`font-display text-sm ${result && result.totalWin > 0 ? 'text-success' : 'text-gray-400'}`}>
                  {result ? formatNumber(result.totalWin) : '0'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Pièce:</span>
              {[5, 10, 25, 50, 100].filter(v => v <= config.betMax).map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    bet === v
                      ? 'border-gold text-gold bg-gold/10'
                      : 'border-gray-700 text-gray-400 hover:border-gold hover:text-gold'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSpin}
            disabled={spinState === 'spinning'}
            className="w-full py-3 rounded-lg font-bold text-lg tracking-wider transition-all
              bg-gradient-to-r from-gold to-yellow-600 text-black
              hover:shadow-[0_0_20px_rgba(255,215,0,0.4)]
              disabled:opacity-50 disabled:cursor-not-allowed
              animate-pulse-glow"
          >
            {spinState === 'spinning' ? <span><Dices className="w-4 h-4 inline-block mr-1" /> SPIN...</span> : <span><Dices className="w-4 h-4 inline-block mr-1" /> SPIN</span>}
          </button>

          {error && (
            <div className="mt-3 text-center text-error text-sm">{error}</div>
          )}
        </div>

        {result && result.paylines.length > 0 && (
          <div className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-display text-gold mb-3 flex items-center gap-1"><Check className="w-4 h-4" /> Lignes gagnantes</h3>
            <div className="space-y-1.5">
              {result.paylines.map((pl, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-[#232340] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getSymbolEmoji(pl.symbol)}</span>
                    <span className="text-gray-300">
                      {paylineDescriptions[variant]?.[pl.line - 1] || `Ligne ${pl.line}`}
                    </span>
                  </div>
                  <span className="text-success font-bold">+{formatNumber(pl.payout)}</span>
                </div>
              ))}
            </div>
            {(result.isFreeSpin || (result.freeSpinsRemaining ?? 0) > 0) && (
              <div className="mt-3 text-center text-accent font-bold text-sm">
                <Star className="w-4 h-4 inline-block mr-1" /> Tours gratuits déclenchés ! ({result.freeSpinsRemaining ?? 10} restants)
              </div>
            )}
          </div>
        )}

        {result && result.totalWin > 0 && (
          <div className="text-center text-success font-display text-xl mb-4 animate-bounce-once">
            <Trophy className="w-6 h-6 inline-block mr-2" /> Gagné ! +{formatNumber(result.totalWin)} GC
          </div>
        )}

        {result && result.totalWin === 0 && result.paylines.length === 0 && spinState === 'done' && (
          <div className="text-center text-gray-500 text-sm mb-4"><XCircle className="w-4 h-4 inline-block mr-1" /> Perdu</div>
        )}

        {history.length > 0 && (
          <div className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-display text-gold mb-3"><ClipboardList className="w-4 h-4 inline-block mr-1" /> Derniers spins</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.map((h, i) => {
                const won = h.totalWin > 0;
                return (
                  <div
                    key={i}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center text-xs font-bold ${
                      won ? 'bg-success/20 border border-success/40' : 'bg-error/10 border border-error/20'
                    }`}
                  >
                    <span className={won ? 'text-success' : 'text-error'}>
                      {won ? '+' : ''}{h.totalWin}
                    </span>
                    <span className="text-gray-500 text-[10px] mt-0.5">GC</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!result && history.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            Choisissez votre mise et lancez le spin !
          </div>
        )}
      </div>
    </Layout>
  );
}
