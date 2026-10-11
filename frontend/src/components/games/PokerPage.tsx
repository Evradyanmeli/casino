import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { usePokerStore, subscribePoker, type PokerPlayer } from '@/store/pokerStore';
import { disconnectPokerSocket } from '@/services/pokerSocket';
import GameHeader from './GameHeader';
import { PlayingCard, CasinoChip } from './GameVisuals';

function SeatView({ player, isDealer, isCurrent, isMe }: {
  player: PokerPlayer;
  isDealer: boolean;
  isCurrent: boolean;
  isMe: boolean;
}) {
  return (
    <div className={`casino-panel min-w-0 p-2 sm:p-3 text-center ${isCurrent ? 'ring-1 ring-gold' : ''}`} aria-label={`Siege ${player.seat + 1}: ${player.username}${isCurrent ? ', a son tour' : ''}`}>
      <div className="flex flex-col items-center gap-1 min-w-0">
        <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 flex-wrap">
          <span>Siege {player.seat + 1}</span>
          {isMe && <span className="text-accent">Vous</span>}
          {player.isBot && <Bot className="w-3 h-3" aria-label="Bot" />}
          {isDealer && <span aria-label="Croupier" className="w-5 h-5 rounded-full bg-[#f5eedb] text-black font-bold inline-flex items-center justify-center shadow">D</span>}
        </div>
        <span title={player.username} className={`text-xs sm:text-sm w-full line-clamp-2 break-all font-semibold ${isCurrent ? 'text-gold' : 'text-gray-200'} ${isMe ? 'text-accent' : ''}`}>
          {player.username}
        </span>
        <span className="text-[10px] sm:text-sm tabular-nums text-gold font-bold break-all">{player.chips.toLocaleString()} <span className="sr-only">jetons</span></span>

        {player.holeCards && player.holeCards.length > 0 && (
          <div className="flex gap-0.5 mt-1">
            {player.holeCards.map((card, i) => (
              <PlayingCard key={i} card={card} small className="!w-7 sm:!w-9 !h-auto aspect-[5/7]" />
            ))}
          </div>
        )}

        {player.currentBet > 0 && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            <CasinoChip className="!w-5 !h-5" />
            <span className="text-gold text-[10px] sm:text-xs font-bold tabular-nums"><span className="block text-[9px] font-normal text-slate-400">Mise</span>{player.currentBet.toLocaleString()}</span>
          </div>
        )}

        {player.folded && (
          <span className="text-xs text-red-400 font-bold mt-1">FOLD</span>
        )}

        {player.isAllIn && (
          <span className="text-xs text-orange-400 font-bold mt-1">ALL-IN</span>
        )}

      </div>
    </div>
  );
}

