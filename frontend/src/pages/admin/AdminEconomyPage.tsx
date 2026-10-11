import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import { CasinoChip } from '@/components/games/GameVisuals';
import { adminApi, economyDefaults, parseSettingValue } from '@/services/admin';
import { requestError } from '@/services/feedback';
import type { SystemSetting } from '@/types';

export default function AdminEconomyPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(false);

  const labels: Record<string, string> = {
    welcome_bonus: t('admin.welcomeBonus'),
    daily_reward_base: t('admin.dailyRewardBase'),
    daily_reward_streak_7: t('admin.dailyRewardStreak7'),
    daily_reward_streak_30: t('admin.dailyRewardStreak30'),
    competition_prize_first: t('admin.compPrizeFirst'),
    competition_prize_second: t('admin.compPrizeSecond'),
    competition_prize_third: t('admin.compPrizeThird'),
    default_house_edge: t('admin.defaultHouseEdge'),
  };

  useEffect(() => {
    setLoading(true);
    adminApi.getSettings().then((s: SystemSetting[]) => {
      const map: Record<string, number> = { ...economyDefaults };
      s.forEach(setting => { if (Object.hasOwnProperty.call(economyDefaults, setting.key)) map[setting.key] = setting.value; });
      setSettings(map);
      setOriginal(map);
    }).catch(err => setLoadError(requestError(err))).finally(() => setLoading(false));
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const entries = Object.keys(economyDefaults).map(key => [key, parseSettingValue(key, String(settings[key]))] as const);
      await adminApi.updateSettings(entries.map(([key, value]) => ({ key, value })));
      setOriginal(Object.fromEntries(entries) as Record<string, number>);
      setSaved(true);
    } catch (err) { setError(requestError(err)); }
    finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(s => ({ ...s, [key]: value }));
    setSaved(false);
    setError('');
  };

  if (loading) {
    return <div className="space-y-6"><PageHeader title={t('admin.economySettings')} eyebrow="Administration" /><p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p></div>;
  }
  if (loadError) return <div className="space-y-6"><PageHeader title={t('admin.economySettings')} eyebrow="Administration" /><p role="alert" className="casino-panel p-5 break-words text-error">{loadError}</p></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.economySettings')} eyebrow="Administration" description={t('admin.persistDefaults', { defaultValue: 'Review virtual currency rewards and save to apply the displayed values.' })}>
        <Button variant="ghost" disabled={saving} onClick={() => { setSettings({ ...original }); setError(''); setSaved(false); }}>{t('admin.resetOriginal', { defaultValue: 'Reset changes' })}</Button>
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? t('admin.saving') : t('common.save')}
        </Button>
      </PageHeader>
      {error && <p role="alert" className="text-error">{error}</p>}
      {saved && <p role="status" className="text-success">{t('feedback.saved', { defaultValue: 'Changes saved.' })}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="casino-panel p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3"><h2 className="casino-section text-xl" style={{ fontFamily: 'Georgia, serif' }}>{t('admin.bonuses')}</h2><CasinoChip value="GC" color="#236750" className="opacity-60" /></div>
          <div className="space-y-3">
            {['welcome_bonus', 'daily_reward_base', 'daily_reward_streak_7', 'daily_reward_streak_30'].map(key => (
              <div key={key}>
                <Input
                  id={`economy-${key}`}
                  label={`${labels[key]} (GC)`}
                  type="number"
                  min={key === 'welcome_bonus' ? 0 : 1}
                  step="1"
                  value={settings[key] ?? economyDefaults[key]}
                  onChange={e => updateSetting(key, e.target.value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="casino-panel p-5 sm:p-6">
          <h2 className="casino-section text-xl mb-5" style={{ fontFamily: 'Georgia, serif' }}>{t('admin.competitions')}</h2>
          <div className="space-y-3">
            {['competition_prize_first', 'competition_prize_second', 'competition_prize_third'].map(key => (
              <div key={key}>
                <Input
                  id={`economy-${key}`}
                  label={`${labels[key]} (GC)`}
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  value={settings[key] ?? economyDefaults[key]}
                  onChange={e => updateSetting(key, e.target.value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="casino-panel p-5 sm:p-6 lg:col-span-2">
          <h2 className="casino-section text-xl mb-5" style={{ fontFamily: 'Georgia, serif' }}>{t('admin.general')}</h2>
          <div className="space-y-3">
            {['default_house_edge'].map(key => (
              <div key={key}>
                <Input
                  id={`economy-${key}`}
                  label={labels[key]}
                  type="number"
                  step="0.1"
                  min="0"
                  max="99.9"
                  value={settings[key] ?? economyDefaults[key]}
                  onChange={e => updateSetting(key, e.target.value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
