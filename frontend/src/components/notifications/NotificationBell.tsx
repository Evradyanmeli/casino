import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { notificationsApi, type Notification } from '@/services/notifications';
import { useNotificationStore } from '@/store/notificationStore';
import { requestError } from '@/services/feedback';

export default function NotificationBell() {
  const { t } = useTranslation();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addToast = useNotificationStore((s) => s.addToast);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: 0, width: 320 });

  const fetchUnread = async () => {
    try {
      const { count } = await notificationsApi.getUnreadCount();
      setUnread(count);
    } catch (err) {
      setError(requestError(err));
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationsApi.getNotifications(10);
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch (err) {
      setError(requestError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const positionPopover = () => {
      const rect = dropdownRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 32);
      const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
      setPosition({ left: left - rect.left, width });
    };
    positionPopover();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); dropdownRef.current?.querySelector('button')?.focus(); }
    };
    window.addEventListener('resize', positionPopover);
    document.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('resize', positionPopover); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    if (reading) return;
    setReading('all');
    setError('');
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      addToast({ type: 'info', title: t('notifications.markAllRead') });
    } catch (err) { setError(requestError(err)); }
    finally { setReading(null); }
  };

  const handleRead = async (n: Notification) => {
    if (n.read || reading) return;
    setReading(n.id);
    setError('');
    try {
      await notificationsApi.markAsRead(n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      setUnread(prev => Math.max(0, prev - 1));
    } catch (err) { setError(requestError(err)); }
    finally { setReading(null); }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative text-gray-400 hover:text-gold transition-colors"
        title={t('nav.notifications')}
        aria-label={t('nav.notifications')}
        aria-expanded={open}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-error text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={position} className="absolute mt-3 bg-[#1A1A2E] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="text-white font-display text-sm font-semibold">{t('nav.notifications')}</h3>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={!!reading}
                className="text-xs text-accent hover:text-white transition-colors"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {error && <p role="alert" className="text-error text-xs p-3">{error}</p>}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : error && notifications.length === 0 ? null : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-500">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm">{t('notifications.empty')}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  disabled={!!reading}
                  className={`block w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-[#252540] transition-colors cursor-pointer ${n.read ? 'opacity-60' : ''}`}
                  onClick={() => handleRead(n)}
                >
                  <p className="text-white text-sm font-medium break-words">{n.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5 break-words">{n.message}</p>
                  <p className="text-gray-600 text-[10px] mt-1">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
