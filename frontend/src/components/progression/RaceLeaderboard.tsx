import { useState, useEffect, type ReactNode } from 'react';
import { progressionApi, type Race, type RaceEntry, type RaceRank } from '@/services/progression';
import { Medal, Flag, Trophy } from 'lucide-react';
import { useBalanceStore } from '@/store/balanceStore';

function RemainingTimer({ endAt }: { endAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Terminé'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${d}j ${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [endAt]);

  return <span className="text-xs text-gray-400">⏱ {remaining}</span>;
}

export function RaceLeaderboard() {
  const [race, setRace] = useState<Race | null>(null);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [myRank, setMyRank] = useState<RaceRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      progressionApi.getRace(),
      progressionApi.getLeaderboard(),
      progressionApi.getMyRank(),
    ])
      .then(([r, lb, rank]) => { setRace(r); setEntries(lb); setMyRank(rank); })
      .catch(() => setError('Erreur de chargement du classement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await progressionApi.claimRacePrize();
      await useBalanceStore.getState().syncBalance();
      fetchAll();
    } catch {
      setError('Erreur lors de la réclamation du prix');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-5 animate-pulse">
        <div className="h-6 w-40 bg-gray-700 rounded mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-700 rounded mb-2" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-gray-400 py-8">{error}</div>;
  }

  if (!race) {
    return <div className="text-center text-gray-400 py-8">Aucune course en cours</div>;
  }

  const isActive = race.status === 'active';
  const isCompleted = race.status === 'completed';

  const rankStyle = (rank: number | null) => {
    if (rank === 1) return 'text-gold';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-amber-700';
    return 'text-white';
  };

  const rankIcon = (rank: number | null): ReactNode => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-amber-700" />;
    return `#${rank}`;
  };

  return (
    <div className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-gold" /> {race.name}
          </h3>
          <RemainingTimer endAt={race.endAt} />
        </div>
        {isCompleted && myRank && myRank.prize > 0 && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="px-4 py-2 bg-gradient-to-r from-gold to-amber-600 text-black rounded-lg text-sm font-bold hover:brightness-110 transition"
          >
            {claiming ? '...' : `Réclamer ${myRank.prize.toLocaleString()} GC`}
          </button>
        )}
      </div>

      <div className="space-y-1">
        {entries.map((entry) => {
          const rank = entry.rank || 0;
          const isMe = myRank?.rank === rank;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isMe ? 'bg-gold/10 border border-gold/30' : 'hover:bg-gray-800/50'
              }`}
            >
              <span className={`w-8 text-center font-bold ${rankStyle(rank)}`}>{rankIcon(rank)}</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-secondary flex items-center justify-center text-xs font-bold text-white shrink-0">
                {entry.user.pseudo?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className={`flex-1 font-medium ${isMe ? 'text-gold' : 'text-white'}`}>
                {entry.user.pseudo}
                {isMe && <span className="text-xs text-gold ml-2">(vous)</span>}
              </span>
              <span className="text-accent font-semibold">{entry.xp} XP</span>
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">Aucun participant pour l'instant</p>
      )}
    </div>
  );
}
