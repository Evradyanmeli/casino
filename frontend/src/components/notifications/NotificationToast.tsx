import { useNotificationStore } from '@/store/notificationStore';
import { Check, X, Info, Star, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const typeStyles: Record<string, string> = {
  success: 'border-l-4 border-success bg-green-900/20',
  error: 'border-l-4 border-error bg-red-900/20',
  info: 'border-l-4 border-accent bg-blue-900/20',
  reward: 'border-l-4 border-gold bg-yellow-900/20',
};

const typeIcons: Record<string, ReactNode> = {
  success: <Check className="w-5 h-5 text-success" />,
  error: <X className="w-5 h-5 text-error" />,
  info: <Info className="w-5 h-5 text-accent" />,
  reward: <Star className="w-5 h-5 text-gold" />,
};

export default function NotificationToast() {
  const { t } = useTranslation();
  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto animate-slide-in-right bg-[#1A1A2E]/95 backdrop-blur-md border border-gray-700 rounded-lg p-4 shadow-2xl ${typeStyles[toast.type]} flex items-start gap-3`}
        >
          <span className="flex-shrink-0 mt-0.5">{typeIcons[toast.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">{toast.title}</p>
            {toast.message && (
              <p className="text-gray-400 text-xs mt-0.5">{toast.message}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label={t('common.close')}
            className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
          >
            <CircleX className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
