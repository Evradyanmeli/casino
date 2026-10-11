import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi, type PlinkoResult } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import { PLINKO_MULTIPLIERS } from './gameMath';
import GameHeader from './GameHeader';
import { useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { useGameError } from './useGameError';

export function plinkoBallPosition(
  rows: number,
  result: Pick<PlinkoResult, 'path' | 'slot'>,
  progress: number,
) {
  const width = (rows + 1) * 50;
  const step = Math.max(0, Math.min(progress, 1)) * (rows + 1);
  const branches = Math.min(step, rows);
  const completed = Math.floor(branches);
  const col = result.path
    .slice(0, completed)
    .reduce((sum, direction) => sum + direction, 0);
  const partial = branches - completed;
  const direction = result.path[completed] ?? 0;
  const pathX = width / 2 + (col + direction * partial - branches / 2) * 50;
  if (step >= rows) {
    const landing = Math.min(step - rows, 1);
    // The final segment ends at the authoritative slot, even if the path is incomplete.
    return {
      x: pathX + (result.slot * 50 + 25 - pathX) * landing,
      y: 40 + rows * 30 + 35 * landing,
    };
  }
  return { x: pathX, y: 40 + branches * 30 - Math.sin(partial * Math.PI) * 5 };
}

export default function PlinkoGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const reducedMotion = useReducedMotion();
  const [bet, setBet] = useState(10);
  const [roundBet, setRoundBet] = useState(0);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [rows, setRows] = useState(12);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useGameError();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const startedRef = useRef(0);
  const finishedRef = useRef(false);
  const width = (rows + 1) * 50;
  const height = 40 + rows * 30 + 60;
  const table = result?.multipliers ?? PLINKO_MULTIPLIERS[risk][rows];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const finish = () => {
      if (finishedRef.current || !result) return;
      finishedRef.current = true;
      busyRef.current = false;
      setFinished(true);
      setLoading(false);
    };
    if (!ctx) {
      if (result) {
        setError('Animation indisponible ; le resultat serveur est affiche.');
        finish();
      }
      return;
    }
    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        if (result) finish();
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(rect.width * dpr);
      const pixelHeight = Math.round(rect.height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      const progress = result
        ? finishedRef.current || reducedMotion
          ? 1
          : Math.min((now - startedRef.current) / (rows * 90 + 220), 1)
        : 0;
      ctx.clearRect(0, 0, width, height);
      const background = ctx.createRadialGradient(
        width / 2,
        height / 3,
        10,
        width / 2,
        height / 2,
        width * 0.7,
      );
      background.addColorStop(0, '#24364a');
      background.addColorStop(1, '#0b1424');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      // Keep the original peg spacing and branch geometry; lighting is presentation only.
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= row; col++) {
          const x = width / 2 + (col - row / 2) * 50;
          const y = 55 + row * 30;
          ctx.beginPath();
          ctx.arc(x, y + 2, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#00000060';
          ctx.fill();
          const metal = ctx.createRadialGradient(x - 1.5, y - 2, 0, x, y, 4.5);
          metal.addColorStop(0, '#f5e9cf');
          metal.addColorStop(0.4, '#b5b8bc');
          metal.addColorStop(1, '#536173');
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = metal;
          ctx.fill();
        }
      }
      for (let slot = 0; slot <= rows; slot++) {
        const hit = progress === 1 && result?.slot === slot;
        const bucket = ctx.createLinearGradient(0, height - 40, 0, height - 10);
        bucket.addColorStop(
          0,
          hit ? '#f4d888' : table[slot] >= 2 ? '#705236' : '#263e4f',
        );
        bucket.addColorStop(1, hit ? '#b78329' : '#131e2f');
        ctx.fillStyle = bucket;
        ctx.fillRect(slot * 50 + 2, height - 40, 46, 30);
        ctx.strokeStyle = hit ? '#ffedb1' : '#b8a17150';
        ctx.lineWidth = hit ? 2 : 1;
        ctx.strokeRect(slot * 50 + 2, height - 40, 46, 30);
        ctx.fillStyle = hit ? '#101827' : '#e4d8bb';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${table[slot]}x`, slot * 50 + 25, height - 20);
      }
      if (!result) return;
      // A static trace also makes the server path legible with reduced motion.
      ctx.beginPath();
      const start = plinkoBallPosition(rows, result, 0);
      ctx.moveTo(start.x, start.y);
      for (let branch = 1; branch <= rows + 1; branch++) {
        const at = branch / (rows + 1);
        if (at > progress) break;
        const point = plinkoBallPosition(rows, result, at);
        ctx.lineTo(point.x, point.y);
      }
      const ball = plinkoBallPosition(rows, result, progress);
      ctx.lineTo(ball.x, ball.y);
      ctx.strokeStyle = '#e8c46870';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      const gold = ctx.createRadialGradient(
        ball.x - 2,
        ball.y - 3,
        0,
        ball.x,
        ball.y,
        7,
      );
      gold.addColorStop(0, '#fff9db');
      gold.addColorStop(0.35, '#ffe29a');
      gold.addColorStop(1, '#ad7121');
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = gold;
      ctx.shadowColor = '#e8c468';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (progress === 1) finish();
    };
    const animate = (now: number) => {
      draw(now);
      if (result && !finishedRef.current)
        frame = requestAnimationFrame(animate);
    };
    animate(performance.now());
    // Resize redraws at the current elapsed time, without starting a new drop.
    const resize = () => draw(performance.now());
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [result, rows, risk, width, height, reducedMotion, setError]);

  const handleDrop = async () => {
    if (busyRef.current || !Number.isFinite(bet) || bet < 1) return;
    busyRef.current = true;
    finishedRef.current = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setFinished(false);
    try {
      const res = await gamesApi.plinko.drop(bet, risk, rows);
      if (!mountedRef.current) return;
      setRoundBet(bet);
      startedRef.current = performance.now();
      setResult(res);
    } catch (err: any) {
      busyRef.current = false;
      if (mountedRef.current) {
        setError(
          err.response?.data?.error || err.message || 'Erreur de lancer',
        );
        setLoading(false);
      }
    }
  };

  const changeConfig = () => {
    setResult(null);
    setFinished(false);
    finishedRef.current = false;
  };
  return (
    <div className="min-w-0 space-y-6">
      <GameHeader
        title="Plinko"
        eyebrow="La cascade doree"
        description="Une bille, un chemin, une case. Choisissez les rangees et le niveau de risque."
        onBack={() => navigate('/lobby')}
      />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <section
          className="casino-stage min-w-0 overflow-hidden rounded-2xl border border-gold/20 bg-[#101c30] p-2 sm:p-4"
          aria-label="Plateau Plinko"
          aria-busy={loading}
          style={{
            boxShadow: 'inset 0 1px 0 #ffffff15, 0 16px 40px #00000030',
          }}
        >
          <div className="flex flex-wrap justify-between gap-3 px-2 py-3 text-xs uppercase tracking-widest text-slate-400">
            <span>{rows} rangees</span>
            <span className="text-gold">
              Risque{' '}
              {risk === 'low' ? 'bas' : risk === 'medium' ? 'moyen' : 'haut'}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            role="img"
            aria-label={
              finished && result
                ? `Bille arrivee case ${result.slot + 1}, multiplicateur ${result.multiplier}x. Chemin serveur : ${result.path.map((d) => (d ? 'droite' : 'gauche')).join(', ')}.`
                : 'Plateau Plinko, chemin et resultat reveles apres le lancer'
            }
            className="block h-auto w-full max-w-full rounded-xl"
            style={{ aspectRatio: `${width} / ${height}` }}
          />
          <p
            role="status"
            aria-live="polite"
            className="px-2 py-3 text-center text-sm text-slate-400"
          >
            {loading
              ? result
                ? 'La bille suit le chemin serveur...'
                : 'Validation du lancer...'
              : finished && result
                ? `Case ${result.slot + 1} : ${result.multiplier}x`
                : 'Pret pour le prochain lancer.'}
          </p>
          <details className="px-2 pb-3 text-xs text-slate-300">
            <summary className="min-h-[44px] cursor-pointer py-3 text-gold">
              Multiplicateurs par case
            </summary>
            <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {table.map((multiplier, slot) => (
                <li
                  key={slot}
                  className={`rounded-lg border p-2 text-center ${finished && result?.slot === slot ? 'border-gold bg-gold/10 text-gold' : 'border-slate-600/40'}`}
                >
                  Case {slot + 1}
                  <span className="mt-1 block font-semibold">
                    {multiplier}x
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </section>
        <section
          className="casino-panel card space-y-5"
          aria-label="Commandes Plinko"
        >
          <fieldset disabled={loading} className="min-w-0 space-y-4">
            <div>
              <label
                htmlFor="plinko-bet"
                className="mb-2 block text-sm text-slate-300"
              >
                Mise en GC
              </label>
              <input
                id="plinko-bet"
                type="number"
                inputMode="numeric"
                value={bet}
                onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
                className="input-field min-h-[48px]"
                min={1}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="plinko-risk"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Risque
                </label>
                <select
                  id="plinko-risk"
                  value={risk}
                  onChange={(e) => {
                    changeConfig();
                    setRisk(e.target.value as typeof risk);
                  }}
                  className="input-field min-h-[48px]"
                >
                  <option value="low">Bas</option>
                  <option value="medium">Moyen</option>
                  <option value="high">Haut</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="plinko-rows"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Rangees
                </label>
                <select
                  id="plinko-rows"
                  value={rows}
                  onChange={(e) => {
                    changeConfig();
                    setRows(Number(e.target.value));
                  }}
                  className="input-field min-h-[48px]"
                >
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={16}>16</option>
                </select>
              </div>
            </div>
          </fieldset>
          <button
            onClick={() => void handleDrop()}
            disabled={
              loading || !Number.isFinite(bet) || bet < 1 || bet > balance
            }
            className="btn-primary min-h-[48px] w-full"
          >
            {loading
              ? 'En cours...'
              : bet > balance
                ? 'Solde insuffisant'
                : 'Lacher la bille'}
          </button>
          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <div role="status" aria-live="polite">
            {result && finished && (
              <div className="space-y-2 text-center">
                <p className="font-display text-xl text-gold">
                  {result.multiplier}x
                </p>
                <ResultSummary payout={result.payout} bet={roundBet} />
              </div>
            )}
          </div>
          <p className="border-t border-slate-700/60 pt-4 text-xs leading-relaxed text-slate-400">
            Le chemin, la case et le paiement viennent du serveur. Les
            multiplicateurs affiches correspondent exactement au niveau de
            risque choisi.
          </p>
        </section>
      </div>
    </div>
  );
}
