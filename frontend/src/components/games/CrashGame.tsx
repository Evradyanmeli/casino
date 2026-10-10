import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bomb } from 'lucide-react';
import { crashApi, type CrashState } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import { useAuthStore } from '@/store/authStore';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';

export default function CrashGame() {
  const navigate = useNavigate();
  const { balance, syncBalance } = useBalanceStore();
  const [bet, setBet] = useState(10);
  const [autoCashout, setAutoCashout] = useState(0);
  const userId = useAuthStore(s => s.user?.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useGameError();
  const [pollError, setPollError] = useState<string | null>(null);
  const [crash, setCrash] = useState<CrashState | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [history, setHistory] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const pointsRef = useRef<{ x: number; y: number }[]>([{ x: 0, y: 1 }]);
  const mountedRef = useRef(true);
  const recordedRef = useRef(false);
  const balanceSignatureRef = useRef('');
  const observedRoundRef = useRef('');
  const displayRef = useRef(1);
  const me = crash?.players.find(player => player.userId === userId);
  const hasBet = !!me && me.cashedOutAt === null && crash?.state !== 'crashed';

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const points = pointsRef.current;
    if (points.length < 2) return;

    const maxX = Math.max(points[points.length - 1].x, 1);
    const maxY = Math.max(...points.map(p => p.y), 2);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of points) {
      const x = (p.x / maxX) * w;
      const y = h - ((p.y - 1) / (maxY - 1)) * (h - 20) - 10;
      ctx.lineTo(x, Math.max(y, 0));
    }

    if (crashed) {
      ctx.strokeStyle = '#FF1744';
      ctx.shadowColor = '#FF1744';
    } else {
      ctx.strokeStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
    }
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastY = h - ((points[points.length - 1].y - 1) / (maxY - 1)) * (h - 20) - 10;
    const lastX = w;

    ctx.beginPath();
    ctx.arc(lastX, Math.max(lastY, 0), 4, 0, Math.PI * 2);
    ctx.fillStyle = crashed ? '#FF1744' : '#00E5FF';
    ctx.fill();
  }, [crashed]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let backoff = 2000;
    const fetchState = async () => {
      try {
        const state = await crashApi.getState();
        if (!active) return;
        setCrash(state);
        const ownPlayer = state.players.find(player => player.userId === userId);
        const signature = `${state.roundId}:${state.state}:${ownPlayer?.bet ?? 0}:${ownPlayer?.payout ?? 0}:${ownPlayer?.cashedOutAt ?? ''}`;
        if (signature !== balanceSignatureRef.current) {
          await syncBalance();
          balanceSignatureRef.current = signature;
        }
        backoff = 2000;
        setPollError(null);
      } catch (err: any) {
        if (!active) return;
        if (err.response?.status === 429) {
          backoff = Math.min(backoff * 2, 30000);
          setPollError(`Trop de requetes. Nouvelle tentative dans ${backoff / 1000} s.`);
        } else {
          setPollError(err.response?.data?.error || err.message || 'Etat du jeu indisponible. Nouvelle tentative en cours.');
        }
      } finally {
        if (active) timer = setTimeout(fetchState, backoff);
      }
    };
    fetchState();
    return () => { active = false; mountedRef.current = false; clearTimeout(timer); };
  }, [userId, syncBalance]);

  useEffect(() => {
    if (!crash) return;
    const roundChanged = observedRoundRef.current !== crash.roundId;
    observedRoundRef.current = crash.roundId;
    setCrashed(crash.state === 'crashed');
    if (roundChanged || crash.state === 'waiting') {
      pointsRef.current = [{ x: 0, y: 1 }];
      displayRef.current = 1;
      setMultiplier(1);
    }
    const target = crash.state === 'crashed' ? crash.crashPoint ?? crash.multiplier : crash.multiplier;
    const from = displayRef.current;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - started) / 200, 1);
      // Interpolate observed samples only; never predict the next multiplier.
      const value = from + (target - from) * progress;
      displayRef.current = value;
      setMultiplier(value);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    pointsRef.current.push({ x: pointsRef.current.length, y: target });
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [crash]);

  useEffect(() => {
    if (crash?.state === 'waiting' && !me) recordedRef.current = false;
    if (me && !recordedRef.current && (me.cashedOutAt !== null || crash?.state === 'crashed')) {
      recordedRef.current = true;
      setHistory(h => [{ multiplier: me.cashedOutAt ?? crash?.crashPoint ?? crash?.multiplier ?? 1, payout: me.payout, bet: me.bet }, ...h].slice(0, 15));
    }
  }, [crash, me]);

  useEffect(() => {
    drawGraph();
  }, [multiplier, drawGraph]);

  useEffect(() => {
    const handleResize = () => drawGraph();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawGraph]);

  const placeBet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crashApi.placeBet(bet, autoCashout > 0 ? autoCashout : undefined);
      recordedRef.current = false;
      setCrash(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur de mise');
    } finally {
      setLoading(false);
    }
  }, [bet, autoCashout]);

  const cashOut = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await crashApi.cashOut();
      setCrash(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur de cash out');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const isWaiting = crash?.state === 'waiting';
  const isRunning = crash?.state === 'running' && !crashed;
  const isCrashed = crash?.state === 'crashed' || crashed;

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-gold transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-2xl font-display text-gold">Crash</h1>
          <div className="text-sm text-gray-400">
            Solde: <span className="text-gold font-semibold">{balance.toLocaleString()}</span>
          </div>
        </div>

        {(error || pollError) && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            {error || pollError}
          </div>
        )}

        <div className="card relative overflow-hidden">
          <div className={`text-center py-12 transition-all duration-300 ${isCrashed ? 'animate-pulse' : ''}`}>
            <div
              className={`text-6xl font-display font-bold transition-colors duration-300 ${isCrashed ? 'text-error' : isRunning ? 'text-accent' : 'text-gray-500'}`}
              style={{ textShadow: isRunning ? '0 0 30px rgba(0,229,255,0.5)' : 'none' }}
            >
              {isCrashed ? <Bomb className="w-12 h-12 inline-block" /> : `${multiplier.toFixed(2)}x`}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {isWaiting && 'En attente du prochain round...'}
              {isRunning && 'Course en cours...'}
              {isCrashed && `Crash à ${multiplier.toFixed(2)}x`}
            </div>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-48"
          />
        </div>

        <div className="card space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[10, 25, 50, 100].map(v => (
              <button
                key={v}
                onClick={() => setBet(v)}
                className={`px-4 py-2 rounded-lg border transition-colors ${bet === v ? 'border-gold text-gold bg-gold/10' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="crash-auto" className="text-sm text-gray-400">Auto cashout:</label>
            <input
              id="crash-auto"
              disabled={loading || !!me}
              type="number"
              min={0}
              step={0.1}
              value={autoCashout || ''}
              onChange={e => setAutoCashout(Number(e.target.value) || 0)}
              placeholder="Désactivé"
              className="input-field max-w-[120px]"
            />
          </div>

          {isWaiting && !hasBet && (
            <button
              onClick={placeBet}
              disabled={loading || bet > balance}
              className="btn-primary w-full"
            >
              {loading ? 'Placement...' : bet > balance ? 'Solde insuffisant' : `Miser ${bet} GC`}
            </button>
          )}

          {isRunning && hasBet && (
            <button
              onClick={cashOut}
              disabled={loading}
              className="bg-gold text-black font-bold w-full py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
               {loading ? '...' : `Cash Out (${Math.floor((me?.bet ?? 0) * (crash?.multiplier ?? 1))} GC)`}
            </button>
          )}

          {(isCrashed || isRunning && !hasBet) && (
            <div className="text-center text-sm text-gray-500">
              {isCrashed && 'Nouveau round dans quelques secondes...'}
              {isRunning && !hasBet && (me?.cashedOutAt !== null && me ? `Retour brut : ${me.payout} GC ; resultat net : ${signedNet(me.payout, me.bet)} GC` : 'Attendez le prochain round pour miser')}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Historique</h3>
            <div className="flex gap-2 flex-wrap">
              {history.slice(0, 15).map((h, i) => (
                <div
                  key={i}
                  className={`px-3 py-1 rounded text-sm font-semibold ${h.payout > h.bet ? 'bg-green-900/30 text-success border border-green-700' : 'bg-red-900/30 text-error border border-red-700'}`}
                >
                  {h.multiplier.toFixed(2)}x, brut {h.payout}, net {signedNet(h.payout, h.bet)} GC
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
