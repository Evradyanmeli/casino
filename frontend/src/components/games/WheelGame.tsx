import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameHeader from './GameHeader';
import { useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { nextWheelAngle, signedNet } from './gameMath';
import { useGameError } from './useGameError';
import { gamesApi, type WheelState } from '@/services/games';

const DEFAULT_SEGMENTS = [
  { multiplier: 50, color: '#FF1744', weight: 1 },
  { multiplier: 10, color: '#FF9100', weight: 4 },
  { multiplier: 5, color: '#FFD740', weight: 8 },
  { multiplier: 3, color: '#69F0AE', weight: 15 },
  { multiplier: 2, color: '#40C4FF', weight: 20 },
  { multiplier: 1.5, color: '#7C4DFF', weight: 20 },
  { multiplier: 1, color: '#E0E0E0', weight: 32 },
  { multiplier: 0, color: '#262636', weight: 277 / 0.95 - 100 },
];

export default function WheelGame() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 3200;
  const [game, setGame] = useState<WheelState | null>(null);
  const [segments, setSegments] = useState(DEFAULT_SEGMENTS);
  const [bet, setBet] = useState(10);
  const [roundBet, setRoundBet] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [error, setError] = useGameError();
  const [history, setHistory] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; if (timeout.current) clearTimeout(timeout.current); };
  }, []);

  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  let angle = 0;
  const wedges = segments.map(segment => {
    const start = angle;
    const span = segment.weight / totalWeight * 360;
    angle += span;
    return { ...segment, start, end: angle, center: start + span / 2, span };
  });
  const gradient = `conic-gradient(${wedges.map(wedge => `${wedge.color} ${wedge.start}deg ${wedge.end}deg`).join(', ')})`;

  const handleSpin = async () => {
    if (busy.current) return;
    if (!Number.isFinite(bet) || bet < 1) { setError('Choisissez une mise valide'); return; }
    const stake = bet;
    busy.current = true;
    setSpinning(true);
    setGame(null);
    setError('');
    try {
      const outcome = await gamesApi.wheel.spin(stake);
      if (!active.current) return;
      const target = nextWheelAngle(spinAngle, outcome.result.index, outcome.segments.map(segment => segment.weight));
      setSegments(outcome.segments);
      setSpinAngle(target);
      const complete = () => {
        setGame(outcome);
        setRoundBet(stake);
        setSpinning(false);
        busy.current = false;
        setHistory(previous => [{ multiplier: outcome.result.segment.multiplier, payout: outcome.payout, bet: stake }, ...previous].slice(0, 10));
      };
      if (duration === 0) complete();
      else timeout.current = setTimeout(complete, duration);
    } catch (err: any) {
      if (!active.current) return;
      setError(err.response?.data?.error || err.message || 'Erreur de spin');
      setSpinning(false);
      busy.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5" aria-busy={spinning}>
      <GameHeader title="Roue de la Fortune" eyebrow="Le Cercle Dore" description="Chaque secteur a sa place. Le repere dore indique votre multiplicateur." onBack={() => navigate('/lobby')} />
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.8fr)]">
        <section className="casino-stage rounded-2xl border border-gold/20 bg-[#101c30] p-4 sm:p-6" aria-label="Roue des multiplicateurs">
          <div className="casino-wheel relative mx-auto aspect-square w-full max-w-[420px] rounded-full border-[7px] border-[#7b5a35] p-2 shadow-[0_18px_40px_#0008,inset_0_1px_5px_#ffe4a780]"
            style={{ background: 'linear-gradient(145deg, #efcf8a, #73512e 25%, #d0ad65 50%, #47331e 80%, #b89a62)' }}>
            <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-[#f5dda4]"
              style={{ background: gradient, transform: `rotate(${spinAngle}deg)`, transition: `transform ${duration}ms cubic-bezier(0.12,0.65,0.15,1)` }}>
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_8px_#0c172033,inset_0_0_28px_#0009]" />
              <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" role="img" aria-label="Secteurs ponderes de la roue">
                {wedges.map((wedge, index) => <g key={index} data-segment={index} data-multiplier={wedge.multiplier}>
                  <path d="M 200 15 L 200 117" transform={`rotate(${wedge.start} 200 200)`} stroke="#e9cf96" strokeWidth="1" opacity="0.75" />
                  {wedge.span >= 9 && <text x="200" y="58" transform={`rotate(${wedge.center} 200 200)`} textAnchor="middle" dominantBaseline="middle"
                    fill={wedge.multiplier === 0 ? '#e2d4b2' : '#101c30'} fontSize={wedge.span < 16 ? '13' : '18'} fontWeight="800">{wedge.multiplier}x</text>}
                </g>)}
              </svg>
              <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 30% 15%, #fff5, transparent 45%, #0003 100%)' }} />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex aspect-square w-[38%] flex-col items-center justify-center rounded-full border-[5px] border-[#b99b61] text-center shadow-[0_4px_15px_#0009,inset_0_2px_3px_#fff3]"
                style={{ background: 'radial-gradient(circle at 35% 20%, #334257, #0a1422 75%)' }}>
                <span className="text-[8px] uppercase tracking-[0.2em] text-[#b99b61] sm:text-[10px]">Casino X</span>
                <span className="mt-1 font-display text-xl text-gold sm:text-3xl">{game ? `${game.result.segment.multiplier}x` : 'GC'}</span>
                <span className="mt-1 text-[8px] uppercase tracking-widest text-slate-500">Fortune</span>
              </div>
            </div>
            <div aria-hidden="true" className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[26px] border-x-transparent border-t-[#f4d389] drop-shadow-[0_3px_2px_#0009]" />
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">La taille des secteurs represente leur frequence.</p>
          <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Multiplicateurs de la roue">
            {segments.map((segment, index) => <div key={index} className={`rounded-lg border px-1 py-2 text-center ${game?.result.index === index ? 'border-gold bg-gold/10' : 'border-white/10 bg-black/20'}`}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: segment.color }} /><span className="text-xs font-semibold text-slate-200">{segment.multiplier}x</span>
            </div>)}
          </div>
        </section>

        <section className="casino-panel space-y-4 rounded-2xl border border-white/10 bg-[#101c30] p-5">
          <div><label htmlFor="wheel-bet" className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Votre mise · GC</label>
            <input id="wheel-bet" type="number" disabled={spinning} value={bet} onChange={event => setBet(Number(event.target.value))} className="input-field min-h-12" min={1} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 25, 100].map(value => <button key={value} disabled={spinning} onClick={() => setBet(value)} aria-pressed={bet === value} className={`casino-control min-h-11 rounded-lg border text-xs ${bet === value ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 text-slate-400 hover:border-gold/40'}`}>{value}</button>)}
          </div>
          <button onClick={handleSpin} disabled={spinning} className="btn-primary min-h-12 w-full">{spinning ? 'La roue tourne...' : 'Tourner la roue'}</button>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <div className="min-h-16" aria-live="polite" aria-atomic="true">
            {spinning ? <p className="py-3 text-center text-sm text-slate-400">Attendez l'arret du repere.</p> : game ? <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-center">
              <p className="mb-2 font-display text-xl text-gold">{game.result.segment.multiplier}x</p>
              <ResultSummary payout={game.payout} bet={roundBet} />
            </div> : <p className="py-3 text-center text-sm text-slate-500">Choisissez une mise pour commencer.</p>}
          </div>
        </section>
      </div>
      {history.length > 0 && <section className="casino-panel rounded-xl border border-white/10 bg-[#101c30] p-4">
        <h3 className="mb-3 text-xs uppercase tracking-wider text-slate-400">Derniers tours · resultat net</h3>
        <div className="flex flex-wrap gap-2">{history.map((entry, index) => <div key={index} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
          <span className="mr-2 text-gold">{entry.multiplier}x</span><span className={entry.payout > entry.bet ? 'text-success' : entry.payout < entry.bet ? 'text-red-300' : 'text-slate-300'}>{signedNet(entry.payout, entry.bet)} GC</span>
          <span className="ml-2 text-slate-500">mise {entry.bet}</span>
        </div>)}</div>
      </section>}
    </div>
  );
}
