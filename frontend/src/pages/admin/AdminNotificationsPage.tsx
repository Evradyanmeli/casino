import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { adminApi } from '@/services/admin';
import { requestError } from '@/services/feedback';

export default function AdminNotificationsPage() {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('announcement');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title || !content) return;
    setSending(true);
    setSent(false);
    setError('');
    try {
      await adminApi.createAnnouncement(title, content, type);
      setSent(true);
      setTitle('');
      setContent('');
      setType('announcement');
    } catch (err) {
      setError(`${requestError(err)} ${t('admin.deliveryUnknown')}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display text-gold">{t('admin.publishNotification')}</h1>

      <div className="card space-y-4">
        <div>
          <label htmlFor="announcement-type" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.type')}</label>
          <select
            id="announcement-type"
            value={type}
            onChange={e => setType(e.target.value)}
            className="input-field text-sm"
          >
            <option value="announcement">{t('admin.announcement')}</option>
            <option value="promotion">{t('admin.promotion')}</option>
            <option value="system">{t('admin.system')}</option>
          </select>
        </div>

        <Input
          id="title"
          label={t('admin.title')}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setSent(false); }}
          placeholder={t('admin.notificationTitlePlaceholder')}
        />

        <div>
          <label htmlFor="announcement-content" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.content')}</label>
          <textarea
            id="announcement-content"
            value={content}
            onChange={e => { setContent(e.target.value); setSent(false); }}
            rows={5}
            placeholder={t('admin.notificationContentPlaceholder')}
            className="input-field resize-none"
          />
        </div>

        {error && <p role="alert" className="text-error text-sm">{error}</p>}
        <Button onClick={handleSend} disabled={sending || !title.trim() || !content.trim()} fullWidth>
          {sending ? t('common.sending') : sent ? t('admin.sent') : t('admin.sendToAll')}
        </Button>

        {sent && (
          <p role="status" className="text-success text-sm text-center">{t('admin.notificationSent')}</p>
        )}
      </div>
    </div>
  );
}
