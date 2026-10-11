import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { limboApi, type LimboState } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import GameHeader from './GameHeader';
import { CasinoChip, useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';

export default function LimboGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const reducedMotion = useReducedMotion();
  const [target, setTarget] = useState(2);
  const [bet, setBet] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [result, setResult] = useState<LimboState | null>(null);
  const [pending, setPending] = useState<LimboState | null>(null);
  const [history, setHistory] = useState<LimboState[]>([]);
  const [displayValue, setDisplayValue] = useState(1);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const startedRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    let frame = 0;
    const finish = () => {
      setDisplayValue(pending.resultMultiplier);
      setResult(pending);
      setHistory((h) => [pending, ...h].slice(0, 20));
      setPending(null);
      setLoading(false);
      busyRef.current = false;
    };
    const animate = (now: number) => {
      const progress = Math.min((now - startedRef.current) / 1100, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      // The display approaches only the received server result, never a random roll.
      setDisplayValue(1 + (pending.resultMultiplier - 1) * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else finish();
    };
    if (reducedMotion) finish();
    else frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [pending, reducedMotion]);

  const play = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setDisplayValue(1);
    try {
      const res = await limboApi.play(bet, target);
      if (!mountedRef.current) return;
      startedRef.current = performance.now();
      setPending(res);
    } catch (err: any) {
      busyRef.current = false;
      if (mountedRef.current) {
        setError(err.response?.data?.error || err.message || 'Erreur de jeu');
        setLoading(false);
      }
    }
  };

  const shownTarget =
    pending?.targetMultiplier ?? result?.targetMultiplier ?? target;
  const value = result?.resultMultiplier ?? (pending ? displayValue : 1);
  const position = Math.min(100, Math.max(0, (Math.log10(value) / 2) * 100));
  const targetPosition = (Math.log10(shownTarget) / 2) * 100;

  return (
    <div className="min-w-0 space-y-6">
      <GameHeader
        title="Limbo"
        eyebrow="La ligne d'or"
        description="Fixez votre cible. Le multiplicateur tire doit l'atteindre pour gagner."
        onBack={() => navigate('/lobby')}
      />
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <section
          aria-label="Tirage Limbo"
          aria-busy={loading}
          className="casino-stage relative min-w-0 overflow-hidden rounded-2xl border border-gold/20 px-4 py-8 sm:px-8 sm:py-12"
          style={{
            background:
              'radial-gradient(ellipse at 50% 40%, #29334a 0%, #111c30 60%, #0b1424 100%)',
            boxShadow: 'inset 0 1px 0 #ffffff15, 0 16px 40px #00000030',
          }}
        >
          <div className="mb-10 flex flex-wrap justify-between gap-3 text-xs uppercase tracking-widest text-slate-400">
            <span>Tirage unique</span>
            <span className="text-gold">Cible {shownTarget.toFixed(2)}x</span>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Multiplicateur tire
            </p>
            <p
              className={`my-4 break-all font-display text-4xl font-bold tabular-nums sm:text-6xl ${result ? (result.won ? 'text-emerald-300' : 'text-red-300') : 'text-gold'}`}
              style={{ textShadow: '0 2px 0 #00000080, 0 0 35px #dfbd5730' }}
            >
              {result || pending ? `${value.toFixed(2)}x` : '--'}
            </p>
          </div>
          <div
            className="relative mx-auto mb-8 mt-12 max-w-lg"
            aria-hidden="true"
          >
            <div
              className="h-4 overflow-hidden rounded-full border border-slate-500/40 bg-black/40 p-1"
              style={{ boxShadow: 'inset 0 2px 6px #00000090' }}
            >
              <div
                className={`h-full rounded-full ${result ? (result.won ? 'bg-emerald-300' : 'bg-red-400') : 'bg-gradient-to-r from-amber-700 to-amber-200'}`}
                style={{
                  width: `${position}%`,
                  boxShadow: '0 0 18px #e8c46860',
                }}
              />
            </div>
            <span
              className="absolute -top-2 h-8 w-0.5 bg-gold"
              style={{
                left: `${targetPosition}%`,
                boxShadow: '0 0 10px #e8c46880',
              }}
            />
            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>1x</span>
              <span>10x</span>
              <span>100x+</span>
            </div>
          </div>
          <div
            role="status"
            aria-live="polite"
            className="min-h-[64px] text-center text-sm text-slate-300"
          >
            {loading ? (
              pending ? (
                'Revelation du multiplicateur...'
              ) : (
                'Validation du tirage...'
              )
            ) : result ? (
              <ResultSummary payout={result.payout} bet={result.bet} />
            ) : (
              'Choisissez votre cible et lancez le tirage.'
            )}
          </div>
        </section>
        <section
          className="casino-panel card space-y-5"
          aria-label="Commandes Limbo"
        >
          <fieldset disabled={loading} className="min-w-0 space-y-5">
            <div>
              <label
                htmlFor="limbo-target"
                className="mb-2 block text-sm text-slate-300"
              >
                Multiplicateur cible{' '}
                <span className="font-semibold text-gold">
                  {target.toFixed(2)}x
                </span>
              </label>
              <input
                id="limbo-target"
                type="range"
                min={1.01}
                max={100}
                step={0.01}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="min-h-[44px] w-full accent-gold"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>1.01x</span>
                <span>100x</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[2, 5, 10].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={target === v}
                    onClick={() => setTarget(v)}
                    className={`min-h-[44px] rounded-lg border text-sm ${target === v ? 'border-gold bg-gold/10 text-gold' : 'border-slate-600 text-slate-300'}`}
                  >
                    {v}x
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p id="limbo-bet-label" className="mb-2 text-sm text-slate-300">
                Mise en GC
              </p>
              <div
                role="group"
                aria-labelledby="limbo-bet-label"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2"
              >
                {[10, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={bet === v}
                    onClick={() => setBet(v)}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm ${bet === v ? 'border-gold bg-gold/10 text-gold' : 'border-slate-600 text-slate-300'}`}
                  >
                    <CasinoChip value={v} className="h-7 w-7" />
                    <span>{v}</span>
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
          <dl className="grid grid-cols-2 gap-3 border-t border-slate-700/60 pt-4 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Probabilite</dt>
              <dd className="mt-1 text-slate-200">
                {(99 / target).toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Paiement cible</dt>
              <dd className="mt-1 text-gold">{target.toFixed(2)}x</dd>
            </div>
          </dl>
          <button
            onClick={() => void play()}
            disabled={loading || bet > balance}
            className="btn-primary min-h-[48px] w-full"
          >
            {loading
              ? 'En cours...'
              : bet > balance
                ? 'Solde insuffisant'
                : 'Lancer le tirage'}
          </button>
          <p className="text-xs leading-relaxed text-slate-400">
            Le tirage et le paiement sont determines par le serveur. La jauge
            revele uniquement le resultat recu.
          </p>
        </section>
      </div>
      {history.length > 0 && (
        <section className="casino-panel card" aria-label="Historique Limbo">
          <h2 className="mb-3 text-sm text-slate-400">Derniers tirages</h2>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {history.map((h, i) => (
              <div
                key={i}
                className={`flex flex-wrap justify-between gap-2 text-sm ${h.payout > h.bet ? 'text-emerald-300' : 'text-red-300'}`}
              >
                <span>
                  {h.resultMultiplier.toFixed(2)}x{' '}
                  <span className="text-slate-400">
                    / cible {h.targetMultiplier.toFixed(2)}x
                  </span>
                </span>
                <span>
                  Brut {h.payout}, net {signedNet(h.payout, h.bet)} GC
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
