import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FerrisWheel, Trophy, XCircle, Check } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import { gamesApi, type RouletteResult } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

const CHIP_VALUES = [1, 5, 25, 100, 500];

const OUTSIDE_BETS = [
  { label: 'Rouge', type: 'red', positions: [], color: 'border-l-4 border-red-500' },
  { label: 'Noir', type: 'black', positions: [], color: 'border-l-4 border-white' },
  { label: 'Pair', type: 'even', positions: [], color: 'border-l-4 border-accent' },
  { label: 'Impair', type: 'odd', positions: [], color: 'border-l-4 border-yellow-500' },
  { label: '1-18', type: 'low', positions: [], color: 'border-l-4 border-secondary' },
  { label: '19-36', type: 'high', positions: [], color: 'border-l-4 border-secondary' },
  { label: '1ère 12', type: 'dozen', positions: [0], color: 'border-l-4 border-success' },
  { label: '2ème 12', type: 'dozen', positions: [1], color: 'border-l-4 border-success' },
  { label: '3ème 12', type: 'dozen', positions: [2], color: 'border-l-4 border-success' },
];

function numColor(n: number): string {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

const GRID_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export function RouletteGame() {
  const navigate = useNavigate();
  const [bets, setBets] = useState<{ type: string; positions: number[]; amount: number }[]>([]);
  const [chipValue, setChipValue] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [lastResults, setLastResults] = useState<number[]>([]);
  const [error, setError] = useGameError();
  const { balance } = useBalanceStore();
  const wheelRef = useRef<HTMLDivElement>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);

  const addBet = useCallback((type: string, positions: number[]) => {
    if (spinning) return;
    const existing = bets.find(
      b => b.type === type && JSON.stringify(b.positions) === JSON.stringify(positions)
    );
    if (existing) {
      setBets(prev => prev.map(b =>
        b === existing ? { ...b, amount: b.amount + chipValue } : b
      ));
    } else {
      setBets(prev => [...prev, { type, positions, amount: chipValue }]);
    }
  }, [bets, chipValue, spinning]);

  const clearBets = () => {
    if (!spinning) setBets([]);
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (bets.length === 0) {
      setError('Placez au moins une mise');
      return;
    }
    if (totalBet > balance) {
      setError('Solde insuffisant');
      return;
    }

    setError('');
    setSpinning(true);

    try {
      const spinResult = await gamesApi.rouletteSpin(bets);

      const extraSpins = 3 + Math.floor(Math.random() * 3);
      const slotAngle = 360 / 37;
      const wheelIndex = WHEEL_ORDER.indexOf(spinResult.number);
      const targetSlotAngle = wheelIndex * slotAngle;
      setWheelRotation(prev => prev + extraSpins * 360 + ((360 - targetSlotAngle - prev % 360 + 360) % 360));

      timeoutRef.current = setTimeout(() => {
        setResult(spinResult);
        setBets([]);
        setLastResults(prev => [spinResult.number, ...prev].slice(0, 10));
        setSpinning(false);
      }, 3000);
    } catch (err: any) {
      setSpinning(false);
      setError(err.response?.data?.error || err.message || 'Erreur lors du lancer');
    }
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const formatNumber = (n: number) => n.toLocaleString('fr-FR');

  const ChipIcon = ({ value, selected }: { value: number; selected: boolean }) => {
    const colors: Record<number, string> = {
      1: 'from-blue-500 to-blue-700',
      5: 'from-green-500 to-green-700',
      25: 'from-secondary to-pink-700',
      100: 'from-purple-500 to-purple-700',
      500: 'from-gold to-yellow-700',
    };
    return (
      <button
        onClick={() => setChipValue(value)}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${colors[value]} 
          flex items-center justify-center text-[10px] sm:text-xs font-bold text-white
          border-2 ${selected ? 'border-white shadow-lg shadow-gold/30 scale-110' : 'border-white/30'}
          transition-all hover:scale-110`}
      >
        {value}
      </button>
    );
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-2xl font-display text-gold"><FerrisWheel className="w-6 h-6 inline-block mr-2" /> Roulette</h1>
          <div className="flex items-center gap-2 bg-[#1A1A2E] border border-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">Solde</span>
            <span className="text-gold font-bold font-display">{formatNumber(balance)}</span>
            <span className="text-xs text-gray-500">GC</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-[280px] flex-shrink-0">
            <div className="relative w-[260px] h-[260px] mx-auto">
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full transition-transform duration-[4s] ease-out"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  background: `conic-gradient(
                    #FF1744 0deg, #333 9.73deg, #FF1744 19.46deg, #333 29.19deg,
                    #FF1744 38.92deg, #333 48.65deg, #FF1744 58.38deg, #333 68.11deg,
                    #FF1744 77.84deg, #333 87.57deg, #FF1744 97.3deg, #333 107.03deg,
                    #FF1744 116.76deg, #333 126.49deg, #FF1744 136.22deg, #333 145.95deg,
                    #FF1744 155.68deg, #333 165.41deg, #FF1744 175.14deg, #333 184.87deg,
                    #FF1744 194.6deg, #333 204.33deg, #FF1744 214.06deg, #333 223.79deg,
                    #FF1744 233.52deg, #333 243.25deg, #FF1744 252.98deg, #333 262.71deg,
                    #FF1744 272.44deg, #333 282.17deg, #FF1744 291.9deg, #333 301.63deg,
                    #FF1744 311.36deg, #333 321.09deg, #FF1744 330.82deg, #00C853 340.55deg,
                    #FF1744 350.28deg, #333 360deg
                  )`,
                  border: '4px solid #FFD700',
                  boxShadow: '0 0 30px rgba(255,215,0,0.3)',
                }}
              >
                <div className="absolute inset-0">
                  {WHEEL_ORDER.map((n, i) => {
                    const angle = i * (360 / 37);
                    return (
                      <div
                        key={i}
                        className="absolute text-[9px] font-bold text-white"
                        style={{
                          top: '6px',
                          left: '50%',
                          transformOrigin: '50% 124px',
                          transform: `rotate(${angle}deg)`,
                          width: '16px',
                          textAlign: 'center',
                          marginLeft: '-8px',
                          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                        }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-1/2 left-1/2 w-[70px] h-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#1A1A2E] to-[#0D0D1A] border-2 border-gold z-10 flex items-center justify-center font-display text-gold text-sm shadow-inner">
                  {spinning ? '...' : (result ? result.number : '-')}
                </div>
              </div>
              <div className={`absolute w-2.5 h-2.5 rounded-full bg-white shadow-lg z-20 transition-opacity duration-300 ${
                spinning ? 'opacity-100 animate-ball-orbit' : 'opacity-0'
              }`} />
            </div>

            <div className="flex items-center justify-center gap-2 mt-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg font-display border-2 border-gold"
                style={{
                  background: result
                    ? (result.color === 'red' ? '#FF1744' : result.color === 'green' ? '#00C853' : '#333')
                    : '#333',
                  color: '#fff',
                }}
              >
                {result ? result.number : '-'}
              </div>
              <span className="text-xs text-gray-400">Dernier résultat</span>
            </div>

            {lastResults.length > 0 && (
              <div className="flex gap-1 justify-center mt-3">
                {lastResults.map((n, i) => {
                  const c = n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';
                  return (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                      style={{
                        background: c === 'red' ? '#FF1744' : c === 'green' ? '#00C853' : '#333',
                      }}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-[repeat(12,1fr)] gap-[2px] bg-[#0D5C0D] p-2 rounded-lg border-2 border-green-800 shadow-inner mb-3">
              <button
                onClick={() => addBet('straight', [0])}
                className="col-span-12 py-2 rounded text-center text-sm font-bold text-success bg-green-900/40 hover:bg-green-800/60 transition-all border border-transparent hover:border-gold"
              >
                0
              </button>
              {GRID_ROWS.map((row, ri) => row.map(n => {
                const c = numColor(n);
                return (
                  <button
                    key={n}
                    onClick={() => addBet('straight', [n])}
                    className={`py-2 rounded text-center text-[10px] sm:text-xs font-bold transition-all border border-transparent hover:border-gold hover:scale-110
                      ${c === 'red' ? 'bg-red-900/40 text-red-400' : c === 'black' ? 'bg-white/5 text-white' : 'bg-green-900/40 text-green-400'}`}
                  >
                    {n}
                  </button>
                );
              }))}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {OUTSIDE_BETS.map(ob => (
                <button
                  key={ob.label}
                  onClick={() => addBet(ob.type, ob.positions)}
                  className={`flex-1 min-w-[60px] py-2 px-1 rounded text-[10px] sm:text-xs font-semibold bg-[#1A1A2E] border border-gray-700 hover:border-gold hover:text-gold transition-all ${ob.color}`}
                >
                  {ob.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">Jeton:</span>
              {CHIP_VALUES.map(v => (
                <ChipIcon key={v} value={v} selected={chipValue === v} />
              ))}
            </div>

            {bets.length > 0 && (
              <div className="bg-[#1A1A2E] border border-gray-800 rounded-lg p-3 mb-3 max-h-[150px] overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">Mises ({bets.length})</span>
                  <button onClick={clearBets} className="text-xs text-gray-500 hover:text-error transition-colors">Tout effacer</button>
                </div>
                <div className="space-y-1">
                  {bets.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-300">{b.type} {b.positions.length > 0 ? `(${b.positions.join(',')})` : ''}</span>
                      <span className="text-gold">{b.amount} GC</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-800">
                  <span className="text-gray-400">Total</span>
                  <span className="text-gold font-bold">{totalBet} GC</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSpin}
              disabled={spinning || bets.length === 0}
              className="w-full py-3 rounded-lg font-bold text-lg tracking-wider transition-all
                bg-gradient-to-r from-gold to-yellow-600 text-black
                hover:shadow-[0_0_20px_rgba(255,215,0,0.4)]
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {spinning ? <span><FerrisWheel className="w-4 h-4 inline-block mr-1" /> LANCEMENT...</span> : <span><FerrisWheel className="w-4 h-4 inline-block mr-1" /> LANCER</span>}
            </button>

            {error && (
              <div className="mt-2 text-center text-error text-sm">{error}</div>
            )}

            {result && !spinning && (
              <>
                <div className="mt-3 text-center"><p className="text-gray-300">Numero {result.number}</p><ResultSummary payout={result.totalWin} bet={result.bets.reduce((sum, wager) => sum + wager.amount, 0)} /></div>
                {result.bets.filter(b => b.won).length > 0 && (
                  <div className="mt-2 bg-[#1A1A2E] border border-gray-800 rounded-lg p-3">
                    <h3 className="text-xs text-gold mb-2"><Check className="w-4 h-4 inline-block mr-1" /> Paris gagnants</h3>
                    <div className="space-y-1">
                      {result.bets.filter(b => b.won).map((b, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-300">{b.type}</span>
                          <span className="text-gray-300">Retour brut : {b.payout} GC</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!result && bets.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-4">
                Cliquez sur un numéro ou un pari extérieur pour placer votre mise
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ballOrbit {
          0% { transform: rotate(0deg) translateX(115px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(115px) rotate(-360deg); }
        }
        .animate-ball-orbit {
          animation: ballOrbit 0.5s linear infinite;
        }
        @keyframes bounceOnce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-once {
          animation: bounceOnce 0.5s ease;
        }
      `}</style>
    </Layout>
  );
}
