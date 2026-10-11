import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { rgApi, type RGSettings } from '@/services/responsibleGaming';
import { requestError } from '@/services/feedback';

const EXCLUSION_OPTIONS = [
  { label: '24 heures', days: 1 },
  { label: '3 jours', days: 3 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
];

export default function ResponsibleGamingPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<RGSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [excludeModal, setExcludeModal] = useState(false);
  const [excludeDays, setExcludeDays] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    rgApi.getSettings().then(data => { if (active) setSettings(data); })
      .catch(err => { if (active) setError(requestError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const refreshSettings = async () => {
    const s = await rgApi.getSettings();
    setSettings(s);
  };

  const handleSaveDeposit = async () => {
    if (!settings) return;
    setSaving(true); setError(''); setSaved('');
    try {
      await rgApi.updateDepositLimit(
        settings.depositLimit.daily,
        settings.depositLimit.weekly,
        settings.depositLimit.monthly,
      );
      await refreshSettings();
      setSaved(`${t('rg.depositLimits')} : reglages enregistres.`);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleSaveLoss = async () => {
    if (!settings) return;
    setSaving(true);
    setError(''); setSaved('');
    try {
      await rgApi.updateLossLimit(
        settings.lossLimit.daily,
        settings.lossLimit.weekly,
        settings.lossLimit.monthly,
      );
      await refreshSettings();
      setSaved(`${t('rg.lossLimits')} : reglages enregistres.`);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleSaveSession = async () => {
    if (!settings) return;
    setSaving(true);
    setError(''); setSaved('');
    try {
      await rgApi.updateSessionLimit(settings.sessionLimit.minutes);
      await refreshSettings();
      setSaved(`${t('rg.sessionLimit')} : reglages enregistres.`);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleExclude = async () => {
    if (!excludeDays) return;
    setSaving(true);
    setError(''); setSaved('');
    try {
      await rgApi.setSelfExclusion(excludeDays);
      await refreshSettings();
      setSaved(`${t('rg.selfExclusion')} : reglages enregistres.`);
      setExcludeModal(false);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleCancelExclusion = async () => {
    setSaving(true);
    setError(''); setSaved('');
    try {
      await rgApi.cancelSelfExclusion();
      await refreshSettings();
      setSaved(`${t('rg.selfExclusion')} : reglages enregistres.`);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleRealityCheck = async (interval: number) => {
    setSaving(true);
    setError(''); setSaved('');
    try {
      await rgApi.enableRealityCheck(interval);
      await refreshSettings();
      setSaved(`${t('rg.realityCheck')} : reglages enregistres.`);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="min-w-0 space-y-6 max-w-5xl mx-auto">
        <PageHeader title={t('rg.title')} eyebrow="Un espace pour vous" description="Fixez vos limites, prenez une pause et trouvez de l'aide. Le jeu doit rester un loisir." backTo="/profile" />
        <div className="rounded-xl border border-[#7aab8f]/25 bg-[#7aab8f]/5 p-5 text-sm leading-relaxed text-[#c0d6c8]">
          Ces reglages concernent votre temps et vos GC virtuels. Aucune limite n'est un objectif a atteindre.
        </div>
        {error && !excludeModal && <p role="alert" className="casino-panel p-4 text-sm text-error">{error}</p>}
        {saved && <p role="status" className="rounded-xl border border-[#7aab8f]/25 p-4 text-sm text-[#c0d6c8]">{saved}</p>}
        {loading ? <p role="status" className="casino-panel p-6 text-gray-400">{t('common.loading')}</p> : !settings ? (
          <div className="casino-empty casino-panel space-y-3 p-6"><p className="text-sm text-gray-400">Vos reglages ne sont pas disponibles. Aucun changement n'a ete applique.</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</Button></div>
        ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
        <section className="casino-panel space-y-4 p-5 sm:p-6">
          <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('rg.depositLimits')}</h2>
          <p className="text-xs leading-relaxed text-gray-400">Plafonds en GC. Un champ vide signifie qu'aucune limite n'est definie pour cette periode.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input id="depositDaily" label={t('rg.daily')} type="number" value={String(settings?.depositLimit.daily ?? '')} onChange={e => setSettings(s => s ? { ...s, depositLimit: { ...s.depositLimit, daily: Number(e.target.value) || undefined } } : s)} />
            <Input id="depositWeekly" label={t('rg.weekly')} type="number" value={String(settings?.depositLimit.weekly ?? '')} onChange={e => setSettings(s => s ? { ...s, depositLimit: { ...s.depositLimit, weekly: Number(e.target.value) || undefined } } : s)} />
            <Input id="depositMonthly" label={t('rg.monthly')} type="number" value={String(settings?.depositLimit.monthly ?? '')} onChange={e => setSettings(s => s ? { ...s, depositLimit: { ...s.depositLimit, monthly: Number(e.target.value) || undefined } } : s)} />
          </div>
          <Button variant="outline" onClick={handleSaveDeposit} disabled={saving}>{saving ? t('common.loading') : t('rg.save')}</Button>
        </section>

        <section className="casino-panel space-y-4 p-5 sm:p-6">
          <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('rg.lossLimits')}</h2>
          <p className="text-xs leading-relaxed text-gray-400">Plafonds de perte en GC. Un champ vide signifie qu'aucune limite n'est definie pour cette periode.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input id="lossDaily" label={t('rg.daily')} type="number" value={String(settings?.lossLimit.daily ?? '')} onChange={e => setSettings(s => s ? { ...s, lossLimit: { ...s.lossLimit, daily: Number(e.target.value) || undefined } } : s)} />
            <Input id="lossWeekly" label={t('rg.weekly')} type="number" value={String(settings?.lossLimit.weekly ?? '')} onChange={e => setSettings(s => s ? { ...s, lossLimit: { ...s.lossLimit, weekly: Number(e.target.value) || undefined } } : s)} />
            <Input id="lossMonthly" label={t('rg.monthly')} type="number" value={String(settings?.lossLimit.monthly ?? '')} onChange={e => setSettings(s => s ? { ...s, lossLimit: { ...s.lossLimit, monthly: Number(e.target.value) || undefined } } : s)} />
          </div>
          <Button variant="outline" onClick={handleSaveLoss} disabled={saving}>{saving ? t('common.loading') : t('rg.save')}</Button>
        </section>

        <section className="casino-panel space-y-4 p-5 sm:p-6">
          <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('rg.sessionLimit')}</h2>
          <p className="text-xs leading-relaxed text-gray-400">Votre temps de jeu maximal par jour. Un champ vide signifie qu'aucune limite n'est definie.</p>
          <Input id="sessionMinutes" label={t('rg.minutes')} type="number" value={String(settings?.sessionLimit.minutes ?? '')} onChange={e => setSettings(s => s ? { ...s, sessionLimit: { ...s.sessionLimit, minutes: Number(e.target.value) || undefined } } : s)} />
          <Button variant="outline" onClick={handleSaveSession} disabled={saving}>{saving ? t('common.loading') : t('rg.save')}</Button>
        </section>

        <section className="casino-panel space-y-4 p-5 sm:p-6">
          <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('rg.realityCheck')}</h2>
          <p className="text-xs leading-relaxed text-gray-400">Choisissez la frequence des rappels pour faire le point sur votre temps de jeu.</p>
          <div className="flex gap-2 flex-wrap">
            {[15, 30, 60, 120].map(min => (
              <Button
                key={min}
                variant="ghost"
                aria-pressed={settings.realityCheck.enabled && settings.realityCheck.intervalMinutes === min}
                className={`min-h-11 border ${settings.realityCheck.enabled && settings.realityCheck.intervalMinutes === min ? 'border-[#7aab8f]/60 bg-[#7aab8f]/10 !text-[#c0d6c8]' : 'border-white/15'}`}
                onClick={() => handleRealityCheck(min)}
                disabled={saving}
              >
                {min} min
              </Button>
            ))}
          </div>
          {settings?.realityCheck.enabled && (
            <p className="text-sm text-gray-400">
              {t('rg.realityCheck')} actif toutes les {settings.realityCheck.intervalMinutes} minutes
            </p>
          )}
        </section>
        </div>
        <aside className="min-w-0 space-y-5">

        <section className="casino-panel space-y-4 border-t-2 border-t-[#7aab8f]/50 p-5 sm:p-6">
          <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('rg.selfExclusion')}</h2>
          <p className="text-sm leading-relaxed text-gray-400">Prenez une pause en bloquant votre acces aux jeux pendant la duree choisie.</p>
          {settings?.selfExclusion.enabled ? (
            <div className="space-y-3">
              <p className="text-[#c0d6c8] font-medium">
                {t('rg.excludeUntil')} {settings.selfExclusion.until ? new Date(settings.selfExclusion.until).toLocaleDateString('fr-FR') : ''}
              </p>
              <Button variant="outline" fullWidth onClick={handleCancelExclusion} disabled={saving}>
                {t('rg.cancelExclude')}
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="outline" fullWidth onClick={() => { setExcludeDays(0); setError(''); setExcludeModal(true); }} disabled={saving}>
                {t('rg.exclude')}
              </Button>
            </div>
          )}
        </section>
        </aside>
        </div>
        )}

        <section className="casino-panel space-y-3 p-5 sm:p-6 text-sm text-gray-400">
          <h2 className="text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('rg.helpTitle')}</h2>
          <p>{t('rg.helpText')}</p>
          <ul className="space-y-1">
            <li className="flex flex-wrap items-center gap-x-3"><a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[#c0d6c8] hover:underline">Joueurs Info Service</a><a href="tel:+33974751313" className="inline-flex min-h-11 items-center text-[#c0d6c8] hover:underline">09 74 75 13 13</a></li>
            <li><a href="https://www.sos-jeu.org" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[#c0d6c8] hover:underline">SOS Joueurs</a></li>
            <li><a href="https://www.anpjj.org" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[#c0d6c8] hover:underline">ANPJJ</a></li>
          </ul>
        </section>

        <Modal isOpen={excludeModal} onClose={() => setExcludeModal(false)} title={t('rg.excludeTitle')}>
          <div className="space-y-4">
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            <p className="text-gray-300">{t('rg.excludeChoose')}</p>
            <p className="text-sm leading-relaxed text-gray-400">Pendant cette periode, l'acces aux jeux sera bloque. Verifiez la duree avant de confirmer.</p>
            <div className="grid grid-cols-1 gap-2">
              {EXCLUSION_OPTIONS.map(opt => (
                <Button
                  key={opt.days}
                  variant="ghost"
                  aria-pressed={excludeDays === opt.days}
                  className={`min-h-11 border ${excludeDays === opt.days ? 'border-[#7aab8f]/60 bg-[#7aab8f]/10 !text-[#c0d6c8]' : 'border-white/15'}`}
                  onClick={() => setExcludeDays(opt.days)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button variant="ghost" fullWidth onClick={() => { setExcludeModal(false); setExcludeDays(0); }}>
                {t('rg.cancel')}
              </Button>
              <Button variant="outline" fullWidth onClick={handleExclude} disabled={!excludeDays || saving}>
                {t('rg.confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
