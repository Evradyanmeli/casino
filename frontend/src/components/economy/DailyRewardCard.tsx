import { useState, useEffect } from 'react';
import { economyApi, type DailyRewardInfo } from '@/services/economy';
import { useBalanceStore } from '@/store/balanceStore';
import { Gift, Flame } from 'lucide-react';

export function DailyRewardCard() {
  const [info, setInfo] = useState<DailyRewardInfo | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { syncBalance } = useBalanceStore();

  useEffect(() => {
    economyApi.getDailyInfo().then(setInfo);
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const result = await economyApi.claimDailyReward();
      setInfo((prev) => prev ? { ...prev, available: false, streak: result.streak } : prev);
      await syncBalance();
      setToast({ type: 'success', message: `+${result.amount.toLocaleString()} GC réclamés !` });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erreur lors de la réclamation';
      setToast({ type: 'error', message: msg });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setClaiming(false);
    }
  };

  if (!info) {
    return (
      <div className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-5 mb-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-700 rounded mb-2" />
        <div className="h-4 w-32 bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2A1A3E] border border-[#FFD700] rounded-xl p-5 flex items-center justify-between mb-6">
        <div>
          <div className="font-bold text-[#FFD700] text-lg flex items-center gap-2"><Gift className="w-5 h-5" /> Récompense quotidienne</div>
          <div className="text-sm text-gray-400 mt-1">{info.amount.toLocaleString()} GC disponibles</div>
          <div className="text-xs text-[#00E5FF] mt-1 flex items-center gap-1"><Flame className="w-3 h-3" /> Streak : {info.streak} jours</div>
        </div>
        <button
          onClick={handleClaim}
          disabled={!info.available || claiming}
          className={`px-6 py-2.5 rounded-lg font-bold transition text-sm ${
            info.available
              ? 'bg-gradient-to-r from-[#FFD700] to-[#B8960F] text-black hover:brightness-110'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claiming ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              ...
            </span>
          ) : info.available ? 'Réclamer' : 'Réclamé'}
        </button>
      </div>
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-[#00C853] text-white' : 'bg-[#FF1744] text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
