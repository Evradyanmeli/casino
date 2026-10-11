import { useState, useEffect, useRef, useCallback } from 'react';
import { progressionApi, type LevelProgress } from '@/services/progression';
import { MedalGraphic } from './BadgesDisplay';

export function LevelBadge() {
  const [info, setInfo] = useState<LevelProgress | null>(null);
  const [animating, setAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevLevel = useRef<number | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLevel = useCallback(() => {
    progressionApi.getLevelProgress().then((data) => {
      setError(null);
      if (prevLevel.current !== null && data.level > prevLevel.current) {
        setAnimating(true);
        if (animationTimer.current) clearTimeout(animationTimer.current);
        animationTimer.current = setTimeout(() => setAnimating(false), 2000);
      }
      prevLevel.current = data.level;
      setInfo(data);
    }).catch(() => setError('Impossible d’actualiser votre progression.'));
  }, []);

  useEffect(() => {
    fetchLevel();
    const handler = () => fetchLevel();
    window.addEventListener('xp-updated', handler);
    return () => {
      window.removeEventListener('xp-updated', handler);
      if (animationTimer.current) clearTimeout(animationTimer.current);
    };
  }, [fetchLevel]);

  if (!info) {
    return (
      <div className="casino-panel space-y-3 p-6 text-sm text-slate-400">
        {error ? <><p role="alert">{error}</p><button type="button" onClick={fetchLevel} className="min-h-11 rounded-lg border border-white/20 px-4 py-2">Actualiser la progression</button></> : <p role="status">Chargement de votre progression…</p>}
      </div>
    );
  }

  return (
    <section className={`casino-panel min-w-0 p-5 sm:p-6 ${animating ? 'ring-1 ring-[#d1b675]/60' : ''}`} aria-label="Votre niveau">
      {error && <p role="alert" className="mb-4 text-sm text-red-200">{error}</p>}
      {animating && <p role="status" className="mb-4 text-sm font-semibold text-[#e6cc94]">Niveau supérieur !</p>}
      <div className="grid min-w-0 grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <MedalGraphic value={info.level} />
          <div className="min-w-0 flex-1 basis-36">
            <p className="casino-eyebrow">Votre progression</p>
            <h2 className="mt-2 break-words text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>Niveau {info.level.toLocaleString()}</h2>
            <p className="mt-2 break-words text-xs tabular-nums text-slate-400">{info.xpInCurrentLevel.toLocaleString()} / {info.xpForNextLevel.toLocaleString()} XP dans ce niveau</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progression du niveau" aria-valuenow={Math.max(0, Math.min(info.progressPercent, 100))} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#baa16b]" style={{ width: `${Math.max(0, Math.min(info.progressPercent, 100))}%` }} />
            </div>
          </div>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div className="casino-kpi min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4"><dt className="text-xs text-slate-400">XP cumulée</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums text-[#e6cc94]">{info.xp.toLocaleString()}</dd></div>
          <div className="casino-kpi min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4"><dt className="text-xs text-slate-400">XP avant le niveau suivant</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums text-[#c5d8ca]">{Math.max(0, info.xpForNextLevel - info.xpInCurrentLevel).toLocaleString()}</dd></div>
        </dl>
      </div>
    </section>
  );
}
