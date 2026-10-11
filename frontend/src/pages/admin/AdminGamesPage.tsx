import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { adminApi } from '@/services/admin';
import type { GameStat, GameConfig } from '@/types';
import { requestError } from '@/services/feedback';

const GAME_LIST = ['slots', 'blackjack', 'roulette', 'poker', 'mines', 'crash', 'plinko', 'wheel', 'limbo', 'craps', 'bingo', 'videopoker', 'keno'];

export default function AdminGamesPage() {
  const { t } = useTranslation();
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [configs, setConfigs] = useState<GameConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editConfig, setEditConfig] = useState<GameConfig | null>(null);
  const [editForm, setEditForm] = useState({ houseEdge: 0, minBet: 0, maxBet: 0, active: true });
  const [statsError, setStatsError] = useState('');
  const [configError, setConfigError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    let active = true;
    Promise.allSettled([
      adminApi.getGameStats(),
      adminApi.getGameConfigs(),
    ]).then(([stats, configs]) => {
      if (!active) return;
      if (stats.status === 'fulfilled') setGameStats(stats.value);
      else setStatsError(requestError(stats.reason));
      if (configs.status === 'fulfilled') setConfigs(configs.value);
      else setConfigError(requestError(configs.reason));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const openEdit = (config: GameConfig) => {
    setEditConfig(config);
    setSaveError('');
    setEditForm({ houseEdge: config.houseEdge, minBet: config.minBet, maxBet: config.maxBet, active: config.active });
  };

  const handleSave = async () => {
    if (!editConfig) return;
    setSaving(true);
    setSaveError('');
    try {
    const updated = await adminApi.updateGameConfig(editConfig.gameType, editForm);
    setConfigs(current => current.map(c => c.gameType === updated.gameType ? updated : c));
    setEditConfig(null);
    } catch (err) { setSaveError(requestError(err)); }
    finally { setSaving(false); }
  };

  const getConfigForGame = (game: string) => configs.find(c => c.gameType === game);

  if (loading) {
    return <div className="space-y-6"><PageHeader title={t('admin.gamesConfig')} eyebrow="Administration" /><p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p></div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title={t('admin.gamesConfig')} eyebrow="Administration" />
      {statsError && <p role="alert" className="casino-panel p-5 break-words text-error">{t('admin.statsUnavailable', { defaultValue: 'Statistics unavailable' })}: {statsError}</p>}
      {configError && <p role="alert" className="casino-panel p-5 break-words text-error">{t('admin.configUnavailable', { defaultValue: 'Configuration unavailable' })}: {configError}</p>}

      <div className="admin-table-wrap max-w-full overflow-x-auto" role="region" aria-label={t('admin.gamesConfig')} tabIndex={0}>
        <table className="admin-table w-full min-w-[900px] text-sm tabular-nums">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left py-2 px-2">{t('admin.game')}</th>
              <th className="text-right py-2 px-2">{t('admin.gamesPlayed')}</th>
              <th className="text-right py-2 px-2">{t('admin.totalBet')}</th>
              <th className="text-right py-2 px-2">{t('admin.totalWin')}</th>
              <th className="text-right py-2 px-2">RTP</th>
              <th className="text-right py-2 px-2">{t('admin.houseEdge')}</th>
              <th className="text-center py-2 px-2">{t('admin.active')}</th>
              <th className="text-right py-2 px-2">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {GAME_LIST.map(game => {
              const stat = gameStats.find(s => s.game === game);
              const config = getConfigForGame(game);
              return (
                <tr key={game} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-2 px-2 text-white font-semibold">{t(`lobby.gamesList.${game}`)}</td>
                   <td className="py-2 px-2 text-right text-white">{statsError ? '-' : stat?.playCount.toLocaleString() || '0'}</td>
                   <td className="py-2 px-2 text-right text-white">{statsError ? '-' : stat?.totalBet.toLocaleString() || '0'}</td>
                   <td className="py-2 px-2 text-right text-white">{statsError ? '-' : stat?.totalWin.toLocaleString() || '0'}</td>
                  <td className="py-2 px-2 text-right text-white">{statsError || stat?.rtp == null ? '-' : `${stat.rtp}%`}</td>
                  <td className="py-2 px-2 text-right text-white">{config?.houseEdge == null ? '-' : `${config.houseEdge}%`}</td>
                  <td className="py-2 px-2 text-center">
                     {config ? <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${config.active ? 'border-success/20 bg-success/5 text-success' : 'border-gray-600 text-gray-400'}`}>{config.active ? t('admin.active') : t('admin.inactive', { defaultValue: 'Inactive' })}</span> : '-'}
                  </td>
                  <td className="py-2 px-2 text-right">
                     <Button variant="ghost" disabled={!config || !!configError} onClick={() => config && openEdit(config)} className="min-h-11 text-xs px-3">
                      {t('admin.configure')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!editConfig}
        onClose={() => setEditConfig(null)}
        title={`${t('admin.configureGame')} - ${editConfig?.gameType || ''}`}
      >
        <div className="space-y-4">
          {saveError && <p role="alert" className="text-error">{saveError}</p>}
          <div>
            <label htmlFor="game-edge" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.houseEdge')} (%)</label>
            <input
              id="game-edge"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={editForm.houseEdge}
              onChange={e => setEditForm(f => ({ ...f, houseEdge: parseFloat(e.target.value) || 0 }))}
              className="input-field min-h-11"
            />
          </div>
          <div>
            <label htmlFor="game-min" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.minBet')}</label>
            <input
              id="game-min"
              type="number"
              min="1"
              value={editForm.minBet}
              onChange={e => setEditForm(f => ({ ...f, minBet: parseInt(e.target.value) || 0 }))}
              className="input-field min-h-11"
            />
          </div>
          <div>
            <label htmlFor="game-max" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.maxBet')}</label>
            <input
              id="game-max"
              type="number"
              min="1"
              value={editForm.maxBet}
              onChange={e => setEditForm(f => ({ ...f, maxBet: parseInt(e.target.value) || 0 }))}
              className="input-field min-h-11"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-300">{t('admin.active')}</label>
            <button
              role="switch"
              aria-checked={editForm.active}
              aria-label={t('admin.active')}
              onClick={() => setEditForm(f => ({ ...f, active: !f.active }))}
              className={`relative w-14 h-11 rounded-full border transition-colors ${editForm.active ? 'bg-success/20 border-success/40' : 'bg-white/5 border-gray-600'}`}
            >
              <span className={`absolute left-1 top-2.5 w-5 h-5 bg-white rounded-full transition-transform ${editForm.active ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setEditConfig(null)}>{t('common.cancel')}</Button>
            <Button fullWidth onClick={handleSave} disabled={saving || editForm.houseEdge < 0 || editForm.houseEdge > 100 || !Number.isSafeInteger(editForm.minBet) || !Number.isSafeInteger(editForm.maxBet) || editForm.minBet < 1 || editForm.maxBet < editForm.minBet}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
