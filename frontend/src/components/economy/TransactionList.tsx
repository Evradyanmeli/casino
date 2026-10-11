import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { economyApi, type Transaction } from '@/services/economy';
import { requestError } from '@/services/feedback';
import Button from '@/components/ui/Button';

const FILTERS = [
  { key: undefined, labelKey: 'profile.filterAll' },
  { key: 'deposit', labelKey: 'profile.filterDeposits' },
  { key: 'win', labelKey: 'profile.filterWins' },
  { key: 'bet', labelKey: 'profile.filterBets' },
] as const;

export function TransactionList() {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    economyApi.getTransactions(filter)
      .then((data) => { if (active) setTransactions(data.transactions); })
      .catch(err => { if (active) setError(requestError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, retry]);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      deposit: t('profile.filterDeposits'),
      win: `${t('profile.filterWins')} (bruts)`,
      bet: t('profile.filterBets'),
      bonus: 'Bonus',
    };
    return map[type] || type;
  };

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      deposit: 'bg-[#7aab8f]/10 text-[#afd0ba]',
      win: 'bg-[#c5a05a]/10 text-[#e6cc94]',
      bet: 'bg-[#bc8d77]/10 text-[#d1af9e]',
      bonus: 'bg-[#c5a05a]/10 text-[#d6c59e]',
    };
    return map[type] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="min-w-0">
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-gray-400">Les gains affiches sont des retours bruts, pas des profits nets. Chaque ligne correspond a une transaction en GC.</p>
      <div className="casino-tabs flex gap-2 mb-4 flex-wrap" role="group" aria-label={t('profile.transactions')}>
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`min-h-11 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              filter === f.key
                ? 'border-[#c5a05a]/50 bg-[#c5a05a]/15 text-[#e6cc94]'
                : 'bg-white/[.02] text-gray-400 hover:text-[#f1e7d1] border-white/10'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <p role="status" className="casino-empty casino-panel p-6 text-sm text-gray-400">{t('common.loading')}</p>
      ) : error ? (
        <div className="casino-empty casino-panel space-y-3 p-6"><p role="alert" className="text-sm text-error">{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</Button></div>
      ) : transactions.length === 0 ? (
        <p className="casino-empty casino-panel text-gray-400 text-center p-8">{t('profile.noTransactions')}</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <article key={tx.id} className="casino-panel flex min-w-0 flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${typeColor(tx.type)}`}>
                  {typeLabel(tx.type)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 [overflow-wrap:anywhere]">{tx.description || typeLabel(tx.type)}</p>
                  <time dateTime={tx.createdAt} className="mt-1 block text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </div>
              </div>
              <span className={`max-w-full text-lg font-medium tabular-nums [overflow-wrap:anywhere] sm:max-w-[45%] ${tx.amount >= 0 ? 'text-[#b8d5c3]' : 'text-[#d1af9e]'}`}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString(i18n.language)} GC
              </span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
