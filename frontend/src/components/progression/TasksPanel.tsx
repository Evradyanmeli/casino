import { useState, useEffect, useRef } from 'react';
import { progressionApi, type UserTask } from '@/services/progression';
import { useBalanceStore } from '@/store/balanceStore';
import { CalendarDays, CalendarRange, Check } from 'lucide-react';
import { CasinoChip } from '@/components/games/GameVisuals';

function TaskCard({ task, onClaim, claiming, busy }: { task: UserTask; onClaim: () => void; claiming: boolean; busy: boolean }) {
  const cond = task.task.condition;
  const progressPct = cond.count > 0 ? Math.max(0, Math.min((task.progress / cond.count) * 100, 100)) : 0;

  return (
    <article className={`casino-panel flex min-w-0 flex-col p-5 ${task.completed && !task.claimed ? 'ring-1 ring-[#d1b675]/30' : ''}`} aria-busy={claiming}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${task.claimed ? 'border-white/10 text-slate-400' : task.completed ? 'border-[#d1b675]/30 text-[#e6cc94]' : 'border-[#8caf99]/20 text-[#b8c5be]'}`}>
          {task.claimed && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          {task.claimed ? 'Récompense reçue' : task.completed ? 'À réclamer' : 'En cours'}
        </span>
        <span className="min-w-0 break-words text-xs tabular-nums text-slate-400">{task.progress.toLocaleString()} / {cond.count.toLocaleString()}</span>
      </div>
      <h4 className="break-words text-lg text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{task.task.title}</h4>
      <p className="mt-2 break-words text-sm leading-relaxed text-slate-400">{task.task.description}</p>
      <div className="mb-5 mt-4 h-1.5 rounded-full bg-white/10" role="progressbar" aria-label={`Progression : ${task.task.title}`} aria-valuenow={task.completed ? 100 : progressPct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${task.progress} sur ${cond.count}`}>
        <div className="h-full rounded-full bg-[#baa16b]" style={{ width: `${task.completed ? 100 : progressPct}%` }} />
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-sm">
        <CasinoChip color="#9b8049" className="!h-8 !w-8" />
        <div className="min-w-0 flex-1 break-words font-semibold tabular-nums text-[#e6cc94]">+{task.task.reward.coins.toLocaleString()} GC <span className="block text-xs font-normal text-[#b8c5be]">+{task.task.reward.xp.toLocaleString()} XP</span></div>
      </div>
      <button type="button" onClick={onClaim} disabled={!task.completed || task.claimed || busy} aria-label={`${task.claimed ? 'Récompense reçue' : 'Réclamer'} : ${task.task.title}`}
        className={`mt-4 min-h-11 w-full break-words rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e6cc94] disabled:cursor-not-allowed ${task.completed && !task.claimed ? 'border-[#d1b675]/40 bg-[#c7a35e] text-[#101923] hover:bg-[#d8b979] disabled:opacity-60' : 'border-white/10 bg-white/5 text-slate-400'}`}>
        {claiming ? 'Réclamation en cours…' : task.claimed ? 'Réclamé' : task.completed ? 'Réclamer la récompense' : 'Objectif à accomplir'}
      </button>
    </article>
  );
}

export function TasksPanel() {
  const [daily, setDaily] = useState<UserTask[]>([]);
  const [weekly, setWeekly] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const { syncBalance } = useBalanceStore();

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    await progressionApi.getTasks()
      .then((data) => { setDaily(data.daily); setWeekly(data.weekly); })
      .catch(() => setError('Erreur lors du chargement des tâches'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleClaim = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    setClaiming(id);
    setError(null);
    try {
      const result = await progressionApi.claimTask(id);
      const markClaimed = (tasks: UserTask[]) => tasks.map(task => task.id === id ? { ...task, claimed: true } : task);
      setDaily(markClaimed);
      setWeekly(markClaimed);
      window.dispatchEvent(new CustomEvent('xp-updated', { detail: result }));
      try {
        await syncBalance();
        await fetchTasks();
      } catch {
        setError('Récompense reçue, mais le solde n’a pas pu être actualisé. Rechargez la page pour le vérifier.');
      }
    } catch {
      setError('Réclamation non confirmée. Vérifiez vos récompenses avant de réessayer.');
    } finally {
      busy.current = false;
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div role="status" className="casino-panel p-6 text-sm text-slate-400">Chargement de vos objectifs…</div>
    );
  }

  return (
    <section className="casino-section min-w-0 space-y-6" aria-label="Vos objectifs">
      <div><p className="casino-eyebrow">Vos objectifs</p><h2 className="mt-2 text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>Chaque partie fait avancer votre parcours.</h2></div>
      {error && <div role="alert" className="casino-panel space-y-3 border border-red-400/30 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => fetchTasks()} disabled={claiming !== null} className="min-h-11 rounded-lg border border-white/20 px-4 py-2 text-slate-200 disabled:opacity-50">Actualiser les tâches</button></div>}
      {[{ title: 'Tâches quotidiennes', tasks: daily, Icon: CalendarDays }, { title: 'Tâches hebdomadaires', tasks: weekly, Icon: CalendarRange }].map(({ title, tasks, Icon }) => <div key={title}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#f1e7d1]"><Icon className="h-5 w-5 shrink-0 text-[#baa16b]" aria-hidden="true" />{title}</h3>
          {(!error || tasks.length > 0) && <span className="text-xs tabular-nums text-slate-400">{tasks.filter(task => task.claimed).length} / {tasks.length} récompenses reçues</span>}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.length === 0 && <p className="casino-empty casino-panel p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-3">{error ? 'Les tâches ne sont pas disponibles.' : 'Aucune tâche disponible pour le moment.'}</p>}
          {tasks.map(task => <TaskCard key={task.id} task={task} onClaim={() => handleClaim(task.id)} claiming={claiming === task.id} busy={claiming !== null} />)}
        </div>
      </div>)}
    </section>
  );
}
