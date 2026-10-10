import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
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

  useEffect(() => {
    setLoading(true);
    adminApi.getSettings().then(setSettings).catch(err => setLoadError(requestError(err))).finally(() => setLoading(false));
  }, []);

  const prepareSave = () => {
    setError('');
    setSaved(false);
    const key = newSettingKey.trim();
    if (!settings.some(s => s.key === key) && !Object.hasOwnProperty.call(economyDefaults, key)) {
      setError(t('admin.unknownSetting'));
      return;
    }
    try { setPending({ key, value: parseSettingValue(key, newSettingValue) }); }
    catch { setError(t('admin.invalidJson')); }
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
      <h1 className="text-2xl font-display text-gold">{t('admin.systemSettings')}</h1>

      {loading ? (
        <p className="text-gray-400">{t('common.loading')}</p>
      ) : loadError ? <p role="alert" className="text-error">{loadError}</p> : (
        <div className="space-y-2">
          {settings.map(s => (
            <div key={s.key} className="card flex justify-between items-center py-3">
              <div className="min-w-0 break-words">
                <p className="text-white font-medium">{s.key}</p>
                <p className="text-gray-400 text-xs">{JSON.stringify(s.value)}</p>
              </div>
            </div>
          ))}
          {settings.length === 0 && <p className="text-gray-500">{t('admin.noSettings')}</p>}
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">{t('admin.addSetting')}</h3>
        <p className="text-xs text-gray-400">{t('admin.jsonHelp')}</p>
        <Input id="key" label={t('admin.key')} list="setting-keys" type="text" value={newSettingKey} onChange={e => { setNewSettingKey(e.target.value); setSaved(false); setError(''); }} />
        <datalist id="setting-keys">{[...new Set([...Object.keys(economyDefaults), ...settings.map(s => s.key)])].map(key => <option key={key} value={key} />)}</datalist>
        <Input id="value" label={`${t('admin.value')} (JSON)`} type="text" value={newSettingValue} onChange={e => { setNewSettingValue(e.target.value); setSaved(false); setError(''); }} />
        {error && !pending && <p role="alert" className="text-error">{error}</p>}
        {saved && <p role="status" className="text-success">{t('feedback.saved')}</p>}
        <Button onClick={prepareSave} disabled={loading || !!loadError || !newSettingKey || saving}>{t('common.save')}</Button>
      </div>
      <Modal isOpen={!!pending} onClose={() => setPending(null)} title={t('admin.confirmSetting')}>
        <p className="text-gray-300 break-words mb-3">{pending?.key}: {JSON.stringify(pending?.value)}</p>
        <p className="text-xs text-gray-400 mb-4">{t('admin.settingWarning')}</p>
        {error && <p role="alert" className="text-error mb-3">{error}</p>}
        <Button onClick={handleAddSetting} disabled={saving}>{saving ? t('common.saving') : t('common.confirm')}</Button>
      </Modal>
    </div>
  );
}
