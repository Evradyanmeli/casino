import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { userApi } from '@/services/user';
import { TransactionList } from '@/components/economy/TransactionList';
import { progressionApi, type LevelProgress } from '@/services/progression';
import { requestError } from '@/services/feedback';

type ProfileStats = {
  gamesPlayed: number;
  wins: number;
  winRate: string;
  biggestWin: string;
  totalBet: string;
};

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editPseudoOpen, setEditPseudoOpen] = useState(false);
  const [newPseudo, setNewPseudo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setStatsLoading(true);
    setStatsError('');
    userApi.getStats().then((data: any) => {
      if (!active) return;
      setStats({
        gamesPlayed: data.totalSessions,
        wins: data.totalWins,
        winRate: String(data.winRate),
        biggestWin: data.biggestWin,
        totalBet: data.totalSpent,
      });
    }).catch(err => { if (active) setStatsError(requestError(err)); })
      .finally(() => { if (active) setStatsLoading(false); });
    const fetchProgress = () => {
      setProgressLoading(true);
      setProgressError('');
      return progressionApi.getLevelProgress()
        .then(data => { if (active) setLevelProgress(data); })
        .catch(err => { if (active) setProgressError(requestError(err)); })
        .finally(() => { if (active) setProgressLoading(false); });
    };
    fetchProgress();
    window.addEventListener('xp-updated', fetchProgress);
    return () => { active = false; window.removeEventListener('xp-updated', fetchProgress); };
  }, [retry]);

  const handlePseudoSave = async () => {
    if (!newPseudo.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await userApi.updateProfile({ pseudo: newPseudo });
      setUser(updated);
      setEditPseudoOpen(false);
    } catch (err) {
      setSaveError(requestError(err));
    } finally {
      setSaving(false);
    }
  };

  const statCards = stats
    ? [
        { label: t('profile.gamesPlayed'), value: stats.gamesPlayed.toLocaleString(i18n.language) },
        { label: t('profile.wins'), value: stats.wins.toLocaleString(i18n.language) },
        { label: t('profile.winRate'), value: `${stats.winRate}%` },
        { label: t('profile.biggestWin'), value: `${BigInt(stats.biggestWin).toLocaleString(i18n.language)} GC`, detail: 'Retour brut, pas le profit net' },
        { label: t('profile.totalBet'), value: `${BigInt(stats.totalBet).toLocaleString(i18n.language)} GC` },
      ]
    : [];

  return (
    <Layout>
      <div className="min-w-0 space-y-8">
        <PageHeader title={t('profile.title')} eyebrow="Espace personnel" description="Votre identite, votre progression et vos transactions." backTo="/lobby" />
        <section className="casino-stage relative min-w-0 overflow-hidden p-5 sm:p-8" aria-label="Passeport de membre CasinoX">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#d9bf83]/20 pb-4">
            <p className="casino-eyebrow !mb-0">CASINO X / Passeport de membre</p>
            <span className="text-xs text-[#b8c5be]">Espace personnel</span>
          </div>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-[#9e8250] bg-gradient-to-br from-[#f0dda7] to-[#ac8240] text-3xl text-[#292218] shadow-[inset_0_2px_4px_#fff8,0_6px_16px_#0005]" style={{ fontFamily: 'Georgia, serif' }} aria-hidden="true">
              {user?.pseudo?.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || '?'}
            </div>
            <div className="w-full min-w-0 flex-1">
              <h2 className="break-words text-3xl text-[#f1e7d1] [overflow-wrap:anywhere]" style={{ fontFamily: 'Georgia, serif' }}>{user?.pseudo}</h2>
              <p className="mt-2 text-sm text-[#b8c5be] [overflow-wrap:anywhere]">{user?.email}</p>
            </div>
            <Button variant="outline" className="min-h-11 max-w-full" onClick={() => { setNewPseudo(user?.pseudo || ''); setSaveError(''); setEditPseudoOpen(true); }}>
              {t('profile.editPseudo')}
            </Button>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[#d9bf83]/20 pt-5">
            <div className="min-w-0"><dt className="text-xs text-[#b8c5be]">{t('profile.level')}</dt><dd className="mt-1 text-2xl tabular-nums text-[#ecd5a1]">{levelProgress?.level ?? user?.level ?? '—'}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-[#b8c5be]">{t('profile.xp')}</dt><dd className="mt-1 break-words text-2xl tabular-nums text-[#ecd5a1]">{(levelProgress?.xp ?? user?.xp)?.toLocaleString(i18n.language) ?? '—'}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
            {user?.role === 'ADMIN' && <Link to="/admin" className="inline-flex min-h-11 items-center text-sm text-[#e6cc94] hover:underline">{t('profile.adminLink')}</Link>}
            <Link to="/responsible-gaming" className="inline-flex min-h-11 items-center text-sm text-[#c9ddd1] hover:underline">{t('rg.title')}</Link>
          </div>
        </section>

        <section className="casino-panel p-5 sm:p-6" aria-label="Progression">
          <p className="casino-eyebrow">Progression</p>
          {progressError ? (
            <div className="space-y-3"><p role="alert" className="text-sm text-error">{progressError}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</Button></div>
          ) : progressLoading ? <p role="status" className="text-sm text-gray-400">{t('common.loading')}</p> : levelProgress ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm">
                <span className="text-gray-400">{t('profile.level')} {levelProgress.level}</span>
                <span className="text-gray-400">
                  {levelProgress.xpInCurrentLevel.toLocaleString(i18n.language)} / {levelProgress.xpForNextLevel.toLocaleString(i18n.language)} {t('profile.xp')}
                </span>
              </div>
              <div role="progressbar" aria-label={`${t('profile.level')} ${levelProgress.level}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgress.progressPercent} className="w-full bg-black/25 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#9c7a40] to-[#e7cf94] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, levelProgress.progressPercent))}%` }}
                />
              </div>
            </>
          ) : null}
        </section>

        <div>
          <h2 className="casino-section mb-4 text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('profile.stats')}</h2>
          {statsError ? <div className="casino-empty casino-panel space-y-3 p-5"><p role="alert" className="text-sm text-error">{statsError}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</Button></div> : statsLoading ? <p role="status" className="casino-panel p-5 text-sm text-gray-400">{t('common.loading')}</p> : <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {statCards.map((s) => (
              <div key={s.label} className="casino-kpi casino-panel p-5">
                <p className="break-words text-xl tabular-nums text-[#ecd5a1] [overflow-wrap:anywhere]">{s.value}</p>
                <p className="text-xs text-gray-300 mt-2">{s.label}</p>
                {s.detail && <p className="mt-2 text-xs leading-relaxed text-gray-400">{s.detail}</p>}
              </div>
            ))}
          </div>}
        </div>

        <div>
          <h2 className="casino-section mb-4 text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('profile.transactions')}</h2>
          <TransactionList />
        </div>
      </div>

      <Modal isOpen={editPseudoOpen} onClose={() => setEditPseudoOpen(false)} title={t('profile.editPseudo')}>
        <div className="space-y-4">
          {saveError && <p role="alert" className="text-sm text-error">{saveError}</p>}
          <Input
            id="editPseudo"
            label={t('auth.register.pseudo')}
            type="text"
            value={newPseudo}
            onChange={(e) => setNewPseudo(e.target.value)}
            required
            minLength={3}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="ghost" fullWidth onClick={() => setEditPseudoOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth onClick={handlePseudoSave} disabled={saving || !newPseudo.trim()}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
