import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useBalanceStore } from '@/store/balanceStore';
import NotificationBell from '@/components/notifications/NotificationBell';
import Modal from '@/components/ui/Modal';

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const { balance } = useBalanceStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const home = isAdmin ? '/admin' : '/lobby';
  const links = isAdmin ? [{ to: '/admin', title: t('admin.dashboard') }] : [
    { to: '/lobby', title: t('nav.lobby') },
    { to: '/tasks', title: t('nav.tasks') },
    { to: '/shop', title: t('nav.shop') },
  ];
  const toggleLang = () => {
    const lang = i18n.language === 'fr' ? 'en' : 'fr';
    void i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };
  const wallet = <div className="casino-wallet" title={`${balance.toLocaleString()} GC`} aria-label={`${t('common.balance')} : ${balance.toLocaleString()} GC`}>
    <svg className="hidden h-4 w-4 shrink-0 sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18m-18-4 14-3v3m-3 8h7" /><circle cx="17" cy="14" r=".5" /></svg>
    <span className="min-w-0 truncate">{balance.toLocaleString()} <span className="text-[10px] font-normal text-[#b8aa8b]">GC</span></span>
  </div>;
  const languageButton = <button type="button" onClick={toggleLang} className="casino-nav-action px-3" aria-label={i18n.language === 'fr' ? 'Switch to English' : 'Passer en français'}>{i18n.language === 'fr' ? 'EN' : 'FR'}</button>;
  const logoutButton = <button type="button" onClick={handleLogout} className="casino-nav-action" aria-label={t('nav.logout')} title={t('nav.logout')}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 8V5H4v14h10v-3m-4-4h10m-4-4 4 4-4 4" /></svg></button>;

  return <>
    <header className="casino-nav fixed inset-x-0 top-0 z-40 border-b border-[#bda36a]/20 bg-[#101914]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl min-w-0 items-center justify-between gap-2 px-3 sm:px-6">
        <Link to={home} aria-label="CasinoX" className="casino-wordmark shrink-0">Casino<span>X</span><span className="ml-3 hidden rounded border border-white/10 px-1.5 py-0.5 font-sans text-[9px] tracking-normal text-[#929d95] xl:block">18+</span></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('casino.navigation')}>
          {links.map(link => <NavLink key={link.to} to={link.to} className="casino-nav-link">{link.title}</NavLink>)}
        </nav>
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          {!isAdmin && <>{wallet}<NotificationBell /></>}
          <Link to={isAdmin ? '/admin' : '/profile'} aria-label={t('nav.profile')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d1b675]/35 bg-[#c7a35e]/10 text-sm font-semibold text-[#e6cc94]" title={user?.pseudo}>{user?.pseudo?.charAt(0).toUpperCase() || '?'}</Link>
          {languageButton}{logoutButton}
        </div>
        {!isAdmin && <div className="min-w-0 max-w-[165px] lg:hidden">{wallet}</div>}
        <button type="button" onClick={() => setMobileOpen(true)} aria-label={t('common.menu', { defaultValue: 'Menu' })} aria-haspopup="dialog" aria-expanded={mobileOpen}
          className="casino-nav-action h-11 w-11 shrink-0 lg:hidden"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
      </div>
    </header>
    <Modal isOpen={mobileOpen} onClose={() => setMobileOpen(false)} title={t('casino.navigation')}>
      <div className="mb-5 min-w-0 rounded-xl border border-[#bda36a]/20 bg-[#c7a35e]/5 p-4">
        <p className="casino-eyebrow">CasinoX</p><p className="mb-3 break-words text-sm text-[#e6dfce]">{user?.pseudo}</p>{!isAdmin && wallet}
      </div>
      <nav className="grid gap-1" aria-label={t('casino.navigation')}>
        {links.map(link => <NavLink key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className="casino-nav-link">{link.title}</NavLink>)}
        {!isAdmin && <NavLink to="/profile" onClick={() => setMobileOpen(false)} className="casino-nav-link">{t('nav.profile')}</NavLink>}
        <NavLink to="/responsible-gaming" onClick={() => setMobileOpen(false)} className="casino-nav-link">{t('rg.title')}</NavLink>
      </nav>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        {languageButton}<div className="flex items-center gap-3">{!isAdmin && <NotificationBell />}{logoutButton}</div>
      </div>
    </Modal>
  </>;
}
