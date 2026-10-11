import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bomb, Grid3X3, XCircle } from 'lucide-react';
import { minesApi, type MinesState } from '@/services/games';
import { useBalanceStore } from '@/store/balanceStore';
import GameHeader from './GameHeader';
import { CasinoChip, SlotSymbol, useReducedMotion } from './GameVisuals';
import ResultSummary from './ResultSummary';
import { signedNet } from './gameMath';
import { useGameError } from './useGameError';

export default function MinesGame() {
  const navigate = useNavigate();
  const { balance } = useBalanceStore();
  const reducedMotion = useReducedMotion();
  const [mineCount, setMineCount] = useState(3);
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState<MinesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [flippingTile, setFlippingTile] = useState<number | null>(null);
  const [error, setError] = useGameError();
  const [history, setHistory] = useState<{ payout: number; bet: number }[]>([]);
  const busyRef = useRef(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) setFlippingTile(null);
  }, [reducedMotion]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    minesApi
      .getState()
      .then((state) => {
        if (!active) return;
        setGame(state);
        if (state) {
          setBet(state.bet);
          setMineCount(state.mineCount);
        }
      })
      .catch((err) => {
        if (active)
          setError(err.response?.data?.error || 'Session indisponible');
      })
      .finally(() => {
        if (active) {
          busyRef.current = false;
          setLoading(false);
        }
      });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [setError]);

  const act = async (
    action: 'start' | 'reveal' | 'cashout',
    tileIndex?: number,
  ) => {
    if (busyRef.current) return;
    if (action !== 'start' && (!game || game.state !== 'playing')) return;
    if (action === 'reveal' && game?.grid.flat()[tileIndex!]?.revealed) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    setFlippingTile(null);
    setSelectedTile(action === 'reveal' ? tileIndex! : null);
    try {
      const next =
        action === 'start'
          ? await minesApi.start(bet, mineCount)
          : action === 'reveal'
            ? await minesApi.reveal(game!.sessionId, tileIndex!)
            : await minesApi.cashOut(game!.sessionId);
      if (!mountedRef.current) return;
      setGame(next);
      // Only the chosen tile flips, and only after its outcome is authoritative.
      if (
        action === 'reveal' &&
        !reducedMotion &&
        next.grid.flat()[tileIndex!]?.revealed
      )
        setFlippingTile(tileIndex!);
      if (next.state === 'lost' || next.state === 'won') {
        setHistory((h) =>
          [{ payout: next.payout, bet: next.bet }, ...h].slice(0, 20),
        );
      }
    } catch (err: any) {
      if (mountedRef.current)
        setError(err.response?.data?.error || 'Action indisponible');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setSelectedTile(null);
      }
    }
  };

  const playing = game?.state === 'playing';
  const ended = game?.state === 'won' || game?.state === 'lost';
  const cells =
    game?.grid.flat() ??
    Array.from({ length: 25 }, (_, index) => ({
      index,
      revealed: false,
      isMine: false,
    }));

  return (
    <div className="min-w-0 space-y-6">
      <GameHeader
        title="Mines"
        eyebrow="Le coffre aux gemmes"
        description="Revelez les gemmes. Encaissez avant de toucher une mine."
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
          className="casino-stage min-w-0 rounded-2xl border border-gold/20 p-3 sm:p-6"
          aria-label="Plateau Mines"
          aria-busy={loading}
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, #25384a 0%, #101c30 65%, #0b1424 100%)',
            boxShadow: 'inset 0 1px 0 #ffffff12, 0 16px 40px #00000030',
          }}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" aria-hidden="true" /> Coffre 25 cases
            </span>
            <span className="text-gold">
              {game?.mineCount ?? mineCount} mines
            </span>
          </div>
          <div className="mx-auto grid w-full max-w-[440px] grid-cols-5 gap-1.5 sm:gap-2.5">
            {cells.map((cell, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Case ${i + 1}, ${cell.revealed ? (cell.isMine ? 'mine' : 'gemme') : 'masquee'}`}
                aria-busy={selectedTile === i}
                onClick={() => void act('reveal', i)}
                disabled={!playing || cell.revealed || loading}
                onAnimationEnd={() => {
                  if (flippingTile === i) setFlippingTile(null);
                }}
                className={`relative flex aspect-square min-h-[44px] min-w-0 items-center justify-center rounded-xl border transition-colors motion-reduce:transition-none ${cell.revealed ? (cell.isMine ? 'border-red-400/50 bg-red-950/70 text-red-300' : 'border-emerald-400/40 bg-emerald-950/60') : 'border-slate-500/30 bg-slate-800/80 text-slate-500 enabled:hover:border-gold/70 enabled:hover:text-gold'} ${selectedTile === i ? 'ring-2 ring-gold/60' : ''} ${flippingTile === i && !reducedMotion ? 'animate-flip-tile' : ''}`}
                style={{
                  boxShadow: cell.revealed
                    ? 'inset 0 2px 12px #00000040'
                    : 'inset 0 1px 0 #ffffff18, inset 0 -4px 0 #00000030, 0 3px 6px #00000025',
                }}
              >
                {cell.revealed ? (
                  cell.isMine ? (
                    <Bomb
                      aria-hidden="true"
                      className="h-7 w-7 sm:h-9 sm:w-9"
                      strokeWidth={1.5}
                      style={{ filter: 'drop-shadow(0 2px 3px #000)' }}
                    />
                  ) : (
                    <SlotSymbol
                      symbol="DIAMOND"
                      className="h-9 w-9 sm:h-12 sm:w-12"
                    />
                  )
                ) : (
                  <span
                    aria-hidden="true"
                    className="font-display text-xs tracking-wider"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p
            className="mt-5 text-center text-sm text-slate-400"
            role="status"
            aria-live="polite"
          >
            {loading
              ? selectedTile !== null
                ? `Ouverture de la case ${selectedTile + 1}...`
                : 'Chargement du coffre...'
              : playing
                ? `${game.revealedCount} gemmes ouvertes. Choisissez une case pour reveler son contenu.`
                : ended
                  ? game.state === 'lost'
                    ? 'Mine touchee. Partie terminee.'
                    : 'Coffre encaisse. Partie terminee.'
                  : 'Placez votre mise pour ouvrir le coffre.'}
          </p>
        </section>
        <section
          className="casino-panel card space-y-5"
          aria-label="Commandes Mines"
        >
          {!game ? (
            <>
              <div>
                <label
                  htmlFor="mines-count"
                  className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-slate-300"
                >
                  Nombre de mines{' '}
                  <span className="font-semibold text-gold">
                    {mineCount} / 25
                  </span>
                </label>
                <input
                  id="mines-count"
                  type="range"
                  min={1}
                  max={24}
                  value={mineCount}
                  disabled={loading}
                  onChange={(e) => setMineCount(Number(e.target.value))}
                  className="min-h-[44px] w-full accent-gold"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>1 mine</span>
                  <span>24 mines</span>
                </div>
              </div>
              <fieldset disabled={loading}>
                <legend className="mb-2 text-sm text-slate-300">
                  Mise en GC
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                  {[10, 25, 50, 100].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={bet === v}
                      onClick={() => setBet(v)}
                      className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm ${bet === v ? 'border-gold bg-gold/10 text-gold' : 'border-slate-600 text-slate-300 hover:border-slate-400'}`}
                    >
                      <CasinoChip value={v} className="h-7 w-7" />
                      <span>{v}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                onClick={() => void act('start')}
                disabled={loading || bet > balance}
                className="btn-primary min-h-[48px] w-full"
              >
                {loading
                  ? 'Chargement...'
                  : bet > balance
                    ? 'Solde insuffisant'
                    : 'Ouvrir le coffre'}
              </button>
            </>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gold/15 bg-black/15 p-3">
                  <dt className="text-xs text-slate-400">Multiplicateur</dt>
                  <dd className="mt-1 break-words font-display text-xl text-gold">
                    {game.multiplier.toFixed(2)}x
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-600/30 bg-black/15 p-3">
                  <dt className="text-xs text-slate-400">Gemmes ouvertes</dt>
                  <dd className="mt-1 font-display text-xl text-emerald-300">
                    {game.revealedCount}
                    <span className="text-sm text-slate-500">
                      {' '}
                      / {25 - game.mineCount}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-slate-400">
                Mise de la partie{' '}
                <span className="font-semibold text-slate-200">
                  {game.bet} GC
                </span>
              </p>
              {playing && (
                <button
                  onClick={() => void act('cashout')}
                  disabled={loading || game.revealedCount === 0}
                  className="btn-primary min-h-[48px] w-full whitespace-normal"
                >
                  {loading
                    ? 'Validation...'
                    : game.revealedCount === 0
                      ? 'Revelez une gemme'
                      : `Cash Out (${Math.floor(game.bet * game.multiplier)} GC)`}
                </button>
              )}
              {ended && (
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-3 text-center"
                >
                  {game.state === 'lost' && (
                    <p className="flex items-center justify-center gap-2 text-red-300">
                      <XCircle className="h-5 w-5" aria-hidden="true" /> Mine
                      touchee
                    </p>
                  )}
                  <ResultSummary payout={game.payout} bet={game.bet} />
                  <button
                    onClick={() => {
                      setGame(null);
                      setError(null);
                      setFlippingTile(null);
                    }}
                    className="btn-outline min-h-[48px] w-full"
                  >
                    Nouvelle partie
                  </button>
                </div>
              )}
            </>
          )}
          <p className="border-t border-slate-700/60 pt-4 text-xs leading-relaxed text-slate-400">
            Chaque case est revelee par le serveur. Les gemmes augmentent le
            multiplicateur ; une mine termine la partie.
          </p>
        </section>
      </div>
      {history.length > 0 && (
        <section className="casino-panel card" aria-label="Historique Mines">
          <h2 className="mb-3 text-sm text-slate-400">Dernieres parties</h2>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {history.map((h, i) => (
              <div
                key={i}
                className={`flex flex-wrap justify-between gap-2 text-sm ${h.payout > h.bet ? 'text-emerald-300' : 'text-red-300'}`}
              >
                <span>Retour brut {h.payout} GC</span>
                <span>Net {signedNet(h.payout, h.bet)} GC</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
