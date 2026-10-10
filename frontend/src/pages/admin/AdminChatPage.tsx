import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { adminApi } from '@/services/admin';
import type { ChatMessageFull } from '@/types';
import Modal from '@/components/ui/Modal';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-gold">{t('admin.chatModeration')}</h1>
        <div className="flex gap-2">
          <input
            aria-label={t('admin.filterRoom')}
            type="text"
            value={room}
            onChange={e => setRoom(e.target.value)}
            placeholder={t('admin.filterRoom')}
            className="input-field text-sm py-2 w-40"
          />
          <Button variant="ghost" onClick={fetchMessages} className="text-xs py-2">
            {t('admin.refresh')}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">{t('common.loading')}</p>
      ) : error ? <p role="alert" className="text-error">{error}</p> : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('admin.noMessages')}</p>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className="card py-3 px-4 flex flex-wrap items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-secondary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {msg.user?.pseudo?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{msg.user?.pseudo || t('admin.unknown')}</span>
                    <span className="text-xs text-gray-500">{msg.room}</span>
                    <span className="text-xs text-gray-600">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1 break-words">{msg.content}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="ghost" onClick={() => { setActionError(''); setPending({ kind: 'delete', id: msg.id }); }} className="text-xs py-1 px-2 text-error">
                    {t('admin.delete')}
                  </Button>
                  <Button variant="ghost" onClick={() => { setActionError(''); setPending({ kind: 'ban', id: msg.userId }); }} className="text-xs py-1 px-2">
                    {t('admin.ban')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <Modal isOpen={!!pending} onClose={() => setPending(null)} title={pending?.kind === 'delete' ? t('admin.delete') : t('admin.ban')}>
        <p className="text-gray-300 mb-4">{t('admin.confirmModeration')}</p>
        {actionError && <p role="alert" className="text-error mb-3">{actionError}</p>}
        <Button disabled={saving} onClick={handleConfirm}>{t('common.confirm')}</Button>
      </Modal>
    </div>
  );
}
