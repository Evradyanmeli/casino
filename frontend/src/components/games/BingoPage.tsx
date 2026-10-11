import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Star, PartyPopper } from 'lucide-react';
import { useBingoStore, subscribeBingo, BingoCard } from '@/store/bingoStore';
import { useAuthStore } from '@/store/authStore';
import ResultSummary from './ResultSummary';
import GameHeader from './GameHeader';
import { CasinoChip } from './GameVisuals';

const PATTERN_LABELS: Record<string, string> = {
  line: 'Ligne',
  x: 'X (diagonales)',
  full: 'Plein (carte complète)',
};

const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'];

function getColumnLetter(number: number): string {
  if (number <= 15) return 'B';
  if (number <= 30) return 'I';
  if (number <= 45) return 'N';
  if (number <= 60) return 'G';
  return 'O';
}

function getCompletion(card: BingoCard | null, pattern: string): number {
  if (!card) return 0;
  const marked = card.marked;
  if (pattern === 'full') {
    return marked.flat().filter(Boolean).length / 25;
  }
  if (pattern === 'x') {
    let count = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if ((row === col || row + col === 4) && marked[row][col]) count++;
      }
    }
    return count / 9;
  }
  let best = 0;
  for (let row = 0; row < 5; row++) {
    const pct = marked[row].filter(Boolean).length / 5;
    if (pct > best) best = pct;
  }
  for (let col = 0; col < 5; col++) {
    const count = marked.reduce((s, r) => s + (r[col] ? 1 : 0), 0);
    if (count / 5 > best) best = count / 5;
  }
  const d1 = marked.reduce((s, r, i) => s + (r[i] ? 1 : 0), 0) / 5;
  if (d1 > best) best = d1;
  const d2 = marked.reduce((s, r, i) => s + (r[4 - i] ? 1 : 0), 0) / 5;
  if (d2 > best) best = d2;
  return best;
}

function BallDisplay({ number, remaining }: { number: number | null; remaining: number }) {
  if (number === null) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div aria-hidden="true" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/10 shadow-inner flex items-center justify-center bg-black/20">
          <span className="text-gold text-xs tracking-widest">BINGO</span>
        </div>
        <span className="text-xs text-gray-500">En attente...</span>
      </div>
    );
  }
  const letter = getColumnLetter(number);
  const letterColors: Record<string, string> = {
    B: '#a52d37',
    I: '#bb8b26',
    N: '#36598e',
    G: '#337057',
    O: '#bb622c',
  };
  return (
    <div className="flex flex-col items-center gap-2" role="status" aria-live="polite" aria-label={`Numero appele: ${letter} ${number}, ${remaining} boules restantes`}>
      <div key={number} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-[0_12px_20px_rgba(0,0,0,0.4),inset_0_-6px_10px_rgba(0,0,0,0.35),inset_0_4px_6px_rgba(255,255,255,0.6)] motion-safe:animate-slide-in-right" style={{ background: `radial-gradient(circle at 30% 20%, #ffffff 0%, ${letterColors[letter]} 38%, #191a20 100%)` }}>
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-black/15 flex flex-col items-center justify-center text-[#26211b]" style={{ background: 'radial-gradient(circle at 35% 25%, #ffffff, #f2ead9 65%, #bcae92)' }}>
          <span className="text-xs font-bold">{letter}</span>
          <span className="text-2xl sm:text-3xl font-display font-bold leading-none">{number}</span>
        </div>
      </div>
      <span className="text-xs text-gray-300">{remaining} boules restantes</span>
    </div>
  );
}

