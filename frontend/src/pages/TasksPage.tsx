import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/ui/PageHeader';
import { LevelBadge } from '@/components/progression/LevelBadge';
import { TasksPanel } from '@/components/progression/TasksPanel';
import { BadgesDisplay } from '@/components/progression/BadgesDisplay';
import { RaceLeaderboard } from '@/components/progression/RaceLeaderboard';

export default function TasksPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <div className="mx-auto min-w-0 max-w-6xl space-y-8 [&_button]:min-h-11">
        <PageHeader title={t('nav.tasks')} eyebrow="Votre parcours CasinoX" description="Accomplissez vos objectifs, progressez dans la course et découvrez vos distinctions." backTo="/lobby" />
        <LevelBadge />
        <TasksPanel />
        <RaceLeaderboard />
        <BadgesDisplay />
      </div>
    </Layout>
  );
}
