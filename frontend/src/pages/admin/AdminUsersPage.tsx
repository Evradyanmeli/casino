import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
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
    if (!balanceModal) return;
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
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-gold">{t('admin.userManagement')}</h1>

      <Input
        id="search"
        label={t('admin.search')}
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder={t('admin.searchPlaceholder')}
      />

      {loading ? (
        <p className="text-gray-400">{t('common.loading')}</p>
      ) : error ? <p role="alert" className="text-error">{error}</p> : (
        <>
          <p className="text-sm text-gray-400">{total} {t('admin.users')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                  <tr key={u.id} className="border-b border-gray-800 hover:bg-[#1A1A2E]/50">
                    <td className="py-2 px-2 text-white font-medium">{u.pseudo}</td>
                    <td className="py-2 px-2 text-gray-300">{u.email}</td>
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
                        <Button variant="ghost" onClick={() => openTxModal(u)} className="text-xs py-1 px-2">
                          {t('admin.transactions')}
                        </Button>
                        <Button variant="ghost" onClick={() => { setActionError(''); setBanModal(u); }} className="text-xs py-1 px-2">
                          {u.status === 'BANNED' ? t('admin.unban') : t('admin.ban')}
                        </Button>
                        <Button variant="ghost" onClick={() => { setActionError(''); setBalanceModal(u); }} className="text-xs py-1 px-2">
                          {t('admin.balance')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">{t('admin.noUsers')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center">
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
        <p className="text-gray-300 mb-4">{t('admin.confirmUserAction', { name: banModal?.pseudo })}</p>
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
          <Input id="amount" label={t('admin.amount')} type="number" value={String(adjustAmount)} onChange={e => setAdjustAmount(Number(e.target.value))} />
          <Input id="reason" label={t('admin.reason')} type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
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
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {txLoading ? (
            <p className="text-gray-400">{t('common.loading')}</p>
          ) : txError ? <p role="alert" className="text-error">{txError}</p> : transactions.length === 0 ? (
            <p className="text-gray-500">{t('admin.noTransactions')}</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm text-white">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-success' : 'text-error'}`}>
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
