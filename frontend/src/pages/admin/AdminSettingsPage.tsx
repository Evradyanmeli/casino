import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { adminApi, economyDefaults, parseSettingValue } from '@/services/admin';
import { requestError } from '@/services/feedback';
import type { SystemSetting } from '@/types';

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<{ key: string; value: unknown } | null>(null);
  const labels: Record<string, string> = {
    welcome_bonus: t('admin.welcomeBonus'), daily_reward_base: t('admin.dailyRewardBase'),
    daily_reward_streak_7: t('admin.dailyRewardStreak7'), daily_reward_streak_30: t('admin.dailyRewardStreak30'),
    competition_prize_first: t('admin.compPrizeFirst'), competition_prize_second: t('admin.compPrizeSecond'),
    competition_prize_third: t('admin.compPrizeThird'), default_house_edge: t('admin.defaultHouseEdge'),
  };

  useEffect(() => {
    setLoading(true);
    adminApi.getSettings().then(setSettings).catch(err => setLoadError(requestError(err))).finally(() => setLoading(false));
  }, []);

  const prepareSave = () => {
    setError('');
    setSaved(false);
    const key = newSettingKey.trim();
    if (!settings.some(s => s.key === key) && !Object.hasOwnProperty.call(economyDefaults, key)) {
      setError(t('admin.unknownSetting', { defaultValue: 'Choose an existing or supported economy setting.' }));
      return;
    }
    try { setPending({ key, value: parseSettingValue(key, newSettingValue) }); }
    catch { setError(t('admin.invalidJson', { defaultValue: 'Enter a valid JSON value within the supported limits.' })); }
  };

  const handleAddSetting = async () => {
    if (!pending) return;
    setSaving(true);
    setError('');
    try {
      await adminApi.updateSetting(pending.key, pending.value);
      setSettings(current => [...current.filter(s => s.key !== pending.key), { ...pending }]);
      setNewSettingKey('');
      setNewSettingValue('');
      setPending(null);
      setSaved(true);
    } catch (err) { setError(requestError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.systemSettings')} eyebrow="Administration" />

      {loading ? (
        <p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p>
      ) : loadError ? <p role="alert" className="casino-panel p-5 break-words text-error">{loadError}</p> : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {settings.map(s => (
            <div key={s.key} className="casino-panel min-w-0 p-5">
              <div className="min-w-0 break-words">
                <h2 className="text-white text-sm font-medium">{labels[s.key] || s.key}</h2>
                <p className="mt-1 text-gray-400 text-xs break-all">{s.key}</p>
                <p className="mt-3 text-[#e6cc94] text-sm tabular-nums break-all">{JSON.stringify(s.value)}</p>
              </div>
            </div>
          ))}
          {settings.length === 0 && <p className="casino-empty text-gray-400">{t('admin.noSettings')}</p>}
        </div>
      )}

      <div className="casino-panel p-5 sm:p-6 space-y-4">
        <h2 className="casino-section text-xl" style={{ fontFamily: 'Georgia, serif' }}>{t('admin.addSetting')}</h2>
        <p className="text-xs text-gray-400">{t('admin.jsonHelp', { defaultValue: 'Use an existing key and a valid JSON value. Review the change before applying it.' })}</p>
        <Input id="key" label={t('admin.key')} list="setting-keys" type="text" value={newSettingKey} onChange={e => { setNewSettingKey(e.target.value); setSaved(false); setError(''); }} />
        <datalist id="setting-keys">{[...new Set([...Object.keys(economyDefaults), ...settings.map(s => s.key)])].map(key => <option key={key} value={key} />)}</datalist>
        <Input id="value" label={`${t('admin.value')} (JSON)`} type="text" value={newSettingValue} onChange={e => { setNewSettingValue(e.target.value); setSaved(false); setError(''); }} />
        {error && !pending && <p role="alert" className="text-error">{error}</p>}
        {saved && <p role="status" className="text-success">{t('feedback.saved', { defaultValue: 'Changes saved.' })}</p>}
        <Button onClick={prepareSave} disabled={loading || !!loadError || !newSettingKey || saving}>{t('common.save')}</Button>
      </div>
      <Modal isOpen={!!pending} onClose={() => setPending(null)} title={t('admin.confirmSetting', { defaultValue: 'Confirm setting change' })}>
        <p className="max-h-[40dvh] overflow-y-auto text-gray-300 break-all mb-3">{pending?.key}: {JSON.stringify(pending?.value)}</p>
        <p className="text-xs text-gray-400 mb-4">{t('admin.settingWarning', { defaultValue: 'This change applies to the live virtual economy. Check the key and value before confirming.' })}</p>
        {error && <p role="alert" className="text-error mb-3">{error}</p>}
        <Button onClick={handleAddSetting} disabled={saving}>{saving ? t('admin.saving') : t('common.confirm')}</Button>
      </Modal>
    </div>
  );
}
