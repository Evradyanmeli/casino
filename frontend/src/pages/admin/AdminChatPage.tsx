import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { adminApi } from '@/services/admin';
import type { ChatMessageFull } from '@/types';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { requestError } from '@/services/feedback';

export default function AdminChatPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessageFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState<{ kind: 'delete' | 'ban'; id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const fetchMessages = () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    adminApi.getChatMessages(room || undefined)
      .then(data => { if (id === requestId.current) setMessages(data); })
      .catch(err => { if (id === requestId.current) setError(requestError(err)); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  };

  useEffect(() => { fetchMessages(); return () => { ++requestId.current; }; }, [room]);

  const handleConfirm = async () => {
    if (!pending) return;
    setSaving(true);
    setActionError('');
    try {
      if (pending.kind === 'delete') {
        await adminApi.deleteChatMessage(pending.id);
        setMessages(current => current.filter(m => m.id !== pending.id));
      } else {
        await adminApi.banUserFromChat(pending.id);
        setMessages(current => current.filter(m => m.userId !== pending.id));
      }
      setPending(null);
    } catch (err) { setActionError(requestError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title={t('admin.chatModeration')} eyebrow="Administration" />
        <div className="casino-panel flex flex-wrap items-end gap-3 p-4 sm:p-5">
          <label htmlFor="chat-room" className="min-w-0 flex-1 space-y-2 text-sm text-gray-300"><span className="block">{t('admin.filterRoom')}</span>
          <input
            id="chat-room"
            type="text"
            value={room}
            onChange={e => setRoom(e.target.value)}
            placeholder={t('admin.filterRoom')}
            className="input-field min-h-11 min-w-0 w-full text-sm py-2"
          />
          </label>
          <Button variant="ghost" onClick={fetchMessages} className="min-h-11 text-sm">
            {t('admin.refresh')}
          </Button>
        </div>

      {loading ? (
        <p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p>
      ) : error ? <p role="alert" className="casino-panel p-5 break-words text-error">{error}</p> : (
        <div className="space-y-3 max-h-[70dvh] overflow-y-auto overscroll-contain">
          {messages.length === 0 ? (
            <p className="casino-empty text-gray-400 text-center py-8">{t('admin.noMessages')}</p>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className="casino-panel p-4 flex flex-wrap items-start gap-3">
                <div aria-hidden="true" className="w-8 h-8 rounded-full border border-[#d1b675]/20 bg-white/5 flex items-center justify-center text-xs font-semibold text-[#e6cc94] flex-shrink-0">
                  {msg.user?.pseudo?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0 basis-40">
                  <div className="flex flex-wrap items-center gap-2 break-all">
                    <span className="text-sm font-semibold text-white">{msg.user?.pseudo || t('admin.unknown')}</span>
                    <span className="text-xs text-gray-500">{msg.room}</span>
                    <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1 break-words">{msg.content}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" onClick={() => { setActionError(''); setPending({ kind: 'delete', id: msg.id }); }} className="min-h-11 text-xs px-3 text-error">
                    {t('admin.delete')}
                  </Button>
                    <Button variant="ghost" onClick={() => { setActionError(''); setPending({ kind: 'ban', id: msg.userId }); }} className="min-h-11 text-xs px-3">
                    {t('admin.ban')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <Modal isOpen={!!pending} onClose={() => setPending(null)} title={pending?.kind === 'delete' ? t('admin.delete') : t('admin.ban')}>
        <p className="text-gray-300 mb-4">{t('admin.confirmModeration', { defaultValue: 'Confirm this moderation action?' })}</p>
        {actionError && <p role="alert" className="text-error mb-3">{actionError}</p>}
        <Button disabled={saving} onClick={handleConfirm}>{t('common.confirm')}</Button>
      </Modal>
    </div>
  );
}
