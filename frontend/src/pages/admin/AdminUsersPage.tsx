import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { adminApi } from '@/services/admin';
import type { AdminUserRow, Transaction } from '@/types';
import { requestError } from '@/services/feedback';

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [balanceModal, setBalanceModal] = useState<AdminUserRow | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [txModal, setTxModal] = useState<AdminUserRow | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [txError, setTxError] = useState('');
  const [banModal, setBanModal] = useState<AdminUserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const txRequest = useRef(0);

  const limit = 20;

  useEffect(() => {
    setLoading(true);
    setError('');
    let active = true;
    adminApi.getUsers(page, limit, search || undefined)
      .then(r => { if (active) { setUsers(r.users); setTotal(r.total); } })
      .catch(err => { if (active) setError(requestError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search]);

  const handleBan = async (id: string) => {
    setSaving(true);
    setActionError('');
    try {
    await adminApi.toggleBan(id);
    setUsers(current => current.map(u => u.id === id ? { ...u, status: u.status === 'BANNED' ? 'ACTIVE' : 'BANNED' } : u));
    setBanModal(null);
    } catch (err) { setActionError(requestError(err)); }
    finally { setSaving(false); }
  };

  const handleAdjustBalance = async () => {
    if (!balanceModal || saving || !Number.isSafeInteger(adjustAmount) || !adjustAmount || !adjustReason.trim()) return;
    setSaving(true);
    setActionError('');
    try {
    await adminApi.adjustBalance(balanceModal.id, adjustAmount, adjustReason);
    setBalanceModal(null);
    setAdjustAmount(0);
    setAdjustReason('');
    const r = await adminApi.getUsers(page, limit, search || undefined);
    setUsers(r.users);
    } catch (err) { setActionError(requestError(err)); }
    finally { setSaving(false); }
  };

  const openTxModal = async (u: AdminUserRow) => {
    const request = ++txRequest.current;
    setTxModal(u);
    setTransactions([]);
    setTxError('');
    setTxLoading(true);
    try {
      const detail = await adminApi.getUserDetails(u.id);
      if (request === txRequest.current) setTransactions(detail.transactions || []);
    } catch (err) {
      if (request === txRequest.current) setTxError(requestError(err));
    } finally {
      if (request === txRequest.current) setTxLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title={t('admin.userManagement')} eyebrow="Administration" />

      <div className="casino-panel p-4 sm:p-5">
      <Input
        id="search"
        label={t('admin.search')}
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder={t('admin.searchPlaceholder', { defaultValue: 'Username or email' })}
      />
      </div>

      {loading ? (
        <p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p>
      ) : error ? <p role="alert" className="casino-panel p-5 break-words text-error">{error}</p> : (
        <>
          <p className="text-sm text-gray-400">{total} {t('admin.users')}</p>
          <div className="admin-table-wrap max-w-full overflow-x-auto" role="region" aria-label={t('admin.userManagement')} tabIndex={0}>
            <table className="admin-table w-full min-w-[960px] text-sm tabular-nums">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-2">{t('auth.register.pseudo')}</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">{t('admin.role')}</th>
                  <th className="text-left py-2 px-2">{t('admin.status')}</th>
                  <th className="text-right py-2 px-2">{t('admin.balance')}</th>
                  <th className="text-right py-2 px-2">{t('admin.level')}</th>
                  <th className="text-right py-2 px-2">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="max-w-48 break-words py-3 px-3 text-white font-medium">{u.pseudo}</td>
                    <td className="max-w-64 break-words py-3 px-3 text-gray-300">{u.email}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-semibold ${u.role === 'ADMIN' ? 'text-gold' : 'text-gray-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-semibold ${u.status === 'BANNED' ? 'text-error' : u.status === 'SUSPENDED' ? 'text-yellow' : 'text-success'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-white">{u.balance.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-white">{u.level}</td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => openTxModal(u)} className="min-h-11 whitespace-nowrap text-xs px-3">
                          {t('admin.transactions')}
                        </Button>
                        <Button variant="ghost" onClick={() => { setActionError(''); setBanModal(u); }} className="min-h-11 whitespace-nowrap text-xs px-3">
                          {u.status === 'BANNED' ? t('admin.unban') : t('admin.ban')}
                        </Button>
                        <Button variant="ghost" onClick={() => { setActionError(''); setAdjustAmount(0); setAdjustReason(''); setBalanceModal(u); }} className="min-h-11 whitespace-nowrap text-xs px-3">
                          {t('admin.balance')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                   <tr><td colSpan={7} className="casino-empty text-center py-8 text-gray-400">{t('admin.noUsers')}</td></tr>
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

      {actionError && !balanceModal && !banModal && <p role="alert" className="text-error">{actionError}</p>}
      <Modal isOpen={!!banModal} onClose={() => setBanModal(null)} title={banModal?.status === 'BANNED' ? t('admin.unban') : t('admin.ban')}>
        <p className="text-gray-300 break-words mb-4">{t('admin.confirmUserAction', { name: banModal?.pseudo, defaultValue: 'Confirm this action for {{name}}?' })}</p>
        {actionError && <p role="alert" className="text-error mb-3">{actionError}</p>}
        <Button disabled={saving} onClick={() => banModal && handleBan(banModal.id)}>{t('common.confirm')}</Button>
      </Modal>
      <Modal
        isOpen={!!balanceModal}
        onClose={() => setBalanceModal(null)}
        title={`${t('admin.adjustBalance')} - ${balanceModal?.pseudo || ''}`}
      >
        <div className="space-y-4">
          {actionError && <p role="alert" className="text-error">{actionError}</p>}
          <p className="text-gray-400">{t('admin.currentBalance')}: <span className="text-white font-bold">{balanceModal?.balance.toLocaleString()} GC</span></p>
          <Input id="amount" label={`${t('admin.amount')} (GC)`} type="number" step="1" required value={String(adjustAmount)} onChange={e => setAdjustAmount(Number(e.target.value))} />
          <Input id="reason" label={t('admin.reason', { defaultValue: 'Reason (required)' })} type="text" required value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setBalanceModal(null)}>{t('common.cancel')}</Button>
            <Button fullWidth onClick={handleAdjustBalance} disabled={saving || !Number.isSafeInteger(adjustAmount) || !adjustAmount || !adjustReason.trim()}>{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!txModal}
        onClose={() => { ++txRequest.current; setTxModal(null); }}
        title={`${t('admin.transactions')} - ${txModal?.pseudo || ''}`}
      >
        <div className="space-y-2 max-h-[60dvh] overflow-y-auto overscroll-contain">
          {txLoading ? (
            <p role="status" className="casino-empty text-gray-400">{t('common.loading')}</p>
          ) : txError ? <p role="alert" className="text-error">{txError}</p> : transactions.length === 0 ? (
            <p className="casino-empty text-gray-400">{t('admin.noTransactions')}</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex flex-wrap justify-between items-start gap-3 py-3 border-b border-white/10 last:border-0">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm text-white break-words">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <span className={`max-w-full break-words text-sm tabular-nums font-semibold ${tx.amount >= 0 ? 'text-success' : 'text-error'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} GC
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
