import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PageHeader({ title, eyebrow, description, children, backTo }: {
  title: string; eyebrow?: string; description?: string; children?: ReactNode; backTo?: string;
}) {
  const { t } = useTranslation();
  return <header className="casino-page-header">
    {backTo && <Link to={backTo} className="casino-back mb-4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>{t('casino.back')}</Link>}
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 flex-1 basis-52">
        {eyebrow && <p className="casino-eyebrow">{eyebrow}</p>}
        <h1 className="casino-title">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>}
      </div>
      {children && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">{children}</div>}
    </div>
  </header>;
}
