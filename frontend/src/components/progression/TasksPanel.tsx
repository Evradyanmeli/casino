import { useState, useEffect } from 'react';
import { progressionApi, type UserTask } from '@/services/progression';
import { useBalanceStore } from '@/store/balanceStore';
import { CalendarDays, CalendarRange } from 'lucide-react';

function TaskCard({ task, onClaim, claiming }: { task: UserTask; onClaim: () => void; claiming: boolean }) {
  const cond = task.task.condition;
  const progressPct = cond.count > 0 ? Math.min((task.progress / cond.count) * 100, 100) : 0;

  return (
    <div className={`bg-[#1A1A2E] border rounded-xl p-4 transition-all duration-200 ${task.completed ? 'border-gold/50' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${task.completed ? 'text-gold' : 'text-white'}`}>{task.task.title}</span>
            {task.completed && <span className="text-xs text-gold">✓</span>}
          </div>
          <p className="text-xs text-gray-400 mt-1">{task.task.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-accent">+{task.task.reward.xp} XP</span>
            <span className="text-gold">+{task.task.reward.coins.toLocaleString()} GC</span>
          </div>
        </div>
        <button
          onClick={onClaim}
          disabled={!task.completed || task.claimed || claiming}
          className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            task.claimed
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : task.completed
                ? 'bg-gradient-to-r from-gold to-amber-600 text-black hover:brightness-110'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {claiming ? '...' : task.claimed ? 'Réclamé' : task.completed ? 'Réclamer' : `${task.progress}/${cond.count}`}
        </button>
      </div>
      {!task.completed && (
        <div className="mt-3 w-full bg-gray-700 rounded-full h-1.5">
          <div className="bg-accent h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}

export function TasksPanel() {
  const [daily, setDaily] = useState<UserTask[]>([]);
  const [weekly, setWeekly] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { syncBalance } = useBalanceStore();

  const fetchTasks = () => {
    setLoading(true);
    setError(null);
    progressionApi.getTasks()
      .then((data) => { setDaily(data.daily); setWeekly(data.weekly); })
      .catch(() => setError('Erreur lors du chargement des tâches'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleClaim = async (id: string) => {
    setClaiming(id);
    try {
      const result = await progressionApi.claimTask(id);
      await syncBalance();
      window.dispatchEvent(new CustomEvent('xp-updated', { detail: result }));
      fetchTasks();
    } catch {
      setError('Erreur lors de la réclamation');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-5 w-40 bg-gray-700 rounded mb-2" />
            <div className="h-4 w-60 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-gray-400 py-8">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-accent" /> Tâches quotidiennes
        </h3>
        <div className="space-y-2">
          {daily.length === 0 && <p className="text-sm text-gray-500">Aucune tâche quotidienne disponible</p>}
          {daily.map((t) => (
            <TaskCard key={t.id} task={t} onClaim={() => handleClaim(t.id)} claiming={claiming === t.id} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-accent" /> Tâches hebdomadaires
        </h3>
        <div className="space-y-2">
          {weekly.length === 0 && <p className="text-sm text-gray-500">Aucune tâche hebdomadaire disponible</p>}
          {weekly.map((t) => (
            <TaskCard key={t.id} task={t} onClaim={() => handleClaim(t.id)} claiming={claiming === t.id} />
          ))}
        </div>
      </div>
    </div>
  );
}
