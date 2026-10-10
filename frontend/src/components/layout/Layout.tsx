import type { ReactNode } from 'react';
import Header from './Header';
import NotificationToast from '@/components/notifications/NotificationToast';
import ChatWidget from '@/components/chat/ChatWidget';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <Header />
      <main className="min-w-0 pt-20 pb-8 px-4 max-w-7xl mx-auto">
        {children}
      </main>
      <NotificationToast />
      <ChatWidget />
    </div>
  );
}
