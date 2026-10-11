import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameHeader from './GameHeader';
import { Dice, CasinoChip, useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';
import { gamesApi, type CrapsState } from '@/services/games';

export default function CrapsGame() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [roundBet, setRoundBet] = useState(0);
  const [game, setGame] = useState<CrapsState | null>(null);
  const [passBet, setPassBet] = useState(10);
  const [oddsBet, setOddsBet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useGameError();
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const locked = loading || rolling;

  useEffect(() => {
    active.current = true;
    let current = true;
    gamesApi.craps.getState().then(state => {
      if (current) { setGame(state); if (state) setRoundBet(state.passBet); }
    }).catch(err => {
      if (current) setError(err.response?.data?.error || 'Session indisponible');
    }).finally(() => { if (current) setLoading(false); });
    return () => {
      current = false;
      active.current = false;
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  const handleRoll = async (start = false) => {
    if (busy.current || locked || (!start && !game)) return;
    if (start && (!Number.isFinite(passBet) || passBet < 1)) { setError('Choisissez une mise valide'); return; }
    busy.current = true;
    setLoading(true);
    setRolling(true);
    setError('');
    try {
      const outcome = start ? await gamesApi.craps.start(passBet) : await gamesApi.craps.roll(game!.sessionId);
      if (!active.current) return;
      const complete = () => {
        setGame(outcome);
        setRoundBet(outcome.passBet);
        setRolling(false);
        busy.current = false;
      };
      if (reducedMotion) complete();
      else timeout.current = setTimeout(complete, 750);
    } catch (err: any) {
      if (!active.current) return;
      setError(err.response?.data?.error || err.message || 'Erreur de lancer');
      setRolling(false);
      busy.current = false;
    } finally {
      if (active.current) setLoading(false);
    }
  };

  const handleOdds = async () => {
    if (!game || locked || busy.current) return;
    if (!Number.isFinite(oddsBet) || oddsBet < 1) { setError('Choisissez une mise Odds valide'); return; }
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const outcome = await gamesApi.craps.addOdds(game.sessionId, oddsBet);
      if (active.current) setGame(outcome);
    } catch (err: any) {
      if (active.current) setError(err.response?.data?.error || err.message || 'Erreur de mise Odds');
    } finally {
      if (active.current) { setLoading(false); busy.current = false; }
    }
  };

  const reset = () => {
    if (locked || busy.current) return;
    setGame(null);
    setOddsBet(0);
    setError('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5" aria-busy={locked}>
      <GameHeader title="Craps" eyebrow="La Table Des Des" description="Une mise Pass Line, deux des. Retrouvez le point avant le sept." onBack={() => navigate('/lobby')} />
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.8fr)]">
        <section className="casino-stage relative overflow-hidden rounded-[2rem] border-[8px] border-[#6c4930] p-5 shadow-[0_18px_40px_#0007,inset_0_0_35px_#0007] sm:p-8"
          style={{ background: 'radial-gradient(ellipse at 40% 15%, #286655, #174c3d 50%, #0b2b28)' }} aria-label="Table de Craps">
          <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#dbc48e]/30" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="font-display text-sm tracking-[0.15em] text-[#e0c58b]">CRAPS</span>
            <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-[3px] shadow-[0_4px_7px_#0008,inset_0_1px_0_#fff7] ${game?.point ? 'border-[#f1e6ce] bg-[#f4ecd9] text-[#153b31]' : 'border-[#7a8f84] bg-[#172d29] text-[#91aaa0]'}`} aria-label={game?.point ? `Point etabli : ${game.point}` : 'Point non etabli'}>
              <span className="text-[8px] font-bold tracking-wider">{game?.point ? 'POINT' : 'OFF'}</span>
              {game?.point && <span className="font-display text-xl leading-6">{game.point}</span>}
            </div>
          </div>

          <div className="relative my-8 flex min-h-28 items-center justify-center gap-7 sm:my-10 sm:gap-10" aria-label={rolling ? 'Des en mouvement' : game?.dice ? `Des : ${game.dice[0]} et ${game.dice[1]}` : 'Deux des, table prete'}>
            <div className="rotate-[-12deg]"><Dice value={game?.dice?.[0] ?? 1} rolling={rolling && !reducedMotion} className="h-20 w-20 sm:h-24 sm:w-24" /></div>
            <div className="translate-y-3 rotate-[14deg]"><Dice value={game?.dice?.[1] ?? 6} rolling={rolling && !reducedMotion} className="h-20 w-20 sm:h-24 sm:w-24" /></div>
          </div>

          <div className="relative rounded-[1rem] border-2 border-[#e1c88d]/50 p-4 text-center">
            <p className="font-display text-lg tracking-[0.2em] text-[#e7ce92]">PASS LINE</p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <CasinoChip value={game?.passBet ?? passBet} color="#ba9146" className="h-12 w-12" />
              <p className="text-sm text-[#c7d8cf]">{game ? `${game.passBet} GC engages` : 'La mise de depart'}</p>
            </div>
            {!!game?.oddsBet && <p className="mt-2 text-xs text-[#c7d8cf]">Odds : {game.oddsBet} GC</p>}
          </div>
          <div className="relative mt-4 min-h-10 text-center" aria-live="polite" aria-atomic="true">
            {rolling ? <p className="text-sm text-[#e7ce92]">Les des roulent...</p> : game ? <>
              {game.phase === 'point' && <p className="text-sm text-[#c7d8cf]">Retrouvez le <strong className="text-[#e7ce92]">{game.point}</strong> avant le 7.</p>}
              {game.phase === 'comeout' && <p className="text-sm text-[#c7d8cf]">Lancez les des pour etablir le point.</p>}
              {!!game.diceTotal && <p className="mt-1 text-sm text-white">Total des des : <strong>{game.diceTotal}</strong></p>}
            </> : <p className="text-sm text-[#9ab4a8]">7 ou 11 gagne. 2, 3 ou 12 perd.</p>}
          </div>
        </section>

        <section className="casino-panel space-y-4 rounded-2xl border border-white/10 bg-[#101c30] p-5">
          {!game && <>
            <div><label htmlFor="craps-pass-bet" className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Mise Pass Line · GC</label>
              <input id="craps-pass-bet" type="number" disabled={locked} value={passBet} onChange={event => setPassBet(Number(event.target.value))} className="input-field min-h-12" min={1} />
            </div>
            <div className="grid grid-cols-3 gap-2">{[10, 25, 100].map(value => <button key={value} disabled={locked} onClick={() => setPassBet(value)} aria-pressed={passBet === value} className={`min-h-11 rounded-lg border text-xs ${passBet === value ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 text-slate-400'}`}>{value} GC</button>)}</div>
            <button onClick={() => handleRoll(true)} disabled={locked} className="btn-primary min-h-12 w-full">{rolling ? 'Lancement...' : loading ? 'Chargement...' : 'Miser et lancer'}</button>
          </>}

          {game && game.phase !== 'resolved' && <>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3 text-sm"><span className="text-slate-400">Mise engagee</span><strong className="text-gold">{game.passBet + game.oddsBet} GC</strong></div>
            {game.phase === 'point' && !game.oddsBet && <div className="space-y-3 border-b border-white/10 pb-4">
              <div><label htmlFor="craps-odds-bet" className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Mise Odds · GC</label>
                <input id="craps-odds-bet" type="number" disabled={locked} value={oddsBet} onChange={event => setOddsBet(Number(event.target.value))} className="input-field min-h-12" min={1} max={game.passBet * 3} />
              </div>
              <p className="text-xs leading-relaxed text-slate-500">Optionnel. Cotes reelles, sans avantage maison. Maximum : {game.passBet * 3} GC.</p>
              <button onClick={handleOdds} disabled={locked || oddsBet < 1} className="btn-outline min-h-11 w-full">Ajouter Odds</button>
            </div>}
            <button onClick={() => handleRoll()} disabled={locked} className="btn-primary min-h-12 w-full">{rolling ? 'Lancement...' : 'Lancer les des'}</button>
          </>}

          <div aria-live="polite" aria-atomic="true">
            {game?.phase === 'resolved' && !rolling && <div className="space-y-4 text-center"><ResultSummary payout={game.payout} bet={roundBet + game.oddsBet} /><button onClick={reset} disabled={locked} className="btn-primary min-h-12 w-full">Nouvelle partie</button></div>}
          </div>
          {error && <p className="text-center text-sm text-error" role="alert">{error}</p>}
          <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500">Apres le premier lancer, le point reste en jeu jusqu'a son retour ou l'apparition d'un 7.</p>
        </section>
      </div>
    </div>
  );
}
