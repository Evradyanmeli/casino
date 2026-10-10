import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { userApi } from '@/services/user';
import { TransactionList } from '@/components/economy/TransactionList';
import { progressionApi, type LevelProgress } from '@/services/progression';
import type { UserStats } from '@/types';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);
  const [editPseudoOpen, setEditPseudoOpen] = useState(false);
  const [newPseudo, setNewPseudo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userApi.getStats().then((data: any) => {
      setStats({
        gamesPlayed: Number(data.totalSessions) || 0,
        wins: Number(data.totalWins) || 0,
        winRate: Number(data.winRate) || 0,
        biggestWin: Number(data.biggestWin) || 0,
        totalBet: Math.abs(Number(data.totalSpent)) || 0,
      });
    }).catch(() => {});
    const fetchProgress = () => progressionApi.getLevelProgress().then(setLevelProgress).catch(() => {});
    fetchProgress();
    window.addEventListener('xp-updated', fetchProgress);
    return () => window.removeEventListener('xp-updated', fetchProgress);
  }, []);

  const handlePseudoSave = async () => {
    if (!newPseudo.trim()) return;
    setSaving(true);
    try {
      const updated = await userApi.updateProfile({ pseudo: newPseudo });
      setUser(updated);
      setEditPseudoOpen(false);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const statCards = stats
    ? [
        { label: t('profile.gamesPlayed'), value: stats.gamesPlayed.toLocaleString() },
        { label: t('profile.wins'), value: stats.wins.toLocaleString() },
        { label: t('profile.winRate'), value: `${stats.winRate}%` },
        { label: t('profile.biggestWin'), value: `${(stats.biggestWin ?? 0).toLocaleString()} GC` },
        { label: t('profile.totalBet'), value: `${stats.totalBet.toLocaleString()} GC` },
      ]
    : [];

  return (
    <Layout>
      <div className="space-y-6">
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gold transition-colors text-sm">
          ← Retour
        </button>
        <div className="card flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold to-secondary flex items-center justify-center text-3xl font-bold text-white">
              {user?.pseudo?.charAt(0).toUpperCase() || '?'}
            </div>
            <button
              onClick={() => { setNewPseudo(user?.pseudo || ''); setEditPseudoOpen(true); }}
              className="absolute -bottom-1 -right-1 bg-[#1A1A2E] border border-gray-700 rounded-full p-1.5 hover:border-gold transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div className="text-center sm:text-left flex-1">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <h2 className="text-2xl font-display text-white">{user?.pseudo}</h2>
              <button
                onClick={() => { setNewPseudo(user?.pseudo || ''); setEditPseudoOpen(true); }}
                className="text-gray-500 hover:text-gold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <p className="text-gray-400">{user?.email}</p>
            <div className="flex gap-3 mt-1 justify-center sm:justify-start">
              {user?.role === 'ADMIN' && (
                <Link to="/admin" className="text-sm text-secondary hover:underline">
                  {t('profile.adminLink')}
                </Link>
              )}
              <Link to="/responsible-gaming" className="text-sm text-accent hover:underline">
                {t('rg.title')}
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          {levelProgress ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">{t('profile.level')} {levelProgress.level}</span>
                <span className="text-gray-400">
                  {levelProgress.xpInCurrentLevel.toLocaleString()} / {levelProgress.xpForNextLevel.toLocaleString()} {t('profile.xp')}
                </span>
              </div>
              <div className="w-full bg-[#0D0D1A] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-secondary rounded-full transition-all duration-500"
                  style={{ width: `${levelProgress.progressPercent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="animate-pulse">
              <div className="h-5 w-40 bg-gray-700 rounded mb-2" />
              <div className="h-3 bg-gray-700 rounded" />
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-display text-gold mb-3">{t('profile.stats')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map((s) => (
              <div key={s.label} className="card text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-display text-gold mb-3">{t('profile.transactions')}</h3>
          <TransactionList />
        </div>
      </div>

      <Modal isOpen={editPseudoOpen} onClose={() => setEditPseudoOpen(false)} title={t('profile.editPseudo')}>
        <div className="space-y-4">
          <Input
            id="editPseudo"
            label={t('auth.register.pseudo')}
            type="text"
            value={newPseudo}
            onChange={(e) => setNewPseudo(e.target.value)}
            required
            minLength={3}
          />
          <div className="flex gap-3">
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
