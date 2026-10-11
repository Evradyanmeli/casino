import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FerrisWheel } from 'lucide-react';
import GameHeader from './GameHeader';
import { CasinoChip, useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import { gamesApi, type RouletteResult } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const CHIP_VALUES = [1, 5, 25, 100, 500];
const CHIP_COLORS = ['#427799', '#387858', '#a84c66', '#7561a8', '#bb9145'];
const OUTSIDE_BETS = [
  { label: 'Rouge', type: 'red', positions: [] },
  { label: 'Noir', type: 'black', positions: [] },
  { label: 'Pair', type: 'even', positions: [] },
  { label: 'Impair', type: 'odd', positions: [] },
  { label: '1-18', type: 'low', positions: [] },
  { label: '19-36', type: 'high', positions: [] },
  { label: '1ere 12', type: 'dozen', positions: [0] },
  { label: '2eme 12', type: 'dozen', positions: [1] },
  { label: '3eme 12', type: 'dozen', positions: [2] },
];

function pocketColor(number: number): string {
  return number === 0 ? '#236c50' : RED_NUMBERS.includes(number) ? '#a02e39' : '#15202c';
}

function polar(radius: number, angle: number): string {
  const radians = (angle - 90) * Math.PI / 180;
  return `${200 + radius * Math.cos(radians)},${200 + radius * Math.sin(radians)}`;
}

export function RouletteGame() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 3600;
  const [bets, setBets] = useState<{ type: string; positions: number[]; amount: number }[]>([]);
  const [chipValue, setChipValue] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [lastResults, setLastResults] = useState<number[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [error, setError] = useGameError();
  const { balance } = useBalanceStore();
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const totalBet = bets.reduce((sum, wager) => sum + wager.amount, 0);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; if (timeout.current) clearTimeout(timeout.current); };
  }, []);

  const addBet = (type: string, positions: number[]) => {
    if (busy.current) return;
    setBets(previous => {
      const index = previous.findIndex(wager => wager.type === type && wager.positions.join(',') === positions.join(','));
      return index === -1 ? [...previous, { type, positions, amount: chipValue }]
        : previous.map((wager, i) => i === index ? { ...wager, amount: wager.amount + chipValue } : wager);
    });
  };

  const handleSpin = async () => {
    if (busy.current) return;
    if (bets.length === 0) { setError('Placez au moins une mise'); return; }
    if (totalBet > balance) { setError('Solde insuffisant'); return; }
    busy.current = true;
    setError('');
    setResult(null);
    setSpinning(true);
    try {
      const outcome = await gamesApi.rouletteSpin(bets);
      if (!active.current) return;
      const index = WHEEL_ORDER.indexOf(outcome.number);
      if (index < 0) throw new Error('Numero de roulette invalide');
      // Pocket zero is centered at twelve o'clock; both the pointer and settled ball stay there.
      const target = (360 - index * 360 / WHEEL_ORDER.length) % 360;
      setWheelRotation(previous => previous + 5 * 360 + (target - previous % 360 + 360) % 360);
      setBallRotation(previous => previous - 6 * 360);
      const complete = () => {
        setResult(outcome);
        setBets([]);
        setLastResults(previous => [outcome.number, ...previous].slice(0, 10));
        setSpinning(false);
        busy.current = false;
      };
      if (duration === 0) complete();
      else timeout.current = setTimeout(complete, duration);
    } catch (err: any) {
      if (!active.current) return;
      setSpinning(false);
      busy.current = false;
      setError(err.response?.data?.error || err.message || 'Erreur lors du lancer');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5" aria-busy={spinning}>
      <GameHeader title="Roulette" eyebrow="La Table Europeenne" description="Un seul zero. Choisissez vos numeros, placez vos jetons." onBack={() => navigate('/lobby')} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.4fr)]">
        <section className="casino-stage rounded-2xl border border-gold/20 bg-[#101c2d] p-4 sm:p-6" aria-label="Roue de roulette">
          <div className="casino-wheel relative mx-auto aspect-square w-full max-w-[400px] rounded-full border-[8px] border-[#543526] p-1 shadow-[0_16px_40px_#0008,inset_0_1px_3px_#f8d29a80]"
            style={{ background: 'radial-gradient(circle, #322620 62%, #9f6c3d 66%, #38231c 71%, #7d5134 88%, #251913 100%)' }}>
            <div className="absolute inset-1 rounded-full border-2 border-[#c4a365] shadow-[inset_0_0_16px_#000]" />
            <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label={result ? `Numero ${result.number} sous le repere` : '37 cases de la roulette europeenne'}
              style={{ transform: `rotate(${wheelRotation}deg)`, transition: `transform ${duration}ms cubic-bezier(0.12,0.65,0.15,1)` }}>
              <circle cx="200" cy="200" r="188" fill="#bba16d" />
              {WHEEL_ORDER.map((number, index) => {
                const center = index * 360 / WHEEL_ORDER.length;
                const start = center - 180 / WHEEL_ORDER.length;
                const end = center + 180 / WHEEL_ORDER.length;
                return <g key={number} data-pocket={number}>
                  <path d={`M ${polar(180, start)} A 180 180 0 0 1 ${polar(180, end)} L ${polar(126, end)} A 126 126 0 0 0 ${polar(126, start)} Z`}
                    fill={pocketColor(number)} stroke="#c4a365" strokeWidth="0.8" />
                  <text x="200" y="43" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${center} 200 200)`} fill="#fff4de" fontSize="13" fontWeight="700">{number}</text>
                  <path d={`M ${polar(141, start)} L ${polar(178, start)}`} stroke="#fff3cb" strokeWidth="1.2" opacity="0.45" />
                </g>;
              })}
              <circle cx="200" cy="200" r="122" fill="#3c2a21" stroke="#b99b61" strokeWidth="4" />
              <circle cx="200" cy="200" r="110" fill="#142330" stroke="#85653d" strokeWidth="2" />
              {[0, 90, 180, 270].map(angle => <path key={angle} d="M 200 98 L 207 170 L 193 170 Z" transform={`rotate(${angle} 200 200)`} fill="#c5b58e" />)}
              <circle cx="200" cy="200" r="35" fill="#bfa677" stroke="#e6d7b2" strokeWidth="3" />
              <circle cx="200" cy="200" r="18" fill="#344353" stroke="#d8c9a5" strokeWidth="2" />
            </svg>
            <div className="pointer-events-none absolute inset-1" aria-hidden="true"
              style={{ transform: `rotate(${ballRotation}deg)`, transition: `transform ${duration}ms cubic-bezier(0.12,0.65,0.15,1)` }}>
              <div className="absolute left-1/2 top-[10%] h-[3.5%] w-[3.5%] -translate-x-1/2 rounded-full border border-[#e5ddc9] shadow-[1px_3px_5px_#000a]"
                style={{ background: 'radial-gradient(circle at 30% 25%, #fff, #f5ead4 45%, #938778)' }} />
            </div>
            <div aria-hidden="true" className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[18px] border-x-transparent border-t-[#f0d18a] drop-shadow-lg" />
          </div>
          <div className="mt-5 min-h-12 text-center" aria-live="polite" aria-atomic="true">
            {spinning ? <p className="text-sm text-gold">La bille cherche sa case...</p> : result ? <p className="text-sm text-slate-300">Numero <span className="ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 font-display text-lg text-white" style={{ background: pocketColor(result.number) }}>{result.number}</span></p> : <p className="text-sm text-slate-400">Faites vos jeux</p>}
          </div>
          {lastResults.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Derniers numeros">
            {lastResults.map((number, index) => <span key={index} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-xs font-semibold text-white" style={{ background: pocketColor(number) }}>{number}</span>)}
          </div>}
        </section>

        <section className="casino-panel min-w-0 space-y-4 rounded-2xl border border-white/10 bg-[#101c30] p-3 sm:p-5" aria-label="Table des mises">
          <div className="rounded-xl border-[3px] border-[#795438] p-2 shadow-[inset_0_2px_20px_#0006] sm:p-3"
            style={{ background: 'radial-gradient(ellipse at 45% 0%, #246852, #164536 65%, #0c3029)' }}>
            <div className="grid grid-cols-4 gap-1 min-[480px]:grid-cols-6 sm:grid-cols-12">
              {[0, ...Array.from({ length: 36 }, (_, index) => index + 1)].map(number => {
                const amount = bets.filter(wager => wager.type === 'straight' && wager.positions[0] === number).reduce((sum, wager) => sum + wager.amount, 0);
                return <button key={number} disabled={spinning} onClick={() => addBet('straight', [number])} aria-label={`Miser ${chipValue} GC sur ${number}${amount ? `, mise actuelle ${amount} GC` : ''}`}
                  className={`relative min-h-11 rounded border border-[#d8c9a5]/35 text-sm font-semibold text-white transition-colors hover:border-gold disabled:cursor-not-allowed ${number === 0 ? 'col-span-4 min-[480px]:col-span-6 sm:col-span-12' : ''} ${amount ? 'ring-1 ring-gold' : ''}`}
                  style={{ background: pocketColor(number) }}>
                  {number}
                  {amount > 0 && <span className="absolute bottom-0.5 right-0.5 rounded bg-[#f3d990] px-1 text-[8px] leading-3 text-[#302418]">{amount}</span>}
                </button>;
              })}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {OUTSIDE_BETS.map(outside => <button key={outside.label} disabled={spinning} onClick={() => addBet(outside.type, outside.positions)}
                aria-label={`Miser ${chipValue} GC sur ${outside.label}`} className={`min-h-11 rounded border border-[#d8c9a5]/30 px-1 text-xs font-medium text-[#f4ebd3] hover:border-gold disabled:cursor-not-allowed ${outside.type === 'red' ? 'bg-[#9b3039]/70' : outside.type === 'black' ? 'bg-[#0f1723]/70' : 'bg-black/10'}`}>{outside.label}</button>)}
            </div>
          </div>

          <fieldset disabled={spinning}>
            <legend className="mb-3 text-xs text-slate-400">Valeur du jeton</legend>
            <div className="flex flex-wrap gap-3">
              {CHIP_VALUES.map((value, index) => <button key={value} onClick={() => setChipValue(value)} aria-label={`Jeton de ${value} GC`} aria-pressed={chipValue === value}
                className={`h-11 w-11 rounded-full transition-transform disabled:cursor-not-allowed ${chipValue === value ? '-translate-y-1 ring-2 ring-gold ring-offset-2 ring-offset-[#101c30]' : 'opacity-70 hover:opacity-100'}`}>
                <CasinoChip value={value} color={CHIP_COLORS[index]} className="h-full w-full" />
              </button>)}
            </div>
          </fieldset>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 text-sm"><span className="text-slate-400">Mise totale</span><strong className="text-gold">{totalBet} GC</strong></div>
            {bets.length > 0 && <div className="mt-3 max-h-32 space-y-1 overflow-y-auto border-t border-white/10 pt-3">
              {bets.map((wager, index) => <p key={index} className="flex justify-between gap-2 text-xs"><span className="text-slate-300">{wager.type} {wager.positions.join(', ')}</span><span className="text-gold">{wager.amount} GC</span></p>)}
            </div>}
          </div>
          <div className="flex gap-3">
            <button disabled={spinning || bets.length === 0} onClick={() => setBets([])} className="btn-outline min-h-12 px-4 text-sm">Effacer</button>
            <button onClick={handleSpin} disabled={spinning || bets.length === 0} className="btn-primary min-h-12 flex-1"><FerrisWheel className="mr-2 inline-block h-4 w-4" /> {spinning ? 'Lancement...' : 'Lancer'}</button>
          </div>
          {error && <p role="alert" className="text-center text-sm text-error">{error}</p>}
          <div aria-live="polite" aria-atomic="true">
            {result && <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-center">
              <ResultSummary payout={result.totalWin} bet={result.bets.reduce((sum, wager) => sum + wager.amount, 0)} />
              {result.bets.some(wager => wager.won) && <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-left">
                <h3 className="mb-2 flex items-center gap-2 text-xs text-gold"><Check className="h-4 w-4" /> Paris gagnants</h3>
                {result.bets.filter(wager => wager.won).map((wager, index) => <p key={index} className="flex justify-between text-xs text-slate-300"><span>{wager.type}</span><span>Brut : {wager.payout} GC</span></p>)}
              </div>}
            </div>}
          </div>
        </section>
      </div>
    </div>
  );
}
