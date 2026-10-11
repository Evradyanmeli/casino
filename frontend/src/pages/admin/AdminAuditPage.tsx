import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { adminApi } from '@/services/admin';
import type { AuditLog } from '@/types';
import { requestError } from '@/services/feedback';

const ACTION_OPTIONS = ['house_recharge', 'update_game_config', 'delete_chat_message', 'ban_chat_user', 'create_announcement', 'adjust_balance', 'toggle_ban'];

export default function AdminAuditPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    setError('');
    let active = true;
    const params: { limit: number; offset: number; action?: string; startDate?: string; endDate?: string } = { limit, offset: (page - 1) * limit };
    if (filterAction) params.action = filterAction;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    adminApi.getAuditLogs(params)
      .then(r => { if (active) { setLogs(r.logs); setTotal(r.total); } })
      .catch(err => { if (active) setError(requestError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, filterAction, startDate, endDate]);

  const getActionColor = (action: string) => {
    if (action.includes('recharge')) return 'text-success';
    if (action.includes('delete') || action.includes('ban')) return 'text-error';
    if (action.includes('update') || action.includes('edit')) return 'text-gold';
    return 'text-gray-300';
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title={t('admin.auditLogs')} eyebrow="Administration" />

      <div className="casino-panel grid grid-cols-1 gap-4 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto] items-end">
        <div className="min-w-0">
          <label htmlFor="audit-action" className="block text-xs text-gray-400 mb-1">{t('admin.action')}</label>
          <select
            id="audit-action"
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            className="input-field min-h-11 min-w-0 w-full text-sm py-2 pr-8"
          >
            <option value="">{t('admin.all')}</option>
            {ACTION_OPTIONS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-start" className="block text-xs text-gray-400 mb-1">{t('admin.from')}</label>
          <input id="audit-start" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className="input-field min-h-11 min-w-0 w-full text-sm py-2" />
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-end" className="block text-xs text-gray-400 mb-1">{t('admin.to')}</label>
          <input id="audit-end" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className="input-field min-h-11 min-w-0 w-full text-sm py-2" />
        </div>
        <Button variant="ghost" onClick={() => { setFilterAction(''); setStartDate(''); setEndDate(''); setPage(1); }} className="min-h-11 text-sm">
          {t('admin.clear')}
        </Button>
      </div>

      {loading ? (
        <p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p>
      ) : error ? <p role="alert" className="casino-panel p-5 break-words text-error">{error}</p> : (
        <>
          <p className="text-sm text-gray-400">{total} {t('admin.entries')}</p>
          <div className="admin-table-wrap max-w-full overflow-x-auto" role="region" aria-label={t('admin.auditLogs')} tabIndex={0}>
            <table className="admin-table w-full min-w-[760px] text-sm tabular-nums">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-2">{t('admin.date')}</th>
                  <th className="text-left py-2 px-2">{t('admin.admin')}</th>
                  <th className="text-left py-2 px-2">{t('admin.action')}</th>
                  <th className="text-left py-2 px-2">{t('admin.entity')}</th>
                  <th className="text-right py-2 px-2">{t('admin.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.03] [&_td]:max-w-64 [&_td]:break-words">
                    <td className="py-2 px-2 text-gray-300 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2 px-2 text-white">{log.admin?.pseudo || log.adminId}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-semibold ${getActionColor(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="py-2 px-2 text-gray-300 text-xs">{log.entity}{log.entityId ? `:${log.entityId.slice(0, 8)}` : ''}</td>
                    <td className="py-2 px-2 text-right">
                      <span className="text-xs text-gray-500">
                        {log.after ? Object.keys(log.after as object).slice(0, 2).join(', ') : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                   <tr><td colSpan={5} className="casino-empty text-center py-8 text-gray-400">{t('admin.noLogs')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              {t('admin.previous')}
            </Button>
            <span className="text-sm text-gray-400">{t('admin.page')} {page}</span>
            <Button variant="ghost" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>
              {t('admin.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
