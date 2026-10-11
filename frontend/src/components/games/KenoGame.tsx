import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameHeader from './GameHeader';
import { useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import { gamesApi, type KenoState } from '@/services/games';

export default function KenoGame() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bet, setBet] = useState(5);
  const [game, setGame] = useState<KenoState | null>(null);
  const [roundBet, setRoundBet] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useGameError();
  const [revealedDrawn, setRevealedDrawn] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const active = useRef(true);
  const busy = useRef(false);
  const matches = revealedDrawn.filter(number => selected.has(number)).length;

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; timers.current.forEach(clearTimeout); };
  }, []);

  const toggleNumber = (number: number) => {
    if (busy.current || game) return;
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(number)) next.delete(number);
      else if (next.size < 10) next.add(number);
      return next;
    });
  };

  const handlePlay = async () => {
    if (busy.current || game || selected.size === 0) return;
    if (!Number.isFinite(bet) || bet < 1) { setError('Choisissez une mise valide'); return; }
    const stake = bet;
    busy.current = true;
    setDrawing(true);
    setError('');
    setRevealedDrawn([]);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      const outcome = await gamesApi.keno.play(stake, [...selected].sort((a, b) => a - b));
      if (!active.current) return;
      const complete = () => {
        setGame(outcome);
        setRoundBet(stake);
        setDrawing(false);
        busy.current = false;
      };
      if (reducedMotion || outcome.drawnNumbers.length === 0) {
        setRevealedDrawn(outcome.drawnNumbers);
        complete();
      } else {
        outcome.drawnNumbers.forEach((_, index) => {
          timers.current.push(setTimeout(() => {
            setRevealedDrawn(outcome.drawnNumbers.slice(0, index + 1));
            if (index === outcome.drawnNumbers.length - 1) complete();
          }, (index + 1) * 100));
        });
      }
    } catch (err: any) {
      if (!active.current) return;
      setError(err.response?.data?.error || err.message || 'Erreur de jeu');
      setDrawing(false);
      busy.current = false;
    }
  };

  const reset = () => {
    if (busy.current) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setGame(null);
    setError('');
    setRevealedDrawn([]);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5" aria-busy={drawing}>
      <GameHeader title="Keno" eyebrow="Le Salon Des Numeros" description="Selectionnez jusqu'a 10 numeros et suivez le tirage, boule apres boule." onBack={() => navigate('/lobby')} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(240px,0.8fr)]">
        <section className="casino-stage min-w-0 rounded-2xl border-[3px] border-[#725337] p-3 shadow-[inset_0_0_25px_#0007,0_15px_35px_#0005] sm:p-5"
          style={{ background: 'radial-gradient(ellipse at 30% 0%, #28584f, #173c37 50%, #0c252c)' }} aria-label="Grille Keno">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#d1b77b]/25 pb-3">
            <span className="font-display text-lg tracking-[0.15em] text-[#e4c98e]">KENO 80</span>
            <span className="text-xs text-[#b4c8bf]">{selected.size} / 10 selectionnes</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 min-[480px]:grid-cols-8 sm:grid-cols-10 sm:gap-2">
            {Array.from({ length: 80 }, (_, index) => index + 1).map(number => {
              const isSelected = selected.has(number);
              const isDrawn = revealedDrawn.includes(number);
              const isMatch = isSelected && isDrawn;
              return <button key={number} onClick={() => toggleNumber(number)} aria-pressed={isSelected}
                aria-label={`Numero ${number}${isSelected ? ', selectionne' : ''}${isDrawn ? ', tire' : ''}${isMatch ? ', correspondance' : ''}`}
                disabled={!!game || drawing || (!isSelected && selected.size >= 10)}
                className={`relative flex aspect-square min-h-11 w-full items-center justify-center rounded-lg border text-xs font-bold shadow-[0_3px_0_#0005,inset_0_1px_0_#fff1] transition-colors sm:text-sm ${isMatch ? 'border-[#fff0b6] bg-gradient-to-br from-[#ffe7a1] to-[#ba8b37] text-[#241c12] shadow-[0_0_12px_#e9c77766]' : isDrawn ? 'border-[#85b7b7]/50 bg-gradient-to-br from-[#34787b] to-[#205456] text-white' : isSelected ? 'border-gold/70 bg-[#8d743a]/40 text-[#ffe3a2]' : 'border-white/10 bg-[#0c2528]/70 text-[#a0bcb7] hover:border-gold/50 hover:text-white'}`}>
                {number}
                {isMatch && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-[#795118]" />}
                {isSelected && !isDrawn && <span aria-hidden="true" className="absolute bottom-1 h-0.5 w-2 rounded bg-[#e7c67c]" />}
              </button>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] text-[#adbfba]">
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#8d743a]" /> Selection</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#34787b]" /> Numero tire</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#e9c777]" /> Correspondance</span>
          </div>
        </section>

        <section className="casino-panel space-y-4 rounded-2xl border border-white/10 bg-[#101c30] p-5">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Choisis</p><p className="mt-1 font-display text-2xl text-gold">{selected.size}<span className="text-sm text-slate-500">/10</span></p></div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Correspondances</p><p className="mt-1 font-display text-2xl text-gold">{game ? game.matchCount : matches}</p></div>
          </div>
          {!game && <>
            <div><label htmlFor="keno-bet" className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Votre mise · GC</label>
              <input id="keno-bet" type="number" disabled={drawing} value={bet} onChange={event => setBet(Number(event.target.value))} className="input-field min-h-12" min={1} />
            </div>
            <button onClick={handlePlay} disabled={drawing || selected.size === 0} className="btn-primary min-h-12 w-full">{drawing ? 'Tirage en cours...' : 'Lancer le tirage'}</button>
            <button onClick={() => setSelected(new Set())} disabled={drawing || selected.size === 0} className="min-h-11 w-full text-xs text-slate-400 hover:text-gold disabled:opacity-40">Effacer la selection</button>
          </>}
          <div aria-live="polite" aria-atomic="true">
            {drawing && <p className="text-center text-sm text-slate-400">{revealedDrawn.length > 0 ? `${revealedDrawn.length} numeros reveles` : 'Preparation du tirage...'}</p>}
            {game && <div className="space-y-4 text-center"><ResultSummary payout={game.payout} bet={roundBet} /><button onClick={reset} className="btn-primary min-h-12 w-full">Nouveau tirage</button></div>}
          </div>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </section>
      </div>
      <section className="casino-panel rounded-xl border border-white/10 bg-[#101c30] p-4" aria-label="Numeros tires">
        <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs uppercase tracking-wider text-slate-400">Le tirage</h3><span className="text-xs text-slate-500">{revealedDrawn.length} boules</span></div>
        <div className="flex min-h-11 flex-wrap gap-2">
          {revealedDrawn.length === 0 && <p className="self-center text-sm text-slate-500">Les numeros du tirage apparaitront ici.</p>}
          {revealedDrawn.map(number => <span key={number} className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold shadow-[inset_0_2px_2px_#fff5,0_3px_6px_#0006] ${selected.has(number) ? 'border-[#f3d997] bg-gradient-to-br from-[#ffe7a1] to-[#b88732] text-[#2a2015]' : 'border-[#bac9cf] bg-gradient-to-br from-[#f8f5e9] to-[#96acb3] text-[#213143]'}`}>{number}</span>)}
        </div>
      </section>
    </div>
  );
}
