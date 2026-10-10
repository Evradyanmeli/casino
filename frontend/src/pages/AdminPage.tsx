import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminDashboardPage from './admin/AdminDashboardPage';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminGamesPage from './admin/AdminGamesPage';
import AdminSettingsPage from './admin/AdminSettingsPage';

const tabs = { dashboard: AdminDashboardPage, users: AdminUsersPage, games: AdminGamesPage, settings: AdminSettingsPage };

export default function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<keyof typeof tabs>('dashboard');
  const Page = tabs[tab];
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
          {(Object.keys(tabs) as (keyof typeof tabs)[]).map(key => (
            <button key={key} onClick={() => setTab(key)} aria-pressed={tab === key}
              className={`px-3 py-2 rounded text-sm ${tab === key ? 'bg-gold text-[#0D0D1A]' : 'text-gray-400 hover:text-white'}`}>
              {t(`admin.${key}`)}
            </button>
          ))}
        </div>
        <Page />
      </div>
    </AdminLayout>
  );
}
