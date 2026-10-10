import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useBalanceStore } from '@/store/balanceStore';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const { balance } = useBalanceStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const toggleLang = () => {
    const lang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0D0D1A]/95 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/lobby" className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-gold tracking-wider">CASINO<span className="text-white">X</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          {user?.role === 'ADMIN' ? (
            <>
              <Link
                to="/admin"
                className="text-accent hover:text-gold transition-colors text-sm font-semibold"
              >
                {t('admin.dashboard')}
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-[#1A1A2E] rounded-lg px-4 py-2 border border-gray-700">
                <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-gold">{balance.toLocaleString()} GC</span>
              </div>

              <Link
                to="/tasks"
                className="text-gray-400 hover:text-gold transition-colors text-sm font-semibold"
                title={t('nav.tasks')}
              >
                {t('nav.tasks')}
              </Link>

              <NotificationBell />

              <Link
                to="/shop"
                className="text-gray-400 hover:text-gold transition-colors"
                title={t('nav.shop')}
                aria-label={t('nav.shop')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </Link>

              <Link to="/profile" aria-label={t('nav.profile')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-secondary flex items-center justify-center text-sm font-bold text-white">
                  {user?.pseudo?.charAt(0).toUpperCase() || '?'}
                </div>
              </Link>
            </>
          )}

          <button
            onClick={toggleLang}
            className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gold transition-colors px-2 py-1 border border-gray-700 rounded"
          >
            {i18n.language === 'fr' ? 'EN' : 'FR'}
          </button>

          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-error transition-colors"
            title={t('nav.logout')}
            aria-label={t('nav.logout')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t('common.menu')}
          aria-expanded={mobileOpen}
          className="md:hidden text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 bg-[#0D0D1A]/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-3">
            {user?.role === 'ADMIN' ? (
              <Link
                to="/admin"
                className="block text-accent hover:text-gold transition-colors text-sm font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                {t('admin.dashboard')}
              </Link>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-[#1A1A2E] rounded-lg px-4 py-2 border border-gray-700">
                  <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-gold">{balance.toLocaleString()} GC</span>
                </div>
                <div className="flex items-center gap-4">
                  <Link to="/tasks" className="text-gray-400 text-sm" onClick={() => setMobileOpen(false)}>{t('nav.tasks')}</Link>
                  <NotificationBell />
                  <Link
                    to="/shop"
                    className="text-gray-400 hover:text-gold transition-colors"
                    title={t('nav.shop')}
                    aria-label={t('nav.shop')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                  </Link>
                  <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity text-sm text-white">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-secondary flex items-center justify-center text-xs font-bold text-white">
                      {user?.pseudo?.charAt(0).toUpperCase() || '?'}
                    </div>
                    {t('nav.profile')}
                  </Link>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button
                onClick={toggleLang}
                className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gold transition-colors px-2 py-1 border border-gray-700 rounded"
              >
                {i18n.language === 'fr' ? 'EN' : 'FR'}
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-error transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
