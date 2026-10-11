import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
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
      setError(`${requestError(err)} ${t('admin.deliveryUnknown', { defaultValue: 'Delivery status is unknown. Verify before sending again.' })}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6 max-w-3xl">
      <PageHeader title={t('admin.publishNotification')} eyebrow="Administration" />

      <div className="casino-panel p-5 sm:p-6 space-y-5">
        <div>
          <label htmlFor="announcement-type" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.type')}</label>
          <select
            id="announcement-type"
            value={type}
            onChange={e => setType(e.target.value)}
            className="input-field min-h-11 text-sm"
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
            className="input-field min-h-40 resize-y"
          />
        </div>

        {error && <p role="alert" className="text-error text-sm">{error}</p>}
        <Button onClick={handleSend} disabled={sending || !title.trim() || !content.trim()} fullWidth>
          {sending ? t('admin.sending') : sent ? t('admin.sent') : t('admin.sendToAll')}
        </Button>

        {sent && (
          <p role="status" className="text-success text-sm text-center">{t('admin.notificationSent')}</p>
        )}
      </div>
    </div>
  );
}