function CalledNumbersList({ numbers }: { numbers: number[] }) {
  const groups: Record<string, number[]> = { B: [], I: [], N: [], G: [], O: [] };
  for (const n of numbers) {
    const letter = getColumnLetter(n);
    if (groups[letter]) groups[letter].push(n);
  }

  return (
    <div className="casino-panel p-4 max-h-64 overflow-y-auto">
      <h4 className="text-xs font-display text-gold mb-2 uppercase tracking-wider">Numéros appelés</h4>
      <div className="space-y-1">
        {COLUMN_LETTERS.map((letter) => {
          const nums = groups[letter];
          if (nums.length === 0) return null;
          return (
            <div key={letter} className="flex items-start gap-1.5 text-xs">
              <span className="font-bold text-gold min-w-[14px]">{letter}</span>
              <span className="text-gray-300 flex flex-wrap gap-1">
                {nums.map(n => (
                  <span key={n} className="w-7 h-7 flex items-center justify-center rounded-full border border-[#e0cfaa] bg-gradient-to-br from-white to-[#c9b893] text-[#27221b] shadow-sm text-xs font-bold tabular-nums">
                    {n}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
        {numbers.length === 0 && (
          <span className="text-gray-500 text-xs">Aucun numéro appelé</span>
        )}
      </div>
    </div>
  );
}

function BingoCardView({
  card,
  calledNumbers,
  phase,
  winnerUserId,
  ownerUserId,
}: {
  card: BingoCard | null;
  calledNumbers: number[];
  phase: string;
  winnerUserId: string | null;
  ownerUserId: string | null;
}) {
  const isWon = phase === 'complete' && winnerUserId !== null && winnerUserId === ownerUserId;

  if (!card || !card.numbers) {
    return (
      <div className="casino-panel p-6 text-center">
        <p className="text-gray-500 text-sm">Carte non disponible</p>
      </div>
    );
  }

  return (
    <div className={`p-3 sm:p-4 bg-[#f3ecd9] rounded-lg border border-[#c4b68e] shadow-[0_8px_20px_rgba(0,0,0,0.25)] w-full max-w-[360px] mx-auto ${isWon ? 'ring-2 ring-gold' : ''}`} aria-label={isWon ? 'Votre carte gagnante' : 'Votre carte de bingo'} data-winner={isWon}>
      <div className="flex justify-between gap-2 text-[#756448] text-[10px] uppercase tracking-widest border-b border-[#c4b68e] pb-2 mb-2"><span>Carte de bingo</span><span>#{card.id.slice(-6)}</span></div>
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full mx-auto">
        {COLUMN_LETTERS.map((letter, col) => (
          <div key={`header-${col}`} className="text-center font-display font-bold text-[#792f33] text-lg sm:text-xl py-1">
            {letter}
          </div>
        ))}
        {card.numbers.map((row, rowIdx) =>
          row.map((num, colIdx) => {
            const isFree = num === 0;
            const isMarked = card.marked[rowIdx]?.[colIdx] || isFree;
            const isCalled = isFree || calledNumbers.includes(num);
            const shouldPulse = isWon && isMarked;

            let cellClass = 'aspect-square rounded flex items-center justify-center text-base sm:text-lg tabular-nums font-bold transition-colors duration-200 select-none ';
            if (isFree) {
              cellClass += 'bg-[#792f33] border border-[#792f33] text-[#fff7e4] !text-[10px] sm:!text-xs';
            } else if (isCalled && isMarked) {
              cellClass += 'bg-[#792f33] border border-[#622329] text-white rounded-full';
            } else if (isCalled) {
              cellClass += 'bg-[#e0d2ae] border border-[#ac9870] text-[#423726]';
            } else {
              cellClass += 'bg-white/60 border border-[#d5c9ad] text-[#28231b]';
            }
            if (shouldPulse) {
              cellClass += ' motion-safe:animate-pulse ring-2 ring-gold';
            }

            return (
              <div key={`${rowIdx}-${colIdx}`} className={cellClass} aria-label={isFree ? 'Case libre' : `${num}${isMarked ? ', marque' : ''}`}>
                {isFree ? 'FREE' : num}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BingoRoomLobby({ onBack }: { onBack: () => void }) {
  const { rooms, loading, error, joinRoom, createRoom } = useBingoStore();
  const [showCreate, setShowCreate] = useState(false);
  const [createPattern, setCreatePattern] = useState('line');
  const [createPrice, setCreatePrice] = useState(10);
  const [createMax, setCreateMax] = useState(10);


  const handleCreate = () => {
    createRoom(createPattern, createPrice, createMax);
    setShowCreate(false);
  };

  return (
    <div className="max-w-5xl mx-auto" aria-busy={loading}>
      <div>
        <GameHeader title="Bingo" eyebrow="Salon de bingo" description="Choisissez votre motif et rejoignez un salon." onBack={onBack}>
          <button
            onClick={() => setShowCreate(!showCreate)}
            disabled={loading}
            className="btn-primary min-h-[44px] text-sm py-2 px-4"
          >
            Créer un salon
          </button>
        </GameHeader>
        <div className="casino-stage p-5 sm:p-6 my-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-display text-gold text-xl">Une carte. Le bon motif.</p>
          <p className="text-sm text-gray-300">Les numeros appeles marquent automatiquement votre carte.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {showCreate && (
          <div className="casino-panel p-5 mb-6 [&_button]:min-h-[44px] [&_input]:min-h-[44px] [&_select]:min-h-[44px]">
            <h3 className="text-lg font-display text-white mb-4">Nouveau salon</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Motif</label>
                <select
                  value={createPattern}
                  onChange={(e) => setCreatePattern(e.target.value)}
                  className="input-field py-2 text-sm"
                >
                  <option value="line">Ligne</option>
                  <option value="x">X (diagonales)</option>
                  <option value="full">Plein</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Prix du ticket</label>
                <input
                  type="number"
                  value={createPrice}
                  onChange={(e) => setCreatePrice(Math.max(1, Number(e.target.value)))}
                  min={1}
                  className="input-field py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Max joueurs</label>
                <input
                  type="number"
                  value={createMax}
                  onChange={(e) => setCreateMax(Math.max(2, Math.min(100, Number(e.target.value))))}
                  min={2}
                  max={100}
                  className="input-field py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
               <button onClick={handleCreate} disabled={loading} className="bg-gold text-[#0D0D1A] font-bold py-2 px-4 rounded-lg text-sm hover:brightness-110 transition-all disabled:opacity-50">
                Créer
              </button>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-sm py-2 px-4 hover:text-white transition-all">
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {rooms.length === 0 && !loading && (
            <div className="casino-panel text-center py-12 text-gray-400">
              Aucun salon disponible pour le moment
            </div>
          )}

          {rooms.map((room) => (
            <div key={room.id} className="casino-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-display text-white">Salon Bingo</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    room.phase === 'waiting' ? 'bg-yellow-900/40 text-yellow-400' :
                    room.phase === 'playing' ? 'bg-green-900/40 text-green-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {room.phase === 'waiting' ? 'En attente' : room.phase === 'playing' ? 'En cours' : 'Terminé'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm text-gray-400">
                  <span>{PATTERN_LABELS[room.pattern] || room.pattern}</span>
                  <span>Ticket: {room.ticketPrice}</span>
                  <span>Joueurs: {room.playerCount}/{room.maxPlayers}</span>
                </div>
              </div>
              <button
                onClick={() => joinRoom(room.id)}
                disabled={loading || room.phase !== 'waiting'}
                className="btn-outline min-h-[44px] text-sm py-2 px-4 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {room.phase === 'waiting' ? 'Rejoindre' : room.phase === 'playing' ? 'En cours' : 'Terminé'}
              </button>
            </div>
          ))}
        </div>

        {loading && (
          <div role="status" className="text-center py-8">
            <div className="text-gold font-display text-lg animate-pulse">Chargement...</div>
          </div>
        )}
      </div>
    </div>
  );
}

function BingoRoomView() {
  const {
    currentRoom, myCard, players, calledNumbers, phase, pattern, prize,
    lastCalledNumber, winner, ballCount, loading, error,
    leaveRoom, startGame, callBingo,
  } = useBingoStore();

  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (winner) {
      setShowResult(true);
      const timer = setTimeout(() => setShowResult(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [winner]);


  const handleBack = () => {
    if (currentRoom?.id) {
      leaveRoom(currentRoom.id);
    }
  };

  const authUser = useAuthStore((s) => s.user);
  const isMyWinner = winner && authUser && winner.userId === authUser.id;

  const completion = getCompletion(myCard, pattern);
  const isClose = completion >= 0.8 && phase === 'playing';

  if (!currentRoom) {
    return <div className="text-center py-12 text-gray-500">Chargement du salon...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto" aria-busy={loading}>
      <div>
        <GameHeader title="Bingo" eyebrow={`Salon #${currentRoom.id?.slice(-6)}`} description={PATTERN_LABELS[pattern] || pattern} onBack={() => { if (!loading) handleBack(); }}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
               onClick={handleBack}
               disabled={loading}
               className="min-h-[44px] bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              Quitter
            </button>
          </div>
        </GameHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 my-4">
          <div className="casino-stage p-3 sm:p-5 lg:col-span-2 min-w-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-gold mb-1">Dernier numero</p>
                <BallDisplay number={lastCalledNumber} remaining={ballCount} />
              </div>
              <div className="flex-1 w-full min-w-0">
                <BingoCardView
                  card={myCard}
                  calledNumbers={calledNumbers}
                  phase={phase}
                  winnerUserId={winner?.userId || null}
                  ownerUserId={authUser?.id || null}
                />
              </div>
            </div>

            {phase === 'waiting' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => startGame(currentRoom.id)}
                  disabled={loading || !myCard}
                  className="btn-primary text-lg py-3 px-8"
                >
                  Lancer la partie
                </button>
              </div>
            )}

            {phase === 'playing' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => callBingo(currentRoom.id)}
                  disabled={loading || !myCard}
                  className={`text-2xl font-display font-bold py-4 px-12 rounded-xl transition-all duration-300 ${
                    isClose
                       ? 'bg-gold text-[#0D0D1A] motion-safe:animate-pulse shadow-lg shadow-gold/40'
                      : 'bg-gold/80 text-[#0D0D1A] hover:bg-gold'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Target className="w-8 h-8 inline-block mr-2" /> BINGO !
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="casino-panel p-4">
              <h4 className="text-xs font-display text-gold mb-2 uppercase tracking-wider">Infos</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Motif</span>
                  <span className="text-white">{PATTERN_LABELS[pattern] || pattern}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cagnotte</span>
                   <span className="text-gold font-bold inline-flex items-center gap-2"><CasinoChip className="!w-5 !h-5" />{prize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Joueurs</span>
                  <span className="text-white">{players.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Phase</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    phase === 'waiting' ? 'bg-yellow-900/40 text-yellow-400' :
                    phase === 'playing' ? 'bg-green-900/40 text-green-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {phase === 'waiting' ? 'En attente' : phase === 'playing' ? 'En cours' : 'Terminé'}
                  </span>
                </div>
              </div>
            </div>

            <CalledNumbersList numbers={calledNumbers} />

            <div className="casino-panel p-4">
              <h4 className="text-xs font-display text-gold mb-2 uppercase tracking-wider">Joueurs</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {players.map((p) => (
                   <div key={p.userId} className="flex items-center gap-2 text-sm min-w-0">
                     <div className="w-6 h-6 shrink-0 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white font-bold">
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                     <span className={`min-w-0 break-all ${winner?.userId === p.userId ? 'text-gold font-bold' : 'text-gray-300'}`}>
                      {p.username}
                    </span>
                    {winner?.userId === p.userId && (
                      <span className="text-[10px] text-gold inline-flex items-center gap-0.5"><Star className="w-3 h-3" /> Gagnant</span>
                    )}
                  </div>
                ))}
                {players.length === 0 && (
                  <span className="text-gray-500 text-xs">Aucun joueur</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-2 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {loading && (
          <div role="status" className="mt-2 text-center">
            <span className="text-gold text-sm animate-pulse">Action en cours...</span>
          </div>
        )}

        {winner && showResult && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-label="Resultat du bingo" className="casino-panel p-6 max-w-sm w-full text-center space-y-4">
              <div className="text-5xl flex justify-center"><PartyPopper className="w-12 h-12" /></div>
              <h3 className="text-2xl font-display text-gold">BINGO !</h3>
              {isMyWinner ? (
                <ResultSummary payout={winner.prize} bet={currentRoom.ticketPrice} />
              ) : (
                <p className="text-gray-300">
                  <span className="text-gold font-bold">{winner.username}</span> a gagné{' '}
                  <span className="text-gold font-bold">{winner.prize}</span> !
                </p>
              )}
              <button
                onClick={() => { setShowResult(false); handleBack(); }}
                disabled={loading}
                className="btn-primary min-h-[44px] text-sm"
              >
                Quitter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BingoPage() {
  const { isInRoom } = useBingoStore();
  const navigate = useNavigate();

  useEffect(() => subscribeBingo(), []);

  return isInRoom ? <BingoRoomView /> : <BingoRoomLobby onBack={() => navigate('/lobby')} />;
}
