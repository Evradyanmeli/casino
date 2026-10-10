import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { shopApi, type TokenPackage, type PurchaseResult } from '@/services/shop';
import { useBalanceStore } from '@/store/balanceStore';

export default function ShopPage() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const { balance, setBalance } = useBalanceStore();

  useEffect(() => {
    shopApi.getPackages().then(setPackages).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg: TokenPackage) => {
    setPurchasing(pkg.id);
    try {
      const res = await shopApi.purchase(pkg.id);
      setResult(res);
      setBalance(res.newBalance);
    } catch {
      /* ignore */
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gold transition-colors text-sm">
              ← Retour
            </button>
            <h1 className="text-2xl font-display text-gold">{t('shop.title')}</h1>
          </div>
          <div className="flex items-center gap-2 bg-[#1A1A2E] rounded-lg px-4 py-2 border border-gray-700">
            <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-gold">{balance.toLocaleString()} GC</span>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400">{t('common.loading')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className={`card relative flex flex-col ${pkg.popular ? 'border-gold/50 ring-1 ring-gold/20' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-[#0D0D1A] text-xs font-bold px-4 py-1 rounded-full">
                    {t('shop.popular')}
                  </div>
                )}
                <div className="flex-1 space-y-3 pt-2">
                  <h3 className="text-xl font-display text-white text-center">{pkg.name}</h3>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-gold">{pkg.tokens.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">GC</p>
                  </div>
                  {pkg.bonus ? (
                    <div className="text-center">
                      <span className="inline-block bg-gradient-to-r from-gold to-amber-500 text-[#0D0D1A] text-sm font-bold px-3 py-1 rounded-full">
                        +{pkg.bonus.toLocaleString()} BONUS
                      </span>
                    </div>
                  ) : (
                    <div className="h-7" />
                  )}
                  <div className="text-center pt-2">
                    <p className="text-lg font-bold text-white">{formatPrice(pkg.price)}</p>
                  </div>
                </div>
                <Button
                  fullWidth
                  variant={pkg.popular ? 'primary' : 'outline'}
                  disabled={purchasing === pkg.id}
                  onClick={() => handlePurchase(pkg)}
                  className="mt-4"
                >
                  {purchasing === pkg.id ? t('shop.purchasing') : t('shop.buy')}
                </Button>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={!!result}
          onClose={() => setResult(null)}
          title={t('shop.success')}
        >
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-lg">
              {t('shop.received')} <span className="text-gold font-bold">{result?.tokensAwarded.toLocaleString()}</span> GC
            </p>
            <p className="text-gray-400">
              {t('shop.newBalance')}: <span className="text-white font-bold">{result?.newBalance.toLocaleString()} GC</span>
            </p>
            <Button fullWidth onClick={() => setResult(null)}>{t('shop.close')}</Button>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
