import { useState, useEffect } from 'react';
import { progressionApi, type Badge, type UserBadge } from '@/services/progression';
import { Medal } from 'lucide-react';

export function BadgesDisplay() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      progressionApi.getBadges(),
      progressionApi.getMyBadges(),
    ])
      .then(([all, mine]) => {
        setBadges(all);
        setEarned(new Set(mine.map((ub) => ub.badgeId)));
      })
      .catch(() => setError('Erreur de chargement des badges'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-4 animate-pulse">
            <div className="w-10 h-10 bg-gray-700 rounded-full mx-auto mb-2" />
            <div className="h-4 w-16 bg-gray-700 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-gray-400 py-8">{error}</div>;
  }

  const categories = [...new Set(badges.map((b) => b.category))];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Medal className="w-5 h-5 text-gold" /> Badges
      </h3>
      {categories.length === 0 && <p className="text-sm text-gray-500">Aucun badge disponible</p>}
      {categories.map((cat) => (
        <div key={cat}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{cat}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {badges.filter((b) => b.category === cat).map((badge) => {
              const isEarned = earned.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`relative group rounded-xl border p-4 text-center transition-all duration-200 ${
                    isEarned
                      ? 'bg-gradient-to-b from-[#1A1A2E] to-[#2A1A3E] border-gold/30 hover:border-gold'
                      : 'bg-[#1A1A2E] border-gray-800 hover:border-gray-600 opacity-60'
                  }`}
                >
                  <div className={`text-3xl mb-2 transition-transform duration-200 group-hover:scale-110 ${isEarned ? '' : 'grayscale'}`}>
                    {badge.icon}
                  </div>
                  <div className={`text-xs font-semibold ${isEarned ? 'text-white' : 'text-gray-500'}`}>{badge.name}</div>
                  {isEarned && <div className="text-[10px] text-gold mt-1">+{badge.xpReward} XP</div>}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                    {badge.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
