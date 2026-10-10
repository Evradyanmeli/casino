import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { usePokerStore, subscribePoker, PokerCard } from '@/store/pokerStore';
import { disconnectPokerSocket } from '@/services/pokerSocket';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

function CardDisplay({ card, hidden, small }: { card: PokerCard; hidden?: boolean; small?: boolean }) {
  if (hidden) {
    return (
      <div className={`${small ? 'w-8 h-12 text-xs' : 'w-12 h-18 sm:w-16 sm:h-24 text-sm'} rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400 shadow flex items-center justify-center`}>
        <span className="text-white font-bold">?</span>
      </div>
    );
  }
  const color = SUIT_COLORS[card.suit] || 'text-gray-900';
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;
  return (
    <div className={`${small ? 'w-8 h-12 text-xs' : 'w-12 h-18 sm:w-16 sm:h-24 text-sm'} rounded-lg bg-white border border-gray-300 shadow flex flex-col items-center justify-between p-0.5 select-none`}>
      <span className={`self-start font-bold leading-none ${color}`}>{card.rank}</span>
      <span className={`${color} ${small ? 'text-xs' : 'text-lg'}`}>{symbol}</span>
      <span className={`self-end font-bold leading-none rotate-180 ${color}`}>{card.rank}</span>
    </div>
  );
}

