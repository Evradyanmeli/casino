import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import NotificationToast from '@/components/notifications/NotificationToast';
import ChatWidget from '@/components/chat/ChatWidget';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="player-shell min-h-screen bg-[#0D0D1A]">
      <Header />
      <main className="min-w-0 pt-24 pb-20 px-3 sm:px-6 max-w-7xl mx-auto">
        {children}
        <ChatWidget inline />
        <p className="mt-10 border-t border-white/5 pt-5 text-center text-xs leading-relaxed text-slate-500">{t('casino.disclaimer')}</p>
      </main>
      <NotificationToast />
    </div>
  );
}
