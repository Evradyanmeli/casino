import type { ReactNode } from 'react';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#101715] flex items-center justify-center p-4">
        <div className="casino-empty text-center">
          <p className="text-gray-400 text-lg mb-4">{t('admin.noAccess')}</p>
          <button onClick={() => navigate('/lobby')} className="min-h-11 text-gold hover:underline text-sm">
            {t('common.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  const navigation = (
    <>
        <div className="p-6 border-b border-[#d1b675]/15">
          <NavLink to="/admin/dashboard" onClick={() => setMenuOpen(false)} className="block">
            <span className="block text-2xl text-[#e6cc94]" style={{ fontFamily: 'Georgia, serif' }}>CasinoX</span>
            <span className="casino-eyebrow mt-2 block">Administration</span>
          </NavLink>
        </div>
        <nav aria-label="Administration" className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.icon === 'dashboard' && pathname === '/admin' ? '/admin' : item.to}
               end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  isActive || (item.icon === 'dashboard' && pathname === '/admin')
                    ? 'bg-[#c7a35e]/10 text-[#e6cc94] border-[#d1b675]/25'
                    : 'border-transparent text-[#a9b6af] hover:text-[#f1e7d1] hover:bg-white/5'
                }`
              }
            >
              <span aria-hidden="true">{adminIcons[item.icon]}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[#d1b675]/15 space-y-1">
          <NavLink
            to="/lobby"
            onClick={() => setMenuOpen(false)}
            className="flex min-h-11 items-center gap-2 text-sm text-gray-400 hover:text-gold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('nav.lobby')}
          </NavLink>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="flex min-h-11 items-center gap-2 text-sm text-gray-400 hover:text-error transition-colors w-full"
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
    <div className="min-h-screen bg-[#101715] text-[#f1e7d1] admin-shell" style={{ fontFamily: 'Inter, sans-serif' }}>
      <aside className="hidden lg:flex w-60 bg-[#141e19] border-r border-[#d1b675]/15 flex-col fixed inset-y-0 z-30">{navigation}</aside>
      <header className="lg:ml-60 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#d1b675]/15 bg-[#141e19] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setMenuOpen(true)} aria-label={t('common.menu', { defaultValue: 'Menu' })} aria-expanded={menuOpen} aria-haspopup="dialog" className="lg:hidden flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#d1b675]/20 text-gold"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <span className="text-sm text-[#b8c5be]">CasinoX <span className="mx-1 text-[#d1b675]/40">/</span> Administration</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86b99a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z" /><path d="m8 12 3 3 5-6" /></svg>
          <span className="max-w-48 truncate text-[#f1e7d1]">{user.pseudo}</span>
          <span className="rounded-full border border-[#d1b675]/20 px-2 py-1 text-[10px] tracking-wider text-[#e6cc94]">{user.role}</span>
        </div>
      </header>
      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title={t('common.menu', { defaultValue: 'Menu' })}>
        <div className="flex flex-col">{navigation}</div>
      </Modal>
      <main className="lg:ml-60 min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full min-w-0 max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