function SeatView({ player, isDealer, isCurrent, isMe, position }: {
  player: any;
  isDealer: boolean;
  isCurrent: boolean;
  isMe: boolean;
  position: { top: string; left: string };
}) {
  if (!player) {
    return (
      <div className="absolute" style={position}>
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center">
          <span className="text-gray-600 text-xs">Vide</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute ${isCurrent ? 'z-10' : 'z-0'}`} style={position}>
      <div className={`flex flex-col items-center ${isCurrent ? 'scale-110' : ''}`}>
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
          isCurrent ? 'border-gold bg-gold/20 shadow-glow' : 'border-gray-600 bg-gray-800/80'
        } ${isMe ? 'border-accent' : ''}`}>
          <span className={isCurrent ? 'text-gold' : 'text-gray-300'}>
            {player.username.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className={`text-xs mt-1 font-semibold ${isCurrent ? 'text-gold' : 'text-gray-400'} ${isMe ? 'text-accent' : ''}`}>
          {player.username}
        </span>
        <span className="text-xs text-gold font-bold">{player.chips.toLocaleString()}</span>
        {player.isBot && <span className="text-[10px] text-gray-500"><Bot className="w-3 h-3 inline-block" /></span>}

        {player.holeCards && player.holeCards.length > 0 && (
          <div className="flex gap-0.5 mt-1">
            {player.holeCards.map((card: PokerCard, i: number) => (
              <CardDisplay key={i} card={card} small />
            ))}
          </div>
        )}

        {player.currentBet > 0 && (
          <div className="mt-1 px-2 py-0.5 rounded bg-gold/20 border border-gold/40">
            <span className="text-gold text-xs font-bold">{player.currentBet}</span>
          </div>
        )}

        {player.folded && (
          <span className="text-xs text-red-400 font-bold mt-1">FOLD</span>
        )}

        {player.isAllIn && (
          <span className="text-xs text-orange-400 font-bold mt-1">ALL-IN</span>
        )}

        {isDealer && (
          <div className="mt-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
            <span className="text-[10px] text-black font-bold">D</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getSeatPosition(index: number, total: number): { top: string; left: string } {
  const positions: Record<number, { top: string; left: string }[]> = {
    2: [
      { top: '75%', left: '25%' },
      { top: '75%', left: '65%' },
    ],
    3: [
      { top: '75%', left: '15%' },
      { top: '10%', left: '40%' },
      { top: '75%', left: '75%' },
    ],
    4: [
      { top: '75%', left: '10%' },
      { top: '10%', left: '15%' },
      { top: '10%', left: '65%' },
      { top: '75%', left: '75%' },
    ],
    5: [
      { top: '75%', left: '8%' },
      { top: '10%', left: '5%' },
      { top: '5%', left: '40%' },
      { top: '10%', left: '75%' },
      { top: '75%', left: '78%' },
    ],
    6: [
      { top: '75%', left: '5%' },
      { top: '15%', left: '5%' },
      { top: '5%', left: '30%' },
      { top: '5%', left: '60%' },
      { top: '15%', left: '80%' },
      { top: '75%', left: '80%' },
    ],
  };
  const config = positions[total] || positions[4];
  return config[index] || config[index % config.length];
}

function PokerTableLobby() {
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
    <div className="min-h-screen bg-[#0D0D1A] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display text-gold">Poker Texas Hold'em</h1>
          <p className="text-gray-400 text-sm">Tables disponibles</p>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/40">
          <h3 className="text-white font-display text-lg mb-2">Partie rapide contre les bots</h3>
          <p className="text-gray-400 text-sm mb-3">Session privee avec trois bots temporaires. Buy-in : 100 a 1 000 GC.</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              aria-label="Buy-in de la session bots"
              value={quickBuyIn}
              onChange={(e) => setQuickBuyIn(Math.max(100, Number(e.target.value)))}
              min={100}
              max={1000}
              className="input-field py-1.5 text-sm w-24"
              placeholder="Buy-in"
            />
            <button
              onClick={handleQuickPlay}
              disabled={loading || !Number.isSafeInteger(quickBuyIn) || quickBuyIn < 100 || quickBuyIn > 1000}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:brightness-110 text-white font-bold py-2 px-6 rounded-lg transition-all text-sm"
            >
              Jouer vs Bots
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {tables.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              Aucune table disponible pour le moment
            </div>
          )}

          {tables.map((table) => (
            <div key={table.id} className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-display text-white">{table.name}</h3>
                <div className="flex gap-4 mt-2 text-sm text-gray-400">
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

              <div className="flex gap-2">
                <button
                  onClick={() => joinTable(table.id)}
                  className="btn-outline text-sm py-2 px-4"
                >
                  Rejoindre (Spectateur)
                </button>
                <button
                  onClick={() => {
                    setShowBuyIn(showBuyIn === table.id ? null : table.id);
                    setBuyInAmount(table.minBuyIn);
                  }}
                  className="btn-primary text-sm py-2 px-4"
                >
                  S'asseoir
                </button>
              </div>

              {showBuyIn === table.id && (
                <div className="w-full sm:w-auto p-3 bg-[#2A2A3E] rounded-lg flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Buy-in</label>
                    <p className="text-xs text-gray-500 mb-1">Min {table.minBuyIn} / Max {table.maxBuyIn}</p>
                    <input
                      type="number"
                      value={buyInAmount}
                      onChange={(e) => setBuyInAmount(Number(e.target.value))}
                      min={table.minBuyIn}
                      max={table.maxBuyIn}
                      className="input-field py-1 text-sm w-24"
                    />
                  </div>
                  <button
                    onClick={() => handleSitDown(table.id)}
                    className="bg-gold text-[#0D0D1A] font-bold py-1.5 px-3 rounded-lg text-sm hover:brightness-110 transition-all"
                  >
                    Valider
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="text-gold font-display text-lg animate-pulse">Chargement...</div>
          </div>
        )}
      </div>
    </div>
  );
}

function PokerTableView() {
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

  const activePlayers = players.filter(p => !p.folded);
  const seatCount = Math.max(activePlayers.length, 2);

  const canFold = isMyTurn && !loading;
  const canCheck = isMyTurn && currentRaise <= (myPlayer?.currentBet || 0);
  const canCall = isMyTurn && currentRaise > (myPlayer?.currentBet || 0) && phase !== 'showdown';
  const canRaise = isMyTurn && phase !== 'showdown';
  const callAmount = currentRaise - (myPlayer?.currentBet || 0);

  const sortedPlayers = [...players].sort((a, b) => a.seat - b.seat);

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
    <div className="min-h-screen bg-[#0D0D1A] p-2 sm:p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-display text-gold">{table.name}</h2>
            {table.mode === 'bots' && <span className="text-xs text-accent">Session privee</span>}
            {!isAtTable && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-700/60 text-gray-300 border border-gray-600">
                Spectateur
              </span>
            )}
            <span className="text-xs text-gray-500">#{table.id.slice(-6)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">SB {table.smallBlind} / BB {table.bigBlind}</span>
            <button
              onClick={handleBack}
              disabled={loading}
              className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all"
            >
              Quitter
            </button>
          </div>
        </div>

        {table.mode === 'bots' && <p className="text-xs text-gray-400 mb-3">Quitter couche votre main, sauf si vous etes deja a tapis : la main est alors terminee. Les jetons restants sont rendus, puis les bots sont supprimes.</p>}

        <div className="relative bg-gradient-to-b from-green-900 via-green-800 to-green-900 rounded-2xl border border-green-700/30 shadow-2xl overflow-hidden"
          style={{ minHeight: '500px', height: '65vh', maxHeight: '700px' }}>
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.3) 0%, transparent 60%)' }} />

          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
            {sortedPlayers.map((player) => {
              const idx = sortedPlayers.indexOf(player);
              const pos = getSeatPosition(idx, sortedPlayers.length);
              const isMe = player.seat === mySeat;
              const onSeat = player;

              return (
                <SeatView
                  key={player.userId}
                  player={onSeat}
                  isDealer={player.userId === dealerPlayer?.userId}
                  isCurrent={players[currentPlayerIndex]?.userId === player.userId}
                  isMe={isMe}
                  position={pos}
                />
              );
            })}

            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1.5 sm:gap-2">
                {communityCards.length === 0 && phase !== 'waiting' && (
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg bg-green-950/50 border border-green-700/30" />
                    ))}
                  </div>
                )}
                {communityCards.map((card, i) => (
                  <CardDisplay key={i} card={card} />
                ))}
              </div>

              {pot > 0 && (
                <div className="px-4 py-1.5 rounded-full bg-black/30 border border-gold/30">
                  <span className="text-gold font-bold text-sm">Pot: {pot.toLocaleString()}</span>
                </div>
              )}

              {sidePots.length > 1 && sidePots.map((sp, i) => (
                sp.amount > 0 && (
                  <div key={i} className="px-3 py-1 rounded-full bg-black/20 border border-orange-400/30">
                    <span className="text-orange-400 text-xs">Side Pot {i+1}: {sp.amount}</span>
                  </div>
                )
              ))}
            </div>
          </div>

          {lastHandResults && showResult && (
            <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center">
              <div className="bg-[#1A1A2E] border border-gold/30 rounded-2xl p-6 max-w-md w-full mx-4 text-center space-y-3">
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
                  className="btn-primary text-sm mt-2"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm text-center">
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
              className="btn-primary text-sm"
            >
              Rebuy ({table.minBuyIn})
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1A1A2E] border border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-3">
            {myPlayer && (
              <>
                <div className="flex gap-1">
                  {myCards.length === 0 && phase !== 'waiting' && (
                    <div className="flex gap-1">
                      <div className="w-10 h-14 rounded-lg bg-gray-800 border border-gray-700" />
                      <div className="w-10 h-14 rounded-lg bg-gray-800 border border-gray-700" />
                    </div>
                  )}
                  {myCards.map((card, i) => (
                    <CardDisplay key={i} card={card} />
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
            <div className="text-xs text-gray-400">
              {lastAction.userId}: <span className="text-gray-300 font-semibold">{lastAction.action}</span>
              {lastAction.amount > 0 && ` (${lastAction.amount})`}
            </div>
          )}
        </div>

        {isAtTable && phase !== 'showdown' && phase !== 'waiting' && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 bg-[#1A1A2E] border border-gray-800 rounded-xl p-3 sm:p-4">
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
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Math.max(Number(e.target.value), table.bigBlind))}
                min={table.bigBlind}
                max={myPlayer?.chips || 0}
                className="input-field w-20 py-1.5 text-sm text-center"
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
          <div className="mt-2 text-center">
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

  return <><div className="bg-[#0D0D1A] p-4"><button disabled={!!table && loading} className="text-gray-400 hover:text-gold text-sm disabled:opacity-50" onClick={returnToLobby}>← Retour au lobby</button></div>{isAtTable || table ? <PokerTableView /> : <PokerTableLobby />}</>;
}
