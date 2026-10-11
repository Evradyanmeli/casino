import { useState, useEffect, useId } from 'react';
import { progressionApi, type Badge } from '@/services/progression';
import { SlotSymbol } from '@/components/games/GameVisuals';

export function MedalGraphic({ symbol = 'STAR', value, locked = false }: { symbol?: string; value?: number; locked?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <div aria-hidden="true" className={`relative h-28 w-24 shrink-0 ${locked ? 'grayscale opacity-50' : 'drop-shadow-lg'}`}>
    <svg viewBox="0 0 100 120" className="absolute inset-0 h-full w-full">
      <defs><linearGradient id={`${id}-medal`} x2=".8" y2="1"><stop stopColor="#f5e9be" /><stop offset=".3" stopColor="#bfa16b" /><stop offset=".55" stopColor="#f1db9b" /><stop offset="1" stopColor="#79623c" /></linearGradient><radialGradient id={`${id}-face`} cx="35%" cy="25%"><stop stopColor="#344838" /><stop offset="1" stopColor="#14291f" /></radialGradient></defs>
      <path d="m25 68-7 47 21-11 12 13 2-49m-1 0 5 49 12-13 20 11-10-48" fill="#294737" stroke="#6e8067" strokeWidth="1" />
      <path d="m30 75-5 29m45-29 5 29" stroke="#bba16b" strokeWidth="2" opacity=".7" />
      <circle cx="50" cy="47" r="43" fill="#0b1218" />
      <circle cx="50" cy="44" r="42" fill={`url(#${id}-medal)`} stroke="#e7d8aa" />
      <circle cx="50" cy="44" r="36" fill="none" stroke="#7b643d" strokeWidth="2" strokeDasharray="1 3" />
      <circle cx="50" cy="44" r="31" fill={`url(#${id}-face)`} stroke="#e2c88c" />
      <path d="M22 31q8-20 30-20" fill="none" stroke="#fff8df" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      {value !== undefined && <text x="50" y="52" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600" fontSize={String(value).length > 3 ? 18 : 27} fill="#e6cc94">{value}</text>}
    </svg>
    {value === undefined && <SlotSymbol symbol={symbol} className="!absolute left-6 top-4 !h-12 !w-12" />}
  </div>;
}

function badgeRequirement(badge: Badge): string {
  const c = badge.condition;
  switch (c?.type) {
    case 'games_played': return `Jouer ${Number(c.count).toLocaleString()} parties${c.game ? ` · ${c.game}` : ''}.`;
    case 'total_won': return `Gagner ${Number(c.amount).toLocaleString()} GC ${badge.slug === 'big_win' ? 'en une partie' : 'au total'}.`;
    case 'level_reached': return `Atteindre le niveau ${Number(c.level).toLocaleString()}.`;
    case 'streak': return `Réclamer la récompense quotidienne ${Number(c.count).toLocaleString()} jours de suite.`;
    case 'vip_deposit': return `Cumuler ${Number(c.amount).toLocaleString()} GC de dépôts virtuels.`;
    default: return badge.description;
  }
}

export function BadgesDisplay() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBadges = () => Promise.all([
      progressionApi.getBadges(),
      progressionApi.getMyBadges(),
    ])
      .then(([all, mine]) => {
        setBadges(all);
        setEarned(new Set(mine.map((ub) => ub.badgeId)));
      })
      .catch(() => setError('Erreur de chargement des badges'))
      .finally(() => setLoading(false));
    fetchBadges();
    const handler = () => { setError(null); fetchBadges(); };
    window.addEventListener('xp-updated', handler);
    return () => window.removeEventListener('xp-updated', handler);
  }, []);

  if (loading) {
    return (
      <div role="status" className="casino-panel p-6 text-sm text-slate-400">Chargement de vos distinctions…</div>
    );
  }

  if (error) {
    return <div role="alert" className="casino-panel p-6 text-sm text-red-200">{error}</div>;
  }

  const categories = [...new Set(badges.map((b) => b.category))];

  return (
    <section className="casino-section min-w-0 space-y-6" aria-label="Vos distinctions">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="casino-eyebrow">La collection</p><h2 className="mt-2 text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>Vos distinctions</h2></div><p className="text-sm tabular-nums text-slate-400">{badges.filter(badge => earned.has(badge.id)).length} / {badges.length} obtenues</p></div>
      {categories.length === 0 && <p className="casino-empty casino-panel p-6 text-sm text-slate-400">Aucun badge disponible</p>}
      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="mb-3 break-words text-xs font-semibold uppercase tracking-wider text-slate-400">{cat}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {badges.filter((b) => b.category === cat).map((badge) => {
              const isEarned = earned.has(badge.id);
              return (
                <article
                  key={badge.id}
                  data-earned={isEarned}
                  className={`casino-panel flex min-w-0 flex-col items-center p-5 text-center ${isEarned ? 'ring-1 ring-[#d1b675]/25' : ''}`}
                >
                  <MedalGraphic locked={!isEarned} symbol={badge.condition?.type === 'level_reached' || badge.category === 'vip' ? 'CROWN' : badge.condition?.type === 'total_won' ? 'DIAMOND' : badge.condition?.game === 'slots' ? 'SLOT' : badge.condition?.type === 'streak' ? 'FIRE' : 'TROPHY'} />
                  <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${isEarned ? 'border-[#d1b675]/30 text-[#e6cc94]' : 'border-white/10 text-slate-400'}`}>{!isEarned && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>}{isEarned ? 'Obtenu' : 'Verrouillé'}</span>
                  <h4 className="mt-3 w-full break-words text-base text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{badge.name}</h4>
                  <p className="mb-4 mt-2 w-full break-words text-xs leading-relaxed text-slate-400">{badgeRequirement(badge)}</p>
                  <p className="mt-auto w-full break-words border-t border-white/10 pt-3 text-xs tabular-nums text-[#baa16b]">{badge.xpReward.toLocaleString()} XP · {isEarned ? 'distinction obtenue' : 'à l’obtention'}</p>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
