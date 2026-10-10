import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
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

  useEffect(() => {
    rgApi.getSettings().then(setSettings).catch(err => setError(requestError(err))).finally(() => setLoading(false));
  }, []);

  const refreshSettings = async () => {
    const s = await rgApi.getSettings();
    setSettings(s);
  };

  const handleSaveDeposit = async () => {
    if (!settings) return;
    setSaving(true); setError('');
    try {
      await rgApi.updateDepositLimit(
        settings.depositLimit.daily,
        settings.depositLimit.weekly,
        settings.depositLimit.monthly,
      );
      await refreshSettings();
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleSaveLoss = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await rgApi.updateLossLimit(
        settings.lossLimit.daily,
        settings.lossLimit.weekly,
        settings.lossLimit.monthly,
      );
      await refreshSettings();
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleSaveSession = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await rgApi.updateSessionLimit(settings.sessionLimit.minutes);
      await refreshSettings();
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleExclude = async () => {
    if (!excludeDays) return;
    setSaving(true);
    try {
      await rgApi.setSelfExclusion(excludeDays);
      await refreshSettings();
      setExcludeModal(false);
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleCancelExclusion = async () => {
    setSaving(true);
    try {
      await rgApi.cancelSelfExclusion();
      await refreshSettings();
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  const handleRealityCheck = async (interval: number) => {
    setSaving(true);
    try {
      await rgApi.enableRealityCheck(interval);
      await refreshSettings();
    } catch (err) { setError(requestError(err)); } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <p className="text-gray-400">{t('common.loading')}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gold transition-colors text-sm">
          ← Retour
        </button>
        <h1 className="text-2xl font-display text-gold">{t('rg.title')}</h1>
        {error && <p role="alert" className="text-error">{error}</p>}

        <div className="card space-y-4">
          <h2 className="text-lg font-display text-white">{t('rg.depositLimits')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <Input id="depositDaily" label={t('rg.daily')} type="number" value={String(settings?.depositLimit.daily ?? '')} onChange={e => setSettings(s => s ? { ...s, depositLimit: { ...s.depositLimit, daily: Number(e.target.value) || undefined } } : s)} />
            <Input id="depositWeekly" label={t('rg.weekly')} type="number" value={String(settings?.depositLimit.weekly ?? '')} onChange={e => setSettings(s => s ? { ...s, depositLimit: { ...s.depositLimit, weekly: Number(e.target.value) || undefined } } : s)} />
            <Input id="depositMonthly" label={t('rg.monthly')} type="number" value={String(settings?.depositLimit.monthly ?? '')} onChange={e => setSettings(s => s ? { ...s, depositLimit: { ...s.depositLimit, monthly: Number(e.target.value) || undefined } } : s)} />
          </div>
          <Button onClick={handleSaveDeposit} disabled={saving}>{t('rg.save')}</Button>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-display text-white">{t('rg.lossLimits')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <Input id="lossDaily" label={t('rg.daily')} type="number" value={String(settings?.lossLimit.daily ?? '')} onChange={e => setSettings(s => s ? { ...s, lossLimit: { ...s.lossLimit, daily: Number(e.target.value) || undefined } } : s)} />
            <Input id="lossWeekly" label={t('rg.weekly')} type="number" value={String(settings?.lossLimit.weekly ?? '')} onChange={e => setSettings(s => s ? { ...s, lossLimit: { ...s.lossLimit, weekly: Number(e.target.value) || undefined } } : s)} />
            <Input id="lossMonthly" label={t('rg.monthly')} type="number" value={String(settings?.lossLimit.monthly ?? '')} onChange={e => setSettings(s => s ? { ...s, lossLimit: { ...s.lossLimit, monthly: Number(e.target.value) || undefined } } : s)} />
          </div>
          <Button onClick={handleSaveLoss} disabled={saving}>{t('rg.save')}</Button>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-display text-white">{t('rg.sessionLimit')}</h2>
          <Input id="sessionMinutes" label={t('rg.minutes')} type="number" value={String(settings?.sessionLimit.minutes ?? '')} onChange={e => setSettings(s => s ? { ...s, sessionLimit: { ...s.sessionLimit, minutes: Number(e.target.value) || undefined } } : s)} />
          <Button onClick={handleSaveSession} disabled={saving}>{t('rg.save')}</Button>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-display text-white">{t('rg.realityCheck')}</h2>
          <div className="flex gap-2 flex-wrap">
            {[15, 30, 60, 120].map(min => (
              <Button
                key={min}
                variant={settings?.realityCheck.intervalMinutes === min ? 'primary' : 'outline'}
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
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-display text-white">{t('rg.selfExclusion')}</h2>
          {settings?.selfExclusion.enabled ? (
            <div className="space-y-3">
              <p className="text-error font-semibold">
                {t('rg.excludeUntil')} {settings.selfExclusion.until ? new Date(settings.selfExclusion.until).toLocaleDateString('fr-FR') : ''}
              </p>
              <Button variant="secondary" onClick={handleCancelExclusion} disabled={saving}>
                {t('rg.cancelExclude')}
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="secondary" onClick={() => setExcludeModal(true)}>
                {t('rg.exclude')}
              </Button>
            </div>
          )}
        </div>

        <div className="card space-y-3 text-sm text-gray-400">
          <h2 className="text-lg font-display text-white">{t('rg.helpTitle')}</h2>
          <p>{t('rg.helpText')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li><a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Joueurs Info Service</a> — 09 74 75 13 13</li>
            <li><a href="https://www.sos-jeu.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">SOS Joueurs</a></li>
            <li><a href="https://www.anpjj.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">ANPJJ</a></li>
          </ul>
        </div>

        <Modal isOpen={excludeModal} onClose={() => setExcludeModal(false)} title={t('rg.excludeTitle')}>
          <div className="space-y-4">
            <p className="text-gray-300">{t('rg.excludeChoose')}</p>
            <div className="grid grid-cols-1 gap-2">
              {EXCLUSION_OPTIONS.map(opt => (
                <Button
                  key={opt.days}
                  variant={excludeDays === opt.days ? 'primary' : 'outline'}
                  onClick={() => setExcludeDays(opt.days)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" fullWidth onClick={() => { setExcludeModal(false); setExcludeDays(0); }}>
                {t('rg.cancel')}
              </Button>
              <Button fullWidth onClick={handleExclude} disabled={!excludeDays || saving}>
                {t('rg.confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
