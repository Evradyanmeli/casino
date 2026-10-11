import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion, setReducedMotion } from './GameVisuals';
import { Star } from 'lucide-react';

export default function GameHeader({ title, eyebrow, description, onBack, children }: {
  title: string; eyebrow?: string; description?: string; onBack?: () => void; children?: ReactNode;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reduced); }, [reduced]);
  const systemReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return <header className="casino-game-header">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      {onBack && <button onClick={onBack} className="casino-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>{t('casino.back', 'Retour au salon')}</button>}
      <button type="button" className="casino-motion" aria-pressed={reduced} disabled={systemReduced}
        title={systemReduced ? t('casino.systemMotion', 'Preference de votre appareil') : undefined}
        onClick={() => setReducedMotion(!reduced)}><Star className="h-3.5 w-3.5" aria-hidden="true" />{reduced ? t('casino.reducedMotion', 'Mouvement reduit') : t('casino.fullMotion', 'Animations actives')}</button>
    </div>
    <div className="mt-5 flex min-w-0 flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="casino-eyebrow">{eyebrow}</p>}
        <h1 className="casino-title">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">{description}</p>}
      </div>
      {children && <div className="flex min-w-0 flex-wrap gap-2">{children}</div>}
    </div>
  </header>;
}
