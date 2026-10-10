import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
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
    if (!rechargeAmount || rechargeAmount <= 0) return;
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

  if (loading) {
    return <p className="text-gray-400">{t('common.loading')}</p>;
  }

  if (!stats) {
    return <p role="alert" className="text-error">{error || t('common.error')}</p>;
  }

  const kpiCards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers.toLocaleString(), color: 'from-blue-500 to-blue-600', tooltip: '' },
    { label: t('admin.activePeriod', { period }), value: (stats.activeUsers ?? stats.activeUsers24h).toLocaleString(), color: 'from-green-500 to-green-600', tooltip: '' },
    { label: t('admin.gamesPlayed'), value: stats.totalGamesPlayed.toLocaleString(), color: 'from-cyan-500 to-cyan-600', tooltip: '' },
    { label: t('admin.revenue'), value: `${stats.revenue >= 0 ? '+' : ''}${stats.revenue.toLocaleString()} GC`, color: 'from-gold to-amber-500', tooltip: t('admin.revenueHelp'), net: true },
    { label: t('admin.houseBalance'), value: `${stats.houseBalance.toLocaleString()} GC`, color: 'from-teal-500 to-teal-600', tooltip: t('admin.houseHelp') },
    { label: t('admin.playersBalance'), value: `${stats.totalUserBalance.toLocaleString()} GC`, color: 'from-purple-500 to-purple-600', tooltip: t('admin.playersBalanceHelp') },
  ];

  const capitalUsed = house ? house.capital - house.balance : 0;
  const capitalPct = house ? capitalUsage(house).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-gold">{t('admin.dashboard')}</h1>
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                period === p ? 'bg-gold text-[#0D0D1A]' : 'bg-[#1A1A2E] text-gray-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="card relative group">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
              <span className="text-white font-bold text-lg">{card.label.charAt(0)}</span>
            </div>
            <p className={`text-xl sm:text-2xl font-bold break-words ${card.net ? stats.revenue < 0 ? 'text-error' : 'text-success' : 'text-white'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.label}</p>
            {card.tooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded bg-gray-900 text-xs text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-gray-700">
                {card.tooltip}
              </div>
            )}
          </div>
        ))}
      </div>

      {house && (
        <div className="card">
          <h2 className="text-lg font-display text-white mb-3">{t('admin.initialCapital')}</h2>
          <p className="text-2xl font-bold text-white">{house.capital.toLocaleString()} GC</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.houseHelp')}</p>
        </div>
      )}

      {house && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display text-white">{t('admin.houseAccount')}</h2>
            <Button variant="secondary" onClick={() => setRechargeModal(true)}>
              {t('admin.recharge')}
            </Button>
          </div>
          <div>
            <p className="text-sm text-gray-400">{t('admin.capitalUsed')}</p>
            <p className="text-2xl font-bold text-cyan">{capitalUsed.toLocaleString()} GC</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{t('admin.capitalUsage')}</span>
              <span>{capitalPct}%</span>
            </div>
            <div className="w-full bg-[#232340] rounded-full h-2">
              <div
                className="bg-gradient-to-r from-gold to-secondary h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, parseFloat(capitalPct)))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {houseError && <p role="alert" className="text-error">{houseError}</p>}
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
            value={String(rechargeAmount)}
            onChange={e => setRechargeAmount(Number(e.target.value))}
          />
          <div className="flex flex-wrap gap-3">
            {[100000, 500000, 1000000, 5000000].map(amt => (
              <button
                key={amt}
                onClick={() => setRechargeAmount(amt)}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
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
