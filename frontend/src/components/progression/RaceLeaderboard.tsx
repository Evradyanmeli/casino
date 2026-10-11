import { useState, useEffect, useRef } from 'react';
import { progressionApi, type Race, type RaceEntry, type RaceRank } from '@/services/progression';
import { SlotSymbol } from '@/components/games/GameVisuals';
import { MedalGraphic } from './BadgesDisplay';
import { useBalanceStore } from '@/store/balanceStore';
import { useAuthStore } from '@/store/authStore';

export function RaceLeaderboard() {
  const [race, setRace] = useState<Race | null>(null);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [myRank, setMyRank] = useState<RaceRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedRace, setClaimedRace] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const { user } = useAuthStore();

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await progressionApi.getRace();
      const [lb, rank] = await Promise.all([progressionApi.getLeaderboard(), progressionApi.getMyRank()]);
      setRace(r);
      setNow(Date.now());
      setEntries(lb);
      setMyRank(rank);
    } catch {
      setError('Erreur de chargement du classement. Veuillez actualiser la course.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!race) return;
    const current = Date.now();
    const next = [Date.parse(race.startAt), Date.parse(race.endAt)].filter(time => time > current).sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - current + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [race, now]);

  const handleClaim = async () => {
    if (busy.current || !race || claimedRace === race.id) return;
    busy.current = true;
    setClaiming(true);
    setError(null);
    try {
      await progressionApi.claimRacePrize();
      setClaimedRace(race.id);
      try {
        await useBalanceStore.getState().syncBalance();
        await fetchAll();
      } catch {
        setError('Prix reçu, mais le solde n’a pas pu être actualisé. Rechargez la page pour le vérifier.');
      }
    } catch {
      setError('Réclamation du prix non confirmée. Vérifiez votre solde avant de réessayer.');
    } finally {
      busy.current = false;
      setClaiming(false);
    }
  };

  if (loading) return <div role="status" className="casino-panel p-6 text-sm text-slate-400">Chargement de la course…</div>;
  if (!race) return <section className="casino-empty casino-panel space-y-3 p-6 text-sm text-slate-400">
    <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>La course CasinoX</h2>
    {error ? <p role="alert">{error}</p> : <p>Aucune course disponible pour le moment.</p>}
    {error && <button type="button" onClick={() => fetchAll()} className="min-h-11 rounded-lg border border-white/20 px-4 py-2">Actualiser la course</button>}
  </section>;

  const endTime = new Date(race.endAt).getTime();
  const startTime = new Date(race.startAt).getTime();
  const completed = race.status === 'completed';
  const active = race.status === 'active' && startTime <= now && endTime > now;
  const ended = completed || endTime <= now;
  const mine = entries.find(entry => entry.raceId === race.id && entry.userId === user?.id);
  const claimed = mine?.claimed || claimedRace === race.id;
  const status = completed ? 'Classement final' : ended ? 'Course clôturée · classement en attente' : active ? 'Course en cours' : race.status === 'upcoming' ? 'À venir' : 'Course indisponible';
  // Active entries are returned in XP order, with user ID as the server tie-breaker.
  const ranked = entries.filter(entry => entry.raceId === race.id).map((entry, index) => ({ ...entry, displayRank: entry.rank ?? index + 1 }));
  const prizeFor = (entry: RaceEntry, rank: number) => {
    if (completed) return entry.prize;
    if (Object.prototype.hasOwnProperty.call(race.prize, String(rank))) return race.prize[String(rank)];
    const range = Object.entries(race.prize).find(([key]) => {
      const [min, max] = key.split('_').map(Number);
      return key.includes('_') && rank >= min && rank <= max;
    });
    return range?.[1] ?? 0;
  };
  const top = ranked.filter(entry => entry.displayRank <= 3);
  const dateLabel = Number.isFinite(endTime) ? new Date(race.endAt).toLocaleString() : null;

  return <section className="casino-section casino-panel min-w-0 overflow-hidden" aria-label="Classement de la course" aria-busy={claiming}>
    <div className="casino-stage border-b border-white/10 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-48">
          <p className="casino-eyebrow">La course CasinoX</p>
          <h2 className="mt-2 break-words text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{race.name}</h2>
          <p className="mt-2 text-sm text-[#c5d8ca]">{status}</p>
          {dateLabel && <p className="mt-1 break-words text-xs text-[#b8c5be]">{ended ? 'Clôture' : 'Fin prévue'} : <time dateTime={race.endAt}>{dateLabel}</time></p>}
        </div>
        <SlotSymbol symbol="TROPHY" className="!h-20 !w-20 shrink-0 drop-shadow-lg" />
      </div>
      {myRank && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="casino-kpi min-w-0 rounded-xl border border-white/10 bg-[#111d22]/60 p-4"><p className="text-xs text-[#b8c5be]">Votre rang</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[#e6cc94]">{myRank.rank > 0 ? `#${myRank.rank.toLocaleString()}` : 'Non classé'}</p></div>
        <div className="casino-kpi min-w-0 rounded-xl border border-white/10 bg-[#111d22]/60 p-4"><p className="text-xs text-[#b8c5be]">Votre progression</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[#f1e7d1]">{myRank.xp.toLocaleString()} <span className="text-sm">XP</span></p></div>
        <div className="casino-kpi min-w-0 rounded-xl border border-white/10 bg-[#111d22]/60 p-4"><p className="text-xs text-[#b8c5be]">{completed ? 'Prix attribué' : active ? 'Prix provisoire à ce rang' : 'Attribution du prix'}</p><p className="mt-1 break-words text-xl font-semibold tabular-nums text-[#e6cc94]">{completed || active ? `${myRank.prize.toLocaleString()} GC` : 'En attente'}</p>{active && <p className="mt-1 text-xs text-[#b8c5be]">Non acquis avant la clôture.</p>}</div>
      </div>}
    </div>
    <div className="space-y-5 p-5 sm:p-6">
      {error && <p role="alert" className="break-words rounded-lg border border-red-400/30 p-4 text-sm text-red-200">{error}</p>}
      {completed && myRank && myRank.prize > 0 && <div className="flex flex-wrap items-center gap-3">
        {claimed ? <p role="status" className="text-sm text-[#c5d8ca]">Prix réclamé.</p> : <button type="button" onClick={handleClaim} disabled={claiming} className="min-h-11 max-w-full break-words rounded-lg bg-[#c7a35e] px-5 py-3 text-sm font-semibold text-[#101923] hover:bg-[#d8b979] disabled:opacity-60">{claiming ? 'Réclamation en cours…' : `Réclamer ${myRank.prize.toLocaleString()} GC`}</button>}
      </div>}
      {top.length > 0 && <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3" aria-label="Podium">
        {top.map(entry => <article key={entry.id} data-rank={entry.displayRank} data-current-user={entry.userId === user?.id} className={`relative min-w-0 rounded-xl border p-4 text-center ${entry.displayRank === 1 ? 'border-[#d1b675]/40 bg-[linear-gradient(145deg,#343225,#182530)] sm:order-2 sm:pb-9' : entry.displayRank === 2 ? 'border-white/10 bg-[#15202e] sm:order-1' : 'border-white/10 bg-[#15202e] sm:order-3'} ${entry.userId === user?.id ? 'ring-1 ring-[#d1b675]/60' : ''}`}>
          <div className={`mx-auto w-fit ${entry.displayRank === 2 ? 'grayscale' : entry.displayRank === 3 ? 'sepia' : ''}`}><MedalGraphic symbol={entry.displayRank === 1 ? 'TROPHY' : 'STAR'} /></div>
          <p className="mt-2 text-xs font-semibold tabular-nums text-[#baa16b]">#{entry.displayRank}</p>
          <h3 className="mt-1 break-words text-base font-semibold text-[#f1e7d1]">{entry.user.pseudo}{entry.userId === user?.id && <span className="ml-1 text-xs text-[#e6cc94]">(vous)</span>}</h3>
          <p className="mt-2 break-words text-sm tabular-nums text-[#c5d8ca]">{entry.xp.toLocaleString()} XP</p>
          {(active || completed) && <p className="mt-1 break-words text-xs tabular-nums text-[#e6cc94]">{prizeFor(entry, entry.displayRank).toLocaleString()} GC · {completed ? 'attribués' : 'provisoires'}</p>}
        </article>)}
      </div>}
      {ranked.length === 0 ? <p className="casino-empty py-6 text-center text-sm text-slate-400">Aucun participant pour l'instant.</p> : <ol className="space-y-2" aria-label="Tous les rangs affichés">
        {ranked.map(entry => <li key={entry.id} data-current-user={entry.userId === user?.id} className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)] ${entry.userId === user?.id ? 'border-[#d1b675]/30 bg-[#c7a35e]/10' : 'border-white/5 bg-white/[0.02]'}`}>
          <span className="break-words text-sm font-semibold tabular-nums text-[#baa16b]">#{entry.displayRank.toLocaleString()}</span>
          <span className="min-w-0 break-words text-sm font-medium text-slate-200">{entry.user.pseudo}{entry.userId === user?.id && <span className="ml-2 text-xs text-[#e6cc94]">(vous)</span>}</span>
          <div className="col-start-2 min-w-0 sm:col-start-3 sm:text-right"><p className="break-words text-sm tabular-nums text-[#c5d8ca]">{entry.xp.toLocaleString()} XP</p>{(active || completed) && <p className="mt-1 break-words text-xs tabular-nums text-slate-400">{prizeFor(entry, entry.displayRank).toLocaleString()} GC · {completed ? 'attribués' : 'provisoires'}</p>}</div>
        </li>)}
      </ol>}
      <p className="text-xs leading-relaxed text-slate-400">Classement selon l'XP de la course. Les récompenses suivent le barème de cette course, sans garantie avant le classement final.</p>
      <button type="button" onClick={() => fetchAll()} disabled={claiming} className="min-h-11 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-[#d1b675]/40 hover:text-[#e6cc94] disabled:opacity-50">Actualiser la course</button>
    </div>
  </section>;
}
