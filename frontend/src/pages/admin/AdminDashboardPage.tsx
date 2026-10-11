import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import { CasinoChip } from '@/components/games/GameVisuals';
import { adminApi, capitalUsage } from '@/services/admin';
import { requestError } from '@/services/feedback';
import type { DashboardStats, HouseBalance } from '@/types';

type Period = '24h' | '7d' | '30d';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [house, setHouse] = useState<HouseBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechargeModal, setRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(0);
  const [period, setPeriod] = useState<Period>('24h');
  const [error, setError] = useState('');
  const [houseError, setHouseError] = useState('');
  const [rechargeError, setRechargeError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    setHouseError('');
    let active = true;
    Promise.allSettled([
      adminApi.getDashboard(period),
      adminApi.getHouseBalance(),
    ]).then(([s, h]) => {
      if (!active) return;
      setStats(s.status === 'fulfilled' ? s.value : null);
      setHouse(h.status === 'fulfilled' ? h.value : null);
      if (s.status === 'rejected') setError(requestError(s.reason));
      if (h.status === 'rejected') setHouseError(requestError(h.reason));
      setLoading(false);
    });
    return () => { active = false; };
  }, [period]);

  const handleRecharge = async () => {
    if (saving || !Number.isSafeInteger(rechargeAmount) || rechargeAmount <= 0) return;
    setSaving(true);
    setRechargeError('');
    try {
    await adminApi.rechargeHouse(rechargeAmount);
    setRechargeModal(false);
    setRechargeAmount(0);
    const [s, h] = await Promise.all([adminApi.getDashboard(period), adminApi.getHouseBalance()]);
    setStats(s);
    setHouse(h);
    } catch (err) { setRechargeError(requestError(err)); }
    finally { setSaving(false); }
  };

  const header = <PageHeader title={t('admin.dashboard')} eyebrow="Administration">
    <div className="casino-tabs flex flex-wrap gap-1" role="group" aria-label={t('admin.dashboard')}>
      {(['24h', '7d', '30d'] as Period[]).map(p => <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
        className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${period === p ? 'bg-[#c7a35e]/15 text-[#e6cc94]' : 'text-gray-400 hover:text-white'}`}>{p}</button>)}
    </div>
  </PageHeader>;

  if (loading) return <div className="space-y-6">{header}<p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p></div>;
  if (!stats) return <div className="space-y-6">{header}<p role="alert" className="casino-panel p-5 text-error break-words">{error || t('common.error')}</p></div>;

  const kpiCards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers.toLocaleString(), tooltip: '' },
    { label: t('admin.activePeriod', { period, defaultValue: 'Active users ({{period}})' }), value: (stats.activeUsers ?? stats.activeUsers24h).toLocaleString(), tooltip: '' },
    { label: t('admin.gamesPlayed'), value: stats.totalGamesPlayed.toLocaleString(), tooltip: '' },
    { label: t('admin.revenue'), value: `${stats.revenue >= 0 ? '+' : ''}${stats.revenue.toLocaleString()} GC`, tooltip: t('admin.revenueHelp', { defaultValue: 'Net gaming revenue for the selected period.' }), net: true },
    { label: t('admin.houseBalance'), value: `${stats.houseBalance.toLocaleString()} GC`, tooltip: t('admin.houseHelp', { defaultValue: 'Virtual house funds. Treasury reservations are detailed below.' }) },
    { label: t('admin.playersBalance', { defaultValue: 'Player balances' }), value: `${stats.totalUserBalance.toLocaleString()} GC`, tooltip: t('admin.playersBalanceHelp', { defaultValue: 'Combined virtual balances held by players.' }) },
  ];

  const capitalUsed = house ? house.capital - (house.totalBalance ?? house.balance) : 0;
  const capitalPct = house ? capitalUsage(house).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {header}

      <div className="grid min-w-0 grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="casino-kpi casino-panel min-w-0 p-5">
            <p className="text-sm text-[#b8c5be] mb-3">{card.label}</p>
            <p className={`text-xl sm:text-2xl font-semibold tabular-nums break-words ${card.net ? stats.revenue < 0 ? 'text-error' : 'text-success' : 'text-[#f1e7d1]'}`}>{card.value}</p>
            {card.tooltip && <p className="mt-3 text-xs leading-relaxed text-gray-400">{card.tooltip}</p>}
          </div>
        ))}
      </div>

      {house && (
        <div className="casino-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="casino-section text-xl" style={{ fontFamily: 'Georgia, serif' }}>{t('admin.initialCapital')}</h2><CasinoChip value="GC" color="#236750" className="opacity-60" /></div>
          <p className="mt-3 text-2xl font-semibold tabular-nums break-words text-white">{house.capital.toLocaleString()} GC</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.houseHelp', { defaultValue: 'Virtual house funds. Treasury reservations are detailed below.' })}</p>
        </div>
      )}

      {house && <div className="casino-panel p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 [&_p]:break-words [&_p]:tabular-nums">
        <div><p className="text-sm text-gray-400">{t('admin.availableTreasury')}</p><p className="text-xl text-white">{house.balance.toLocaleString()} GC</p></div>
        <div><p className="text-sm text-gray-400">{t('admin.reservedBotCapital')}</p><p className="text-xl text-white">{(house.reservedBots ?? 0).toLocaleString()} GC</p></div>
        <div><p className="text-sm text-gray-400">{t('admin.reservedGameCapital')}</p><p className="text-xl text-white">{(house.reservedGames ?? 0).toLocaleString()} GC</p></div>
        <div><p className="text-sm text-gray-400">{t('admin.totalTreasury')}</p><p className="text-xl text-white">{(house.totalBalance ?? house.balance).toLocaleString()} GC</p></div>
      </div>}

      {house && (
        <div className="casino-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="casino-section text-xl" style={{ fontFamily: 'Georgia, serif' }}>{t('admin.houseAccount')}</h2>
            <Button variant="outline" onClick={() => setRechargeModal(true)}>
              {t('admin.recharge')}
            </Button>
          </div>
          <div>
            <p className="text-sm text-gray-400">{t('admin.capitalUsed')}</p>
            <p className="text-2xl font-semibold tabular-nums break-words text-[#e6cc94]">{capitalUsed.toLocaleString()} GC</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{t('admin.capitalUsage')}</span>
              <span>{capitalPct}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div
                className="bg-[#86b99a] h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, parseFloat(capitalPct)))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {houseError && <p role="alert" className="casino-panel p-5 break-words text-error">{houseError}</p>}
      <Modal
        isOpen={rechargeModal}
        onClose={() => setRechargeModal(false)}
        title={t('admin.rechargeHouse')}
      >
        <div className="space-y-4">
          {rechargeError && <p role="alert" className="text-error">{rechargeError}</p>}
          <p className="text-sm text-gray-400">{t('admin.rechargeDesc')}</p>
          <Input
            id="recharge-amount"
            label={t('admin.amount')}
            type="number"
            min="1"
            step="1"
            value={String(rechargeAmount)}
            onChange={e => setRechargeAmount(Number(e.target.value))}
          />
          <div className="flex flex-wrap gap-3">
            {[100000, 500000, 1000000, 5000000].map(amt => (
              <button
                key={amt}
                onClick={() => setRechargeAmount(amt)}
                aria-pressed={rechargeAmount === amt}
                className={`min-h-11 px-3 py-2 rounded text-xs font-semibold border transition-colors ${
                  rechargeAmount === amt ? 'border-gold text-gold bg-gold/10' : 'border-gray-700 text-gray-400 hover:border-gold'
                }`}
              >
                {amt.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setRechargeModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth onClick={handleRecharge} disabled={saving || !Number.isSafeInteger(rechargeAmount) || rechargeAmount <= 0}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
