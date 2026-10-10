import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { adminApi, economyDefaults, parseSettingValue } from '@/services/admin';
import { requestError } from '@/services/feedback';
import type { SystemSetting } from '@/types';

export default function AdminEconomyPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(false);

  const settingDefaults: Record<string, { label: string; type: string; default: any }> = {
    welcome_bonus: { label: t('admin.welcomeBonus'), type: 'number', default: 5000 },
    daily_reward_base: { label: t('admin.dailyRewardBase'), type: 'number', default: 1000 },
    daily_reward_streak_7: { label: t('admin.dailyRewardStreak7'), type: 'number', default: 2500 },
    daily_reward_streak_30: { label: t('admin.dailyRewardStreak30'), type: 'number', default: 10000 },
    competition_prize_first: { label: t('admin.compPrizeFirst'), type: 'number', default: 2500 },
    competition_prize_second: { label: t('admin.compPrizeSecond'), type: 'number', default: 1500 },
    competition_prize_third: { label: t('admin.compPrizeThird'), type: 'number', default: 1000 },
    task_reward_base: { label: t('admin.taskRewardBase'), type: 'number', default: 250 },
    task_reward_all: { label: t('admin.taskRewardAll'), type: 'number', default: 1000 },
    default_house_edge: { label: t('admin.defaultHouseEdge'), type: 'number', default: 5 },
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

  const updateSetting = (key: string, value: any) => {
    setSettings(s => ({ ...s, [key]: value }));
    setSaved(false);
    setError('');
  };

  if (loading) {
    return <p className="text-gray-400">{t('common.loading')}</p>;
  }
  if (loadError) return <p role="alert" className="text-error">{loadError}</p>;

  const settingKeys = Object.keys(settingDefaults);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-gold">{t('admin.economySettings')}</h1>
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
      <p className="text-xs text-gray-400">{t('admin.persistDefaults')}</p>
      {error && <p role="alert" className="text-error">{error}</p>}
      {saved && <p role="status" className="text-success">{t('feedback.saved')}</p>}
      <Button variant="ghost" disabled={saving} onClick={() => { setSettings({ ...original }); setError(''); setSaved(false); }}>{t('admin.resetOriginal')}</Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-display text-white mb-4">{t('admin.bonuses')}</h2>
          <div className="space-y-3">
            {['welcome_bonus', 'daily_reward_base', 'daily_reward_streak_7', 'daily_reward_streak_30'].map(key => (
              <div key={key}>
                <label htmlFor={`economy-${key}`} className="block text-sm font-medium text-gray-300 mb-1">{settingDefaults[key].label}</label>
                <input
                  id={`economy-${key}`}
                  type="number"
                  value={settings[key] ?? settingDefaults[key].default}
                  onChange={e => updateSetting(key, parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-display text-white mb-4">{t('admin.competitions')}</h2>
          <div className="space-y-3">
            {['competition_prize_first', 'competition_prize_second', 'competition_prize_third'].map(key => (
              <div key={key}>
                <label htmlFor={`economy-${key}`} className="block text-sm font-medium text-gray-300 mb-1">{settingDefaults[key].label}</label>
                <input
                  id={`economy-${key}`}
                  type="number"
                  value={settings[key] ?? settingDefaults[key].default}
                  onChange={e => updateSetting(key, parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-display text-white mb-4">{t('admin.taskRewards')}</h2>
          <div className="space-y-3">
            {['task_reward_base', 'task_reward_all'].map(key => (
              <div key={key}>
                <label htmlFor={`economy-${key}`} className="block text-sm font-medium text-gray-300 mb-1">{settingDefaults[key].label}</label>
                <input
                  id={`economy-${key}`}
                  type="number"
                  value={settings[key] ?? settingDefaults[key].default}
                  onChange={e => updateSetting(key, parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-display text-white mb-4">{t('admin.general')}</h2>
          <div className="space-y-3">
            {['default_house_edge'].map(key => (
              <div key={key}>
                <label htmlFor={`economy-${key}`} className="block text-sm font-medium text-gray-300 mb-1">{settingDefaults[key].label}</label>
                <input
                  id={`economy-${key}`}
                  type="number"
                  step="0.1"
                  value={settings[key] ?? settingDefaults[key].default}
                  onChange={e => updateSetting(key, parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
