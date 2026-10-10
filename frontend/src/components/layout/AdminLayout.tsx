import type { ReactNode } from 'react';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { BarChart3, Users, Gamepad2, Wallet, Settings, ClipboardList, MessageSquare, Bell } from 'lucide-react';

const adminIcons: Record<string, React.ReactNode> = {
  dashboard: <BarChart3 className="w-4 h-4" />,
  users: <Users className="w-4 h-4" />,
  games: <Gamepad2 className="w-4 h-4" />,
  economy: <Wallet className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  audit: <ClipboardList className="w-4 h-4" />,
  chat: <MessageSquare className="w-4 h-4" />,
  notifications: <Bell className="w-4 h-4" />,
};

const navItems = [
  { to: '/admin/dashboard', labelKey: 'admin.dashboard', icon: 'dashboard' },
  { to: '/admin/users', labelKey: 'admin.users', icon: 'users' },
  { to: '/admin/games', labelKey: 'admin.games', icon: 'games' },
  { to: '/admin/economy', labelKey: 'admin.economy', icon: 'economy' },
  { to: '/admin/settings', labelKey: 'admin.settings', icon: 'settings' },
  { to: '/admin/audit', labelKey: 'admin.audit', icon: 'audit' },
  { to: '/admin/chat', labelKey: 'admin.chat', icon: 'chat' },
  { to: '/admin/notifications', labelKey: 'admin.notifications', icon: 'notifications' },
];

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">{t('admin.noAccess')}</p>
          <button onClick={() => navigate('/lobby')} className="text-gold hover:underline text-sm">
            {t('common.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  const navigation = (
    <>
        <div className="p-4 border-b border-gray-800">
          <NavLink to="/admin/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-display font-bold text-gold tracking-wider">ADMIN</span>
            <span className="text-xs text-gray-500">panel</span>
          </NavLink>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gold/10 text-gold border border-gold/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#232340]'
                }`
              }
            >
              <span className="text-gray-400">{adminIcons[item.icon]}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 space-y-3">
          <NavLink
            to="/lobby"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('nav.lobby')}
          </NavLink>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-error transition-colors w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('nav.logout')}
          </button>
        </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0D0D1A] admin-shell">
      <aside className="hidden md:flex w-64 bg-[#1A1A2E] border-r border-gray-800 flex-col fixed inset-y-0 z-30">{navigation}</aside>
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-800">
        <span className="font-display text-gold">{t('admin.title')}</span>
        <button onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} className="text-gold border border-gray-700 rounded px-3 py-2">{t('common.menu')}</button>
      </div>
      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title={t('common.menu')}>
        <div className="flex flex-col">{navigation}</div>
      </Modal>
      <main className="md:ml-64 min-w-0 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
