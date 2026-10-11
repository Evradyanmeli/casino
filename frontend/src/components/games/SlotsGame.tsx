import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ClipboardList, Dices, Star } from 'lucide-react';
import GameHeader from './GameHeader';
import { SlotSymbol, CasinoChip, useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';
import { gamesApi, type SpinResult } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';

const VARIANTS: Record<string, { name: string; reels: number; paylines: number; symbols: string[] }> = {
  classic: { name: 'Classique', reels: 3, paylines: 3, symbols: ['CHERRY', 'LEMON', 'STAR', 'SEVEN', 'BELL', 'DIAMOND', 'BAR'] },
  fruit: { name: 'Fruits', reels: 5, paylines: 5, symbols: ['CHERRY', 'LEMON', 'ORANGE', 'GRAPE', 'WATERMELON', 'STRAWBERRY', 'APPLE', 'BANANA'] },
  diamond: { name: 'Diamant', reels: 5, paylines: 10, symbols: ['DIAMOND', 'CROWN', 'STAR', 'BELL', 'SEVEN', 'TROPHY', 'MONEY', 'FIRE', 'TARGET', 'SLOT', 'SCATTER'] },
};

export function SlotsGame() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [variant, setVariant] = useState('classic');
  const [bet, setBet] = useState(10);
  const [roundBet, setRoundBet] = useState(0);
  const [reels, setReels] = useState<string[][]>([]);
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<{ result: SpinResult; bet: number; variant: string }[]>([]);
  const [error, setError] = useGameError();
  const { balance } = useBalanceStore();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const active = useRef(true);
  const busy = useRef(false);
  const config = VARIANTS[variant];
  const totalBet = bet * config.paylines;
  const winningPositions = new Set(result?.paylines.flatMap(line => line.positions) ?? []);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; timers.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    setReels(Array.from({ length: config.reels }, (_, column) =>
      Array.from({ length: 3 }, (_, row) => config.symbols[(column + row) % config.symbols.length])));
    setResult(null);
    setStoppedReels(config.reels);
  }, [variant, config]);

  const handleSpin = async () => {
    if (busy.current) return;
    if (totalBet > balance) { setError('Solde insuffisant'); return; }
    const stake = totalBet;
    busy.current = true;
    setError('');
    setResult(null);
    setSpinning(true);
    setStoppedReels(0);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      const outcome = await gamesApi.slotsSpin(variant, bet);
      if (!active.current) return;
      const stopReel = (column: number) => {
        setReels(previous => previous.map((reel, index) => index === column ? outcome.reels[column] : reel));
        setStoppedReels(column + 1);
        if (column === outcome.reels.length - 1) {
          setReels(outcome.reels);
          setResult(outcome);
          setRoundBet(stake);
          setHistory(previous => [{ result: outcome, bet: stake, variant }, ...previous].slice(0, 10));
          setSpinning(false);
          busy.current = false;
        }
      };
      outcome.reels.forEach((_, column) => {
        if (reducedMotion) stopReel(column);
        else timers.current.push(setTimeout(() => stopReel(column), 650 + column * 180));
      });
    } catch (err: any) {
      if (!active.current) return;
      setSpinning(false);
      setStoppedReels(config.reels);
      busy.current = false;
      setError(err.response?.data?.error || err.message || 'Erreur lors du spin');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5" aria-busy={spinning}>
      <GameHeader title="Slots" eyebrow="Collection Royale" description="Trois univers, des rouleaux sculptes et une mise par ligne." onBack={() => navigate('/lobby')} />

      <div className="casino-panel flex gap-1 rounded-xl border border-white/10 bg-[#101c30] p-1.5" aria-label="Variante">
        {Object.entries(VARIANTS).map(([id, entry]) => (
          <button key={id} disabled={spinning} aria-pressed={variant === id} onClick={() => { setVariant(id); setError(''); }}
            className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variant === id ? 'bg-gold/15 text-gold ring-1 ring-gold/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            {entry.name}
          </button>
        ))}
      </div>

      <section className="casino-stage relative overflow-hidden rounded-[1.5rem] border border-[#b99555]/60 p-3 shadow-[0_24px_70px_#0008,inset_0_1px_0_#ffedbb66] sm:p-6"
        style={{ background: 'linear-gradient(135deg, #573924, #241c1b 30%, #0c1828 55%, #3c2b22)' }} aria-label="Machine a sous">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-gold/20 pb-3">
          <span className="flex items-center gap-2 font-display text-sm tracking-[0.2em] text-gold"><Star className="h-3 w-3" /> {config.name.toUpperCase()}</span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#c5b392]">{config.paylines} lignes actives</span>
        </div>

        <div className="relative mx-auto rounded-xl border-[3px] border-[#bca06a] bg-[#060b12] p-1.5 shadow-[0_0_0_3px_#261b17,inset_0_5px_18px_#000] sm:p-2" style={{ maxWidth: config.reels * 120 + 20 }}>
          <div className="flex gap-1 sm:gap-2">
            {reels.map((column, ci) => {
              const rolling = spinning && ci >= stoppedReels && !reducedMotion;
              return (
                <div key={ci} className="relative aspect-[1/3] min-w-0 flex-1 overflow-hidden rounded-md bg-[#d8d7c8] shadow-[inset_0_8px_16px_#0008]">
                  <div className={rolling ? 'opacity-70 blur-[1px]' : ''} style={rolling ? { animation: 'casino-slot-reel 180ms linear infinite', animationDelay: `${-ci * 40}ms` } : undefined}>
                    {(rolling ? [...column, ...column] : column).map((symbol, ri) => {
                      const winning = !spinning && winningPositions.has(ci * 3 + ri);
                      return (
                        <div key={ri} data-winning={winning || undefined} aria-label={rolling ? undefined : `${symbol}${winning ? ', position gagnante' : ''}`}
                          className={`relative flex aspect-square items-center justify-center border-b border-[#6c654b]/20 p-1 sm:p-2 ${winning ? 'bg-[#fff0b8] shadow-[inset_0_0_0_2px_#c49b43]' : ''}`}
                          style={{ backgroundImage: 'linear-gradient(180deg, #0002, #fff9 35%, #fff7 60%, #0002)' }}>
                          <SlotSymbol symbol={symbol} className="h-full max-h-24 w-full max-w-24 drop-shadow-[0_4px_3px_#0004]" />
                          {winning && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#a97917]" />}
                        </div>
                      );
                    })}
                  </div>
                  {rolling && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="my-5 grid grid-cols-3 divide-x divide-gold/15 rounded-xl border border-gold/15 bg-black/30 py-3 text-center">
          {[['Mise / ligne', bet], ['Lignes', config.paylines], ['Mise totale', totalBet]].map(([label, value]) => (
            <div key={label}><p className="text-[9px] uppercase tracking-wider text-slate-400 sm:text-[10px]">{label}</p><p className="mt-1 font-display text-lg text-gold">{value}</p></div>
          ))}
        </div>

        <fieldset disabled={spinning} className="mb-5">
          <legend className="mb-3 text-xs text-slate-400">Choisir la mise par ligne</legend>
          <div className="flex flex-wrap justify-center gap-3">
            {[5, 10, 25, 50, 100].map(value => (
              <button key={value} onClick={() => setBet(value)} aria-label={`Mise de ${value} GC par ligne`} aria-pressed={bet === value}
                className={`h-12 w-12 rounded-full transition-transform disabled:cursor-not-allowed ${bet === value ? '-translate-y-1 ring-2 ring-gold ring-offset-2 ring-offset-[#162030]' : 'opacity-70 hover:opacity-100'}`}>
                <CasinoChip value={value} className="h-full w-full" />
              </button>
            ))}
          </div>
        </fieldset>
        <button onClick={handleSpin} disabled={spinning} className="btn-primary min-h-12 w-full shadow-[0_6px_0_#6b4c20,0_10px_24px_#0005] disabled:cursor-not-allowed">
          <Dices className="mr-2 inline-block h-5 w-5" /> {spinning ? 'Rouleaux en mouvement...' : `Lancer · ${totalBet} GC`}
        </button>
        {error && <p role="alert" className="mt-4 text-center text-sm text-error">{error}</p>}
      </section>

      <div aria-live="polite" aria-atomic="true">
        {spinning && <p className="text-center text-sm text-slate-400">Les rouleaux s'arretent de gauche a droite.</p>}
        {result && (
          <div className="casino-panel rounded-xl border border-gold/20 bg-[#101c30] p-5 text-center">
            <ResultSummary payout={result.totalWin} bet={roundBet} />
            {result.paylines.length > 0 && <div className="mt-4 space-y-2 text-left">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold"><Check className="h-4 w-4" /> Lignes gagnantes</h3>
              {result.paylines.map((line, index) => <div key={index} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-3 text-slate-300"><SlotSymbol symbol={line.symbol} className="h-8 w-8" /> Ligne {line.line}</span>
                <span className="text-slate-300">Brut : {line.payout} GC</span>
              </div>)}
            </div>}
            {(result.isFreeSpin || (result.freeSpinsRemaining ?? 0) > 0) && <p className="mt-4 rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm text-gold">Symboles scatter detectes. Les tours gratuits ne sont pas encore disponibles. Tout nouveau spin est payant.</p>}
          </div>
        )}
      </div>

      {history.length > 0 && <section className="casino-panel rounded-xl border border-white/10 bg-[#101c30] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400"><ClipboardList className="h-4 w-4" /> Derniers spins · resultat net</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {history.map((entry, index) => <div key={index} className="min-w-[100px] rounded-lg border border-white/10 bg-black/20 p-3 text-center">
            <p className={`text-sm font-semibold ${entry.result.totalWin > entry.bet ? 'text-success' : entry.result.totalWin < entry.bet ? 'text-red-300' : 'text-slate-300'}`}>{signedNet(entry.result.totalWin, entry.bet)} GC</p>
            <p className="mt-1 text-[10px] text-slate-500">{VARIANTS[entry.variant].name} · mise {entry.bet}</p>
          </div>)}
        </div>
      </section>}
      <style>{`@keyframes casino-slot-reel { from { transform: translateY(0); } to { transform: translateY(-50%); } }`}</style>
    </div>
  );
}
