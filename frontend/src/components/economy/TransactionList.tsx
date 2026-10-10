import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { economyApi, type Transaction } from '@/services/economy';

const FILTERS = [
  { key: undefined, labelKey: 'profile.filterAll' },
  { key: 'deposit', labelKey: 'profile.filterDeposits' },
  { key: 'win', labelKey: 'profile.filterWins' },
  { key: 'bet', labelKey: 'profile.filterBets' },
] as const;

export function TransactionList() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    economyApi.getTransactions(filter)
      .then((data) => setTransactions(data.transactions))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      deposit: t('profile.filterDeposits'),
      win: t('profile.filterWins'),
      bet: t('profile.filterBets'),
      bonus: 'Bonus',
    };
    return map[type] || type;
  };

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      deposit: 'bg-green-500/20 text-green-400',
      win: 'bg-blue-500/20 text-blue-400',
      bet: 'bg-orange-500/20 text-orange-400',
      bonus: 'bg-purple-500/20 text-purple-400',
    };
    return map[type] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-[#FFD700] text-[#0D0D1A]'
                : 'bg-[#1A1A2E] text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#1A1A2E] rounded-xl p-4 border border-gray-800 animate-pulse">
              <div className="h-4 w-32 bg-gray-700 rounded mb-2" />
              <div className="h-3 w-20 bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{t('profile.noTransactions')}</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-[#1A1A2E] rounded-xl p-4 border border-gray-800 flex items-center justify-between hover:border-gray-700 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeColor(tx.type)}`}>
                  {typeLabel(tx.type)}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{tx.description || typeLabel(tx.type)}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <span className={`font-bold text-lg ${tx.amount >= 0 ? 'text-[#00C853]' : 'text-[#FF1744]'}`}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} GC
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