function PokerTableLobby({ onBack }: { onBack: () => void }) {
  const { tables, loading, error, sitDown, joinTable, startBotGame } = usePokerStore();
  const [showBuyIn, setShowBuyIn] = useState<string | null>(null);
  const [buyInAmount, setBuyInAmount] = useState<number>(100);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [quickBuyIn, setQuickBuyIn] = useState<number>(200);


  const handleSitDown = (tableId: string) => {
    sitDown(tableId, selectedSeat, buyInAmount);
    setShowBuyIn(null);
  };

  const handleQuickPlay = () => {
    void startBotGame(quickBuyIn);
  };

  return (
    <div className="max-w-5xl mx-auto" aria-busy={loading}>
      <div>
        <GameHeader title="Poker Texas Hold'em" eyebrow="Salon de poker" description="Choisissez une table ou une session privee contre les bots." onBack={onBack} />

        <div className="casino-stage my-6 p-5 sm:p-6">
          <h3 className="text-white font-display text-lg mb-2">Partie rapide contre les bots</h3>
          <p className="text-gray-400 text-sm mb-3">Session privee avec trois bots temporaires finances par la caisse, chacun avec le meme budget initial que vous. Buy-in : 100 a 1 000 GC.</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              aria-label="Buy-in de la session bots"
              value={quickBuyIn}
              onChange={(e) => setQuickBuyIn(Math.max(100, Number(e.target.value)))}
              min={100}
              max={1000}
              className="input-field min-h-[44px] py-1.5 text-sm w-24"
              placeholder="Buy-in"
            />
            <button
              onClick={handleQuickPlay}
              disabled={loading || !Number.isSafeInteger(quickBuyIn) || quickBuyIn < 100 || quickBuyIn > 1000}
              className="btn-primary min-h-[44px] disabled:opacity-50 text-sm"
            >
              Jouer vs Bots
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {tables.length === 0 && !loading && (
            <div className="casino-panel text-center py-12 text-gray-400">
              Aucune table disponible pour le moment
            </div>
          )}

          {tables.map((table) => (
            <div key={table.id} className="casino-panel p-5 flex flex-col lg:flex-row flex-wrap items-start lg:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-display text-white">{table.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm text-gray-400">
                  <span>SB {table.smallBlind} / BB {table.bigBlind}</span>
                  <span>Joueurs: <span className={table.playerCount > 0 ? 'text-green-400 font-semibold' : ''}>{table.playerCount}/{table.maxPlayers}</span></span>
                  <span>Buy-in: {table.minBuyIn}-{table.maxBuyIn}</span>
                </div>
                <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                  table.phase === 'waiting' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-900/40 text-green-400'
                }`}>
                  {table.phase === 'waiting' ? 'En attente' : 'En cours'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 [&_button]:min-h-[44px]">
                <button
                  onClick={() => joinTable(table.id)}
                  disabled={loading}
                  className="btn-outline text-sm py-2 px-4"
                >
                  Rejoindre (Spectateur)
                </button>
                <button
                  onClick={() => {
                    setShowBuyIn(showBuyIn === table.id ? null : table.id);
                    setBuyInAmount(table.minBuyIn);
                  }}
                  disabled={loading}
                  className="btn-primary text-sm py-2 px-4"
                >
                  S'asseoir
                </button>
              </div>

              {showBuyIn === table.id && (
                <div className="w-full lg:w-auto p-3 bg-black/20 rounded-lg flex flex-wrap items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Buy-in</label>
                    <p className="text-xs text-gray-500 mb-1">Min {table.minBuyIn} / Max {table.maxBuyIn}</p>
                    <input
                      type="number"
                      value={buyInAmount}
                      onChange={(e) => setBuyInAmount(Number(e.target.value))}
                      min={table.minBuyIn}
                      max={table.maxBuyIn}
                      aria-label="Buy-in de la table"
                      className="input-field min-h-[44px] py-1 text-sm w-24"
                    />
                  </div>
                  <button
                    onClick={() => handleSitDown(table.id)}
                    disabled={loading}
                    className="min-h-[44px] bg-gold text-[#0D0D1A] font-bold py-1.5 px-3 rounded-lg text-sm hover:brightness-110 transition-all"
                  >
                    Valider
                  </button>
                </div>
              )}
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

function PokerTableView({ onBack }: { onBack: () => void }) {
  const {
    table, players, communityCards, pot, phase, myCards, isMyTurn,
    isAtTable, mySeat, dealerIndex, currentPlayerIndex, lastAction,
    lastHandResults, minBet, currentRaise, loading, error, sidePots,
    standUp, handleAction, leaveTable, rebuy,
  } = usePokerStore();

  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (lastHandResults) {
      setShowResult(true);
      const timer = setTimeout(() => setShowResult(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastHandResults]);

  useEffect(() => {
    if (table) {
      setRaiseAmount(Math.max(currentRaise * 2, table.bigBlind || minBet));
    }
  }, [table, phase, currentRaise, minBet]);

  const myPlayer = players.find(p => p.seat === mySeat);
  const dealerPlayer = players[dealerIndex];

  const canFold = isMyTurn && !loading;
  const canCheck = isMyTurn && !loading && currentRaise <= (myPlayer?.currentBet || 0);
  const canCall = isMyTurn && !loading && currentRaise > (myPlayer?.currentBet || 0) && phase !== 'showdown';
  const canRaise = isMyTurn && !loading && phase !== 'showdown';
  const callAmount = currentRaise - (myPlayer?.currentBet || 0);

  const sortedPlayers = [...players].sort((a, b) => a.seat - b.seat);
  const seatRows = [sortedPlayers.slice(0, Math.ceil(sortedPlayers.length / 2)), sortedPlayers.slice(Math.ceil(sortedPlayers.length / 2))];

  const handleBack = () => {
    if (isAtTable) {
      standUp(table?.id || '');
    } else {
      leaveTable(table?.id || '');
    }
  };

  if (!table) {
    return <div className="text-center py-12 text-gray-500">Chargement de la table...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto" aria-busy={loading}>
      <div>
        <GameHeader title={table.name} eyebrow={table.mode === 'bots' ? 'Session privee' : 'Texas Hold\'em'} description={`SB ${table.smallBlind} / BB ${table.bigBlind} · #${table.id.slice(-6)}`} onBack={onBack}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {!isAtTable && <span className="text-xs text-gray-300">Spectateur</span>}
            <span className="text-gray-400">SB {table.smallBlind} / BB {table.bigBlind}</span>
            <button
              onClick={handleBack}
              disabled={loading}
              className="min-h-[44px] bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              Quitter
            </button>
          </div>
        </GameHeader>

        {table.mode === 'bots' && <p className="text-xs text-gray-400 mb-3">Quitter couche votre main, sauf si vous etes deja a tapis : la main est alors terminee. Les jetons restants sont rendus, puis les bots sont supprimes.</p>}
        {table.notice && <p role="status" className="text-gold text-sm mb-3">{table.notice}</p>}

        <div className="casino-stage relative p-2 sm:p-5 space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-start" aria-label="Sieges superieurs">
            {seatRows[0].map(player => <SeatView key={player.userId} player={player} isDealer={player.userId === dealerPlayer?.userId} isCurrent={players[currentPlayerIndex]?.userId === player.userId} isMe={player.seat === mySeat} />)}
          </div>

          <div className="casino-table relative z-10 flex flex-col items-center justify-center gap-3 py-8 px-2 sm:px-6 min-w-0">
              <p className="text-xs text-gray-300 tracking-widest uppercase" role="status">{phase === 'waiting' ? 'En attente de la prochaine main' : phase}</p>
              <div className="grid grid-cols-5 gap-1 sm:gap-2 w-full max-w-md" aria-label="Cartes communes">
                {[0, 1, 2, 3, 4].map(i => communityCards[i] ? (
                  <PlayingCard key={i} card={communityCards[i]} className="!w-full !h-auto aspect-[5/7]" />
                ) : (
                  <div key={i} aria-label="Emplacement de carte commune" className="aspect-[5/7] rounded-md border border-white/15 bg-black/15" />
                ))}
              </div>

                <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full bg-black/30 border border-gold/30" aria-live="polite">
                  <CasinoChip className="!w-7 !h-7" />
                  <span className="text-gold font-bold text-sm break-all">Pot: {pot.toLocaleString()}</span>
                </div>

              {sidePots.length > 1 && sidePots.map((sp, i) => (
                sp.amount > 0 && (
                  <div key={i} className="px-3 py-1 rounded-full bg-black/20 border border-orange-400/30">
                    <span className="text-orange-400 text-xs">Side Pot {i+1}: {sp.amount}</span>
                  </div>
                )
              ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-start" aria-label="Sieges inferieurs">
            {seatRows[1].map(player => <SeatView key={player.userId} player={player} isDealer={player.userId === dealerPlayer?.userId} isCurrent={players[currentPlayerIndex]?.userId === player.userId} isMe={player.seat === mySeat} />)}
          </div>

          {lastHandResults && showResult && (
            <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center">
              <div role="dialog" aria-modal="true" aria-label="Resultat de la main" className="casino-panel p-6 max-w-md w-full mx-4 text-center space-y-3">
                <h3 className="text-xl font-display text-gold">Résultat de la main</h3>
                {lastHandResults.winners.map((w, i) => (
                  <div key={i} className="text-white">
                    <span className="font-bold text-gold">{w.username}</span>
                    <span className="text-gray-400"> remporte </span>
                    <span className="font-bold text-gold">
                      {lastHandResults.winningAmounts.find(a => a.userId === w.userId)?.amount || 0}
                    </span>
                    <div className="text-sm text-gray-400">avec {w.hand}</div>
                  </div>
                ))}
                <button
                  onClick={() => setShowResult(false)}
                  className="btn-primary min-h-[44px] text-sm mt-2"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-2 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {myPlayer && myPlayer.chips <= 0 && table.phase !== 'showdown' && isAtTable && (
          <div className="mt-3 text-center">
            <p className="text-yellow-400 text-sm mb-2">Vous n'avez plus de jetons !</p>
            <button
              onClick={() => {
                 void rebuy(table.id, table.minBuyIn);
              }}
              disabled={loading}
              className="btn-primary min-h-[44px] text-sm"
            >
              Rebuy ({table.minBuyIn})
            </button>
          </div>
        )}

        <div className="casino-panel mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {myPlayer && (
              <>
                <div className="flex gap-1">
                  {myCards.length === 0 && phase !== 'waiting' && (
                    <div className="flex gap-1">
                      <PlayingCard hidden small />
                      <PlayingCard hidden small />
                    </div>
                  )}
                  {myCards.map((card, i) => (
                    <PlayingCard key={i} card={card} small />
                  ))}
                </div>
                <div className="text-sm">
                  <span className="text-gold font-bold">{myPlayer.chips.toLocaleString()}</span>
                  <span className="text-gray-500 ml-1">jetons</span>
                  {currentRaise > 0 && (
                    <span className="text-gray-400 ml-2 text-xs">
                      Mise: {currentRaise}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {lastAction && (
            <div role="status" className="text-xs text-gray-400 break-all">
              {players.find(player => player.userId === lastAction.userId)?.username || lastAction.userId}: <span className="text-gray-300 font-semibold">{lastAction.action}</span>
              {lastAction.amount > 0 && ` (${lastAction.amount})`}
            </div>
          )}
        </div>

        {isAtTable && phase !== 'showdown' && phase !== 'waiting' && (
          <div className="casino-panel mt-3 flex flex-wrap items-center justify-center gap-2 p-3 sm:p-4 [&_button]:min-h-[44px]" aria-label="Actions de poker">
            <button
              onClick={() => handleAction('fold')}
              disabled={!canFold}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg transition-all text-sm"
            >
              Coucher
            </button>

            <button
              onClick={() => handleAction('check')}
              disabled={!canCheck}
              className="bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg transition-all text-sm"
            >
              Check
            </button>

            <button
              onClick={() => handleAction('call')}
              disabled={!canCall}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg transition-all text-sm"
            >
              Suivre {canCall ? callAmount : ''}
            </button>

            <div className="flex items-center gap-2">
              <input
                 type="number"
                 aria-label="Montant de la relance"
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Math.max(Number(e.target.value), table.bigBlind))}
                min={table.bigBlind}
                max={myPlayer?.chips || 0}
                 className="input-field min-h-[44px] w-20 py-1.5 text-sm text-center"
              />
              <button
                onClick={() => handleAction('raise', raiseAmount)}
                disabled={!canRaise}
                className="bg-gold hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-[#0D0D1A] font-bold py-2 px-5 rounded-lg transition-all text-sm"
              >
                Relancer
              </button>
            </div>

            <button
              onClick={() => handleAction('all-in')}
              disabled={!canRaise}
              className="bg-orange-700 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg transition-all text-sm"
            >
              Tapis ({myPlayer?.chips || 0})
            </button>
          </div>
        )}

        {loading && (
          <div role="status" className="mt-2 text-center">
            <span className="text-gold text-sm animate-pulse">Action en cours...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PokerPage() {
  const { isAtTable, table, loading, standUp, leaveTable } = usePokerStore();
  const navigate = useNavigate();

  useEffect(() => {
    const cleanup = subscribePoker();
    return () => { cleanup(); disconnectPokerSocket(); };
  }, []);

  const returnToLobby = async () => {
    if (table) {
      const left = isAtTable ? await standUp(table.id) : await leaveTable(table.id);
      if (!left) return;
    }
    navigate('/lobby');
  };

  return isAtTable || table ? <PokerTableView onBack={() => { if (!loading) void returnToLobby(); }} /> : <PokerTableLobby onBack={() => { if (!loading) void returnToLobby(); }} />;
}
