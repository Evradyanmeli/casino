import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { crashApi, type CrashState } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import { useAuthStore } from '@/store/authStore';
import GameHeader from './GameHeader';
import { CasinoChip, useReducedMotion } from './GameVisuals';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';

export default function CrashGame() {
  const navigate = useNavigate();
  const { balance, syncBalance } = useBalanceStore();
  const reducedMotion = useReducedMotion();
  const userId = useAuthStore((s) => s.user?.id);
  const [bet, setBet] = useState(10);
  const [autoCashout, setAutoCashout] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [pollError, setPollError] = useState<string | null>(null);
  const [crash, setCrash] = useState<CrashState | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [history, setHistory] = useState<
    { multiplier: number; payout: number; bet: number }[]
  >([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const versionRef = useRef(0);
  const recordedRef = useRef('');
  const balanceSignatureRef = useRef('');
  const observedRoundRef = useRef('');
  const roundStartRef = useRef(0);
  const displayRef = useRef(1);
  const me = crash?.players.find((player) => player.userId === userId);
  const hasBet = !!me && me.cashedOutAt === null && crash?.state !== 'crashed';
  const isWaiting = crash?.state === 'waiting';
  const isRunning = crash?.state === 'running';
  const isCrashed = crash?.state === 'crashed';

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(w * dpr);
    const pixelHeight = Math.round(h * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const left = 14,
      right = w - 20,
      top = 18,
      bottom = h - 28;
    ctx.strokeStyle = '#7086a220';
    ctx.lineWidth = 1;
    for (let line = 0; line <= 4; line++) {
      const y = top + ((bottom - top) * line) / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      const x = left + ((right - left) * line) / 4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    const points = pointsRef.current;
    if (!points.length) return;
    const maxX = Math.max(points[points.length - 1].x, 1);
    const maxY = Math.max(2, ...points.map((p) => p.y));
    const coords = points.map((p) => ({
      x: left + (p.x / maxX) * (right - left),
      y: bottom - ((p.y - 1) / (maxY - 1)) * (bottom - top),
    }));
    const color = isCrashed ? '#fb7185' : '#e8c468';
    const fill = ctx.createLinearGradient(0, top, 0, bottom);
    fill.addColorStop(0, isCrashed ? '#fb718535' : '#e8c46835');
    fill.addColorStop(1, '#e8c46800');
    ctx.beginPath();
    ctx.moveTo(coords[0].x, bottom);
    for (const p of coords) ctx.lineTo(p.x, p.y);
    ctx.lineTo(coords[coords.length - 1].x, bottom);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (const p of coords.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const last = coords[coords.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff0c6';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('1.00x', left, h - 8);
  }, [isCrashed]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let backoff = 2000;
    const fetchState = async () => {
      try {
        if (busyRef.current) return;
        const version = versionRef.current;
        const state = await crashApi.getState();
        if (!active || version !== versionRef.current) return;
        setCrash(state);
        const ownPlayer = state.players.find(
          (player) => player.userId === userId,
        );
        const signature = `${state.roundId}:${state.state}:${ownPlayer?.bet ?? 0}:${ownPlayer?.payout ?? 0}:${ownPlayer?.cashedOutAt ?? ''}`;
        if (signature !== balanceSignatureRef.current) {
          await syncBalance();
          if (!active) return;
          balanceSignatureRef.current = signature;
        }
        backoff = 2000;
        setPollError(null);
      } catch (err: any) {
        if (!active) return;
        if (err.response?.status === 429) {
          backoff = Math.min(backoff * 2, 30000);
          setPollError(
            `Trop de requetes. Nouvelle tentative dans ${backoff / 1000} s.`,
          );
        } else
          setPollError(
            err.response?.data?.error ||
              err.message ||
              'Etat du jeu indisponible. Nouvelle tentative en cours.',
          );
      } finally {
        if (active) timer = setTimeout(fetchState, backoff);
      }
    };
    void fetchState();
    return () => {
      active = false;
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [userId, syncBalance]);

  useEffect(() => {
    if (!crash) return;
    let frame = 0;
    const now = performance.now();
    if (
      observedRoundRef.current !== crash.roundId ||
      crash.state === 'waiting'
    ) {
      observedRoundRef.current = crash.roundId;
      roundStartRef.current = now;
      pointsRef.current = [];
      displayRef.current = 1;
    }
    const target =
      crash.state === 'crashed'
        ? (crash.crashPoint ?? crash.multiplier)
        : crash.multiplier;
    const points = pointsRef.current;
    const hasPreviousSample = points.length > 0;
    if (crash.state !== 'waiting' && points[points.length - 1]?.y !== target) {
      points.push({ x: (now - roundStartRef.current) / 1000, y: target });
    }
    drawGraph();
    const from = displayRef.current;
    const animate = (time: number) => {
      const progress = Math.min((time - now) / 200, 1);
      // Smooth only between observed live samples. Cashout never uses this display.
      const value = from + (target - from) * progress;
      displayRef.current = value;
      setMultiplier(value);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    if (reducedMotion || crash.state !== 'running' || !hasPreviousSample) {
      displayRef.current = target;
      setMultiplier(target);
    } else frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [crash, reducedMotion, drawGraph]);

  useEffect(() => {
    if (!me || !crash || (me.cashedOutAt === null && crash.state !== 'crashed'))
      return;
    const key = `${crash.roundId}:${me.userId}`;
    if (recordedRef.current === key) return;
    recordedRef.current = key;
    setHistory((h) =>
      [
        {
          multiplier: me.cashedOutAt ?? crash.crashPoint ?? crash.multiplier,
          payout: me.payout,
          bet: me.bet,
        },
        ...h,
      ].slice(0, 15),
    );
  }, [crash, me]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(drawGraph);
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', drawGraph);
    drawGraph();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', drawGraph);
    };
  }, [drawGraph]);

  const act = async (cashout: boolean) => {
    if (
      busyRef.current ||
      (cashout ? !isRunning || !hasBet : !isWaiting || !!me)
    )
      return;
    busyRef.current = true;
    versionRef.current++;
    setLoading(true);
    setError(null);
    try {
      const state = cashout
        ? await crashApi.cashOut()
        : await crashApi.placeBet(
            bet,
            autoCashout > 0 ? autoCashout : undefined,
          );
      if (mountedRef.current) setCrash(state);
    } catch (err: any) {
      if (mountedRef.current)
        setError(
          err.response?.data?.error || err.message || 'Action indisponible',
        );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <GameHeader
        title="Crash"
        eyebrow="La courbe du risque"
        description="Suivez la course en direct et encaissez avant le crash."
        onBack={() => navigate('/lobby')}
      />
      {(error || pollError) && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200"
        >
          {error || pollError}
        </p>
      )}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <section
          className="casino-stage min-w-0 overflow-hidden rounded-2xl border border-gold/20 p-4 sm:p-6"
          aria-label="Course Crash"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, #29374b 0%, #101c30 65%, #0b1424 100%)',
            boxShadow: 'inset 0 1px 0 #ffffff15, 0 16px 40px #00000030',
          }}
        >
          <div className="flex flex-wrap justify-between gap-3 text-xs uppercase tracking-widest text-slate-400">
            <span>Courbe observee</span>
            <span className={isCrashed ? 'text-red-300' : 'text-gold'}>
              {isRunning
                ? 'En direct'
                : isCrashed
                  ? 'Terminee'
                  : isWaiting
                    ? 'Prochain round'
                    : 'Connexion'}
            </span>
          </div>
          <div className="py-8 text-center">
            <p
              className={`break-all font-display text-5xl font-bold tabular-nums sm:text-7xl ${isCrashed ? 'text-red-300' : isRunning ? 'text-gold' : 'text-slate-400'}`}
              style={{ textShadow: isRunning ? '0 0 35px #e8c46840' : 'none' }}
            >
              {crash ? `${multiplier.toFixed(2)}x` : '--'}
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-sm text-slate-400"
            >
              {isWaiting
                ? 'En attente du prochain round...'
                : isRunning
                  ? 'Course en cours. Le serveur valide chaque retrait.'
                  : isCrashed
                    ? `Crash a ${(crash.crashPoint ?? crash.multiplier).toFixed(2)}x`
                    : 'Connexion au jeu...'}
            </p>
          </div>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Graphique des multiplicateurs observes${crash ? `, dernier echantillon ${crash.multiplier.toFixed(2)}x` : ''}`}
            className="block h-48 w-full sm:h-60"
          />
          <p className="mt-2 text-xs text-slate-500">
            Echantillons serveur, sans prediction de la prochaine valeur.
          </p>
        </section>
        <section
          className="casino-panel card space-y-5"
          aria-label="Commandes Crash"
          aria-busy={loading}
        >
          <fieldset
            disabled={loading || !!me || !isWaiting}
            className="space-y-5"
          >
            <legend className="mb-2 text-sm text-slate-300">Mise en GC</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
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
            <div>
              <label
                htmlFor="crash-auto"
                className="mb-2 block text-sm text-slate-300"
              >
                Auto cashout (multiplicateur)
              </label>
              <input
                id="crash-auto"
                type="number"
                min={0}
                step={0.1}
                value={autoCashout || ''}
                onChange={(e) => setAutoCashout(Number(e.target.value) || 0)}
                placeholder="Desactive"
                className="input-field min-h-[48px]"
              />
              <p className="mt-2 text-xs text-slate-400">
                Laissez vide pour encaisser manuellement.
              </p>
            </div>
          </fieldset>
          {isWaiting && !me && (
            <button
              onClick={() => void act(false)}
              disabled={loading || bet > balance}
              className="btn-primary min-h-[48px] w-full"
            >
              {loading
                ? 'Placement...'
                : bet > balance
                  ? 'Solde insuffisant'
                  : `Miser ${bet} GC`}
            </button>
          )}
          {isRunning && hasBet && (
            <button
              onClick={() => void act(true)}
              disabled={loading}
              className="btn-primary min-h-[48px] w-full"
            >
              {loading ? 'Validation...' : 'Cash Out'}
            </button>
          )}
          <div
            role="status"
            aria-live="polite"
            className="text-sm leading-relaxed text-slate-300"
          >
            {me?.cashedOutAt !== null && me
              ? `Encaisse a ${me.cashedOutAt.toFixed(2)}x. Retour brut : ${me.payout} GC ; net : ${signedNet(me.payout, me.bet)} GC`
              : isCrashed && me
                ? `Retour brut : ${me.payout} GC ; net : ${signedNet(me.payout, me.bet)} GC`
                : isWaiting && hasBet
                  ? `Mise de ${me!.bet} GC enregistree. En attente du depart.`
                  : isRunning && !hasBet
                    ? 'Attendez le prochain round pour miser.'
                    : isCrashed
                      ? 'En attente du prochain round.'
                      : ''}
          </div>
          <p className="border-t border-slate-700/60 pt-4 text-xs leading-relaxed text-slate-400">
            Le montant du retrait depend du multiplicateur valide par le
            serveur, pas de la courbe animee.
          </p>
        </section>
      </div>
      {history.length > 0 && (
        <section className="casino-panel card" aria-label="Historique Crash">
          <h2 className="mb-3 text-sm text-slate-400">Vos derniers rounds</h2>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <p
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${h.payout > h.bet ? 'border-emerald-500/20 bg-emerald-950/30 text-emerald-300' : 'border-red-500/20 bg-red-950/30 text-red-300'}`}
              >
                {h.multiplier.toFixed(2)}x, brut {h.payout}, net{' '}
                {signedNet(h.payout, h.bet)} GC
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
