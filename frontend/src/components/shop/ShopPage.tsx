import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { CasinoChip } from '@/components/games/GameVisuals';
import { shopApi, type TokenPackage, type PurchaseResult } from '@/services/shop';
import { useBalanceStore } from '@/store/balanceStore';

export default function ShopPage() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const { balance, setBalance } = useBalanceStore();

  useEffect(() => {
    shopApi.getPackages().then(setPackages)
      .catch(() => setError('Impossible de charger les offres. Veuillez réessayer plus tard.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg: TokenPackage) => {
    if (busy.current) return;
    busy.current = true;
    setPurchasing(pkg.id);
    setError(null);
    setResult(null);
    try {
      const res = await shopApi.purchase(pkg.id);
      setResult(res);
      setBalance(res.newBalance);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Achat simulé non confirmé. Vérifiez votre solde avant de réessayer.');
    } finally {
      busy.current = false;
      setPurchasing(null);
    }
  };

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <Layout>
      <div className="min-w-0 space-y-6 [&_button]:min-h-11">
        <PageHeader title={t('shop.title')} eyebrow="La boutique CasinoX" description="Choisissez vos jetons de jeu. Le plaisir du casino, sans argent réel." backTo="/lobby">
          <div className="casino-kpi casino-panel min-w-0 px-5 py-3">
            <p className="text-xs text-slate-400">Votre solde</p>
            <p className="mt-1 break-words text-xl font-semibold tabular-nums text-[#e6cc94]">{balance.toLocaleString()} GC</p>
          </div>
        </PageHeader>

        <section className="casino-stage flex flex-wrap items-center gap-4 rounded-2xl border border-[#d1b675]/20 p-5 sm:p-6" aria-label="Achats simulés">
          <CasinoChip color="#9b8049" className="!h-14 !w-14" />
          <div className="min-w-0 flex-1 basis-48">
            <p className="casino-eyebrow">Achat SIMULÉ</p>
            <h2 className="mt-1 text-xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>Des jetons, pas un paiement.</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#b8c5be]">Les prix sont indicatifs. Aucun paiement réel, aucune carte bancaire et aucun retrait d'argent. Les GC sont des jetons virtuels.</p>
          </div>
        </section>

        {error && <p role="alert" className="casino-panel break-words border border-red-400/30 p-4 text-sm text-red-200">{error}</p>}
        {result && <section role="status" className="casino-panel space-y-3 border border-[#d1b675]/30 p-5">
          <p className="casino-eyebrow">Achat simulé confirmé</p>
          <h2 className="break-words text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{t('shop.success')}</h2>
          <p className="break-words text-sm text-slate-300">{t('shop.received')} <strong className="tabular-nums text-[#e6cc94]">{result.tokensAwarded.toLocaleString()} GC</strong></p>
          <p className="break-words text-sm text-slate-300">{t('shop.newBalance')}: <strong className="tabular-nums text-white">{result.newBalance.toLocaleString()} GC</strong></p>
          <Button variant="outline" onClick={() => setResult(null)}>{t('shop.close')}</Button>
        </section>}

        {loading ? (
          <p role="status" className="casino-empty casino-panel p-8 text-slate-400">{t('common.loading')}</p>
        ) : (
          <section aria-label="Offres de jetons" aria-busy={purchasing !== null} className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg, index) => (
              <article
                key={pkg.id}
                className={`casino-panel relative flex min-w-0 flex-col overflow-hidden ${pkg.popular ? 'ring-1 ring-[#d1b675]/50' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] break-words rounded-full border border-[#d1b675]/30 bg-[#182b25] px-3 py-1 text-xs font-semibold text-[#e6cc94]">
                    {t('shop.popular')}
                  </div>
                )}
                <div className="relative flex h-44 items-end justify-center gap-1 border-b border-white/5 bg-[radial-gradient(ellipse_at_bottom,#284337,#131e29_75%)] pb-7" aria-hidden="true">
                  {[0, 1, 2].map(stack => <div key={stack} className="relative h-24 w-20">
                    {Array.from({ length: Math.min(index + 3 + stack, 7) }, (_, chip) => <div key={chip} className="absolute left-0" style={{ bottom: chip * 6, transform: `rotate(${stack * 13 - 13}deg)` }}>
                      <CasinoChip color={stack === 1 ? '#9b8049' : stack === 0 ? '#294c3e' : '#29323c'} className="!h-20 !w-20 drop-shadow-lg" />
                    </div>)}
                  </div>)}
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="casino-eyebrow">Collection de jetons</p>
                  <h3 className="mt-2 break-words text-2xl text-[#f1e7d1]" style={{ fontFamily: 'Georgia, serif' }}>{pkg.name}</h3>
                  <p className="mt-5 text-xs text-slate-400">Total crédité</p>
                  <p className="mt-1 break-words text-3xl font-semibold tabular-nums text-[#e6cc94]">{(pkg.tokens + (pkg.bonus ?? 0)).toLocaleString()} <span className="text-sm">GC</span></p>
                  <dl className="my-5 space-y-2 border-y border-white/10 py-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-slate-400">Jetons de base</dt><dd className="min-w-0 break-words font-medium tabular-nums text-slate-200">{pkg.tokens.toLocaleString()} GC</dd></div>
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-slate-400">Bonus inclus</dt><dd className="min-w-0 break-words font-medium tabular-nums text-[#c5d8ca]">+{(pkg.bonus ?? 0).toLocaleString()} GC</dd></div>
                  </dl>
                  <div className="mb-4 mt-auto flex flex-wrap items-baseline justify-between gap-2"><span className="text-xs text-slate-400">Prix simulé</span><span className="break-words text-xl font-semibold tabular-nums text-[#f1e7d1]">{formatPrice(pkg.price)}</span></div>
                  <Button fullWidth variant={pkg.popular ? 'primary' : 'outline'} disabled={purchasing !== null} onClick={() => handlePurchase(pkg)} aria-label={`Achat simulé : ${pkg.name}`} className="whitespace-normal break-words text-sm">
                    {purchasing === pkg.id ? t('shop.purchasing') : 'Simuler cet achat'}
                  </Button>
                </div>
              </article>
            ))}
            {packages.length === 0 && !error && <p className="casino-empty casino-panel p-8 text-sm text-slate-400 md:col-span-2 xl:col-span-3">Aucune offre disponible pour le moment.</p>}
          </section>
        )}
      </div>
    </Layout>
  );
}
