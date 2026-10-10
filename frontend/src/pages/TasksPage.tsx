import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import { LevelBadge } from '@/components/progression/LevelBadge';
import { TasksPanel } from '@/components/progression/TasksPanel';
import { BadgesDisplay } from '@/components/progression/BadgesDisplay';
import { RaceLeaderboard } from '@/components/progression/RaceLeaderboard';

export default function TasksPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gold transition-colors text-sm">
          ← Retour
        </button>
        <h1 className="text-2xl font-display font-bold text-white">{t('nav.tasks')}</h1>
        <LevelBadge />
        <TasksPanel />
        <RaceLeaderboard />
        <BadgesDisplay />
      </div>
    </Layout>
  );
}
