import { useId, useSyncExternalStore } from 'react';

function motionSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    window.localStorage.getItem('casino-reduced-motion') === 'true';
}

function subscribeMotion(update: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', update);
  window.addEventListener('storage', update);
  window.addEventListener('casino-motion-change', update);
  return () => {
    media.removeEventListener('change', update);
    window.removeEventListener('storage', update);
    window.removeEventListener('casino-motion-change', update);
  };
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
}

export function setReducedMotion(reduced: boolean) {
  window.localStorage.setItem('casino-reduced-motion', String(reduced));
  document.documentElement.dataset.reducedMotion = String(reduced);
  window.dispatchEvent(new Event('casino-motion-change'));
}

const suits: Record<string, string> = {
  hearts: 'M12 21C8 17 2 13 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-6 10-10 14Z',
  diamonds: 'M12 1 22 12 12 23 2 12Z',
  spades: 'M12 1C8 6 2 9 2 14a5 5 0 0 0 8 4l-2 5h8l-2-5a5 5 0 0 0 8-4c0-5-6-8-10-13Z',
  clubs: 'M12 1a5 5 0 0 0-4 8 5 5 0 1 0 2 9l-2 5h8l-2-5a5 5 0 1 0 2-9 5 5 0 0 0-4-8Z',
};

const pipPositions: Record<string, number[][]> = {
  A: [[50, 70]],
  '2': [[50, 40], [50, 100]],
  '3': [[50, 40], [50, 70], [50, 100]],
  '4': [[34, 40], [66, 40], [34, 100], [66, 100]],
  '5': [[34, 40], [66, 40], [50, 70], [34, 100], [66, 100]],
  '6': [[34, 40], [66, 40], [34, 70], [66, 70], [34, 100], [66, 100]],
  '7': [[34, 40], [66, 40], [50, 55], [34, 70], [66, 70], [34, 100], [66, 100]],
  '8': [[34, 40], [66, 40], [50, 55], [34, 70], [66, 70], [50, 85], [34, 100], [66, 100]],
  '9': [[34, 36], [66, 36], [34, 57], [66, 57], [50, 70], [34, 83], [66, 83], [34, 104], [66, 104]],
  '10': [[34, 36], [66, 36], [50, 47], [34, 57], [66, 57], [34, 83], [66, 83], [50, 93], [34, 104], [66, 104]],
};

export function PlayingCard({ card, hidden = false, delay = 0, small = false, className = '', selected = false, onClick }: {
  card?: { suit: string; rank: string }; hidden?: boolean; delay?: number; small?: boolean;
  className?: string; selected?: boolean; onClick?: () => void;
}) {
  const id = useId().replace(/:/g, '');
  const red = card?.suit === 'hearts' || card?.suit === 'diamonds';
  const color = red ? '#af2637' : '#162132';
  const suit = suits[card?.suit ?? 'spades'] ?? suits.spades;
  const rank = card?.rank ?? 'A';
  const content = <div className={`playing-card-inner ${hidden ? 'is-hidden' : ''}`}>
    <svg viewBox="0 0 100 140" className="playing-card-face" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-paper`} x2="0.6" y2="1"><stop stopColor="#fffef7" /><stop offset="1" stopColor="#e9e5d7" /></linearGradient>
      <pattern id={`${id}-back`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 4 0 8 4 4 8Z" fill="none" stroke="#d8b96b" strokeWidth="0.5" opacity="0.6" /></pattern>
    </defs>
    <rect x="1" y="1" width="98" height="138" rx="7" fill={`url(#${id}-paper)`} stroke="#ddd6bf" />
    {!hidden && <>
      <g fill={color} fontFamily="Georgia, serif" fontWeight="bold">
        <text x="8" y="22" fontSize="18">{rank}</text><path d={suit} transform="translate(7 25) scale(.48)" />
        <g transform="rotate(180 50 70)"><text x="8" y="22" fontSize="18">{rank}</text><path d={suit} transform="translate(7 25) scale(.48)" /></g>
      </g>
      {pipPositions[rank] ? pipPositions[rank].map(([x, y], index) => <path key={index} d={suit} fill={color}
        transform={`translate(${x - (rank === 'A' ? 17 : 8)}, ${y - (rank === 'A' ? 17 : 8)}) scale(${rank === 'A' ? 1.4 : .67})`} />) : <>
        <rect x="26" y="29" width="48" height="82" rx="2" fill="#e7cf86" stroke={color} />
        {[false, true].map((flipped, index) => <g key={index} transform={flipped ? 'rotate(180 50 70)' : undefined}>
          <path d="M31 67 38 46 62 46 69 67Z" fill={color} /><path d="m38 41-2-10 9 5 5-9 5 9 9-5-2 10Z" fill="#b48427" stroke="#fff3bd" />
          <path d="M42 43v11l8 7 8-7V43Z" fill="#f6e6c6" stroke="#875a33" strokeWidth=".6" />
          <path d="M45 48h2m6 0h2m-8 7h6" stroke="#614837" /><path d="m32 65 10-9 8 8 8-8 10 9" fill="#243951" stroke="#d8b65a" strokeWidth="2" />
          <path d={suit} fill={color} transform="translate(44 63) scale(.5)" />
        </g>)}
      </>}
    </>}
    </svg>
    <svg viewBox="0 0 100 140" className="playing-card-face playing-card-back" aria-hidden="true">
      <rect x="1" y="1" width="98" height="138" rx="7" fill="#f3efdf" stroke="#ddd6bf" />
      <rect x="6" y="6" width="88" height="128" rx="4" fill="#182d42" />
      <rect x="9" y="9" width="82" height="122" rx="3" fill={`url(#${id}-back)`} stroke="#b69753" />
      <path d="M50 36 74 70 50 104 26 70Z" fill="#182d42" stroke="#c8a967" strokeWidth="2" />
      <path d={suits.spades} transform="translate(35 51) scale(1.25)" fill="#c8a967" />
      <path d="M16 16h12M16 16v12M84 124H72M84 124v-12" fill="none" stroke="#e6ce93" />
    </svg>
  </div>;
  const props = {
    className: `playing-card ${small ? 'playing-card-small' : ''} ${selected ? 'playing-card-selected' : ''} ${className}`,
    style: { animationDelay: `${delay}ms` },
    'aria-label': hidden ? 'Carte face cachee' : `${rank} ${card?.suit ?? ''}`,
  };
  return onClick ? <button type="button" {...props} onClick={onClick} aria-pressed={selected}>{content}</button> : <div {...props} role="img">{content}</div>;
}

export function CasinoChip({ value = 'GC', color, className = '' }: { value?: string | number; color?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const base = color ?? (typeof value === 'number' && value >= 100 ? '#29323c' : typeof value === 'number' && value >= 25 ? '#236750' : '#a12e39');
  return <svg viewBox="0 0 100 100" className={`casino-chip h-11 w-11 shrink-0 ${className}`} aria-hidden="true">
    <defs><radialGradient id={`${id}-chip`} cx="35%" cy="20%" r="80%"><stop stopColor="#ffffff" stopOpacity=".35" /><stop offset=".4" stopColor={base} /><stop offset="1" stopColor="#080e18" /></radialGradient></defs>
    <circle cx="50" cy="53" r="45" fill="#080b10" /><circle cx="50" cy="48" r="45" fill={base} stroke="#deb96c" strokeWidth="1.5" />
    <circle cx="50" cy="48" r="38" stroke="#ebe4cf" strokeWidth="11" strokeDasharray="12 18" fill="none" />
    <circle cx="50" cy="48" r="31" fill={`url(#${id}-chip)`} stroke="#dbcba0" />
    <circle cx="50" cy="48" r="25" fill="#f2ebd9" stroke="#b3a178" strokeDasharray="2 3" />
    <text x="50" y="54" textAnchor="middle" fontSize={String(value).length > 4 ? '14' : '20'} fontWeight="800" fontFamily="Georgia, serif" fill={base}>{value}</text>
    <text x="50" y="67" textAnchor="middle" fontSize="6" letterSpacing="2" fill="#705f40">CASINO X</text>
  </svg>;
}

const dicePips: Record<number, number[][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

export function Dice({ value, rolling = false, className = '' }: { value: number; rolling?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 110 115" role="img" aria-label={`De : ${value}`} className={`casino-dice h-20 w-20 ${rolling ? 'animate-dice-roll' : ''} ${className}`}>
    <defs><linearGradient id={`${id}-ivory`} x2=".8" y2="1"><stop stopColor="#fffef3" /><stop offset=".6" stopColor="#eee8d6" /><stop offset="1" stopColor="#bdb5a4" /></linearGradient></defs>
    <path d="M18 102h78c6 0 10-4 10-10V22L92 7 6 90Z" fill="#a89f8e" stroke="#857c70" />
    <rect x="4" y="4" width="94" height="94" rx="17" fill={`url(#${id}-ivory)`} stroke="#fff8e8" strokeWidth="2" />
    <path d="M16 28c0-10 4-13 14-13h48" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".8" />
    {(dicePips[value] ?? dicePips[1]).map(([x, y], index) => <g key={index}><circle cx={x} cy={y} r="8" fill="#837463" /><circle cx={x} cy={y + 1} r="6.5" fill="#171d27" /><circle cx={x - 2} cy={y - 2} r="2" fill="#fff" opacity=".15" /></g>)}
  </svg>;
}

export function SlotSymbol({ symbol, className = '' }: { symbol: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const gold = `url(#${id}-gold)`, red = `url(#${id}-red)`, green = `url(#${id}-green)`;
  let art;
  switch (symbol) {
    case 'CHERRY': art = <><path d="M30 65Q36 16 68 18Q70 43 65 68" stroke="#476929" strokeWidth="5" fill="none" /><path d="M64 21q14-18 26-5-12 15-26 5" fill={green} /><circle cx="30" cy="67" r="22" fill={red} /><circle cx="67" cy="72" r="22" fill={red} /><path d="M17 60q3-8 11-8m27 15q4-10 12-10" stroke="#ffb5a4" strokeWidth="4" strokeLinecap="round" fill="none" /></>; break;
    case 'LEMON': art = <><path d="M9 55q8-34 44-29 33 5 39 27-10 33-42 29Q16 80 9 55Z" fill={`url(#${id}-yellow)`} stroke="#bfa235" strokeWidth="2" /><path d="M18 44q22-16 45-8" stroke="#fff5a7" strokeWidth="5" fill="none" strokeLinecap="round" /><path d="m78 25 6-9" stroke="#64843a" strokeWidth="3" /></>; break;
    case 'ORANGE': case 'APPLE': art = <><path d="M48 28q-4-13 3-17" fill="none" stroke="#6e512a" strokeWidth="5" /><path d="M53 21q20-16 29-2-18 13-29 2" fill={green} /><path d={symbol === 'APPLE' ? 'M48 32C9 14 2 51 17 78q11 19 33 9 23 12 34-12 15-35-11-47-11-5-25 4Z' : 'M87 60a36 36 0 1 1-72 0 36 36 0 1 1 72 0'} fill={symbol === 'APPLE' ? red : `url(#${id}-orange)`} /><path d="M25 49q4-11 15-12" stroke="#fff" strokeOpacity=".55" strokeWidth="4" fill="none" strokeLinecap="round" /></>; break;
    case 'GRAPE': art = <><path d="M50 22q2-17 19-13" fill="none" stroke="#557632" strokeWidth="4" /><path d="M48 18q-20-18-27 0 13 13 27 0" fill={green} />{[[30,38],[53,37],[74,44],[26,58],[49,58],[70,65],[43,77],[58,87]].map(([x,y], i) => <g key={i}><circle cx={x} cy={y} r="14" fill={`url(#${id}-purple)`} stroke="#4c1a6a" /><ellipse cx={x-4} cy={y-5} rx="4" ry="2" fill="#ead5ff" opacity=".65" /></g>)}</>; break;
    case 'WATERMELON': art = <><path d="M8 33h84Q90 94 50 96 10 94 8 33Z" fill={green} stroke="#37653e" /><path d="M16 35h68Q80 83 50 86 20 83 16 35Z" fill="#f7ddaf" /><path d="M21 36h58Q75 77 50 81 25 77 21 36Z" fill={red} />{[[32,49],[49,51],[67,49],[42,67],[57,68]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="2" ry="4" fill="#35231e" transform={`rotate(${(i-2)*15} ${x} ${y})`} />)}</>; break;
    case 'STRAWBERRY': art = <><path d="M18 43q0-21 31-18 33-5 33 22-4 26-31 48Q20 74 18 43Z" fill={red} stroke="#9d2432" /><path d="m47 29-24-16 9 21-15 4 22 5 12-11 17 8 16-4-19-5 4-18Z" fill={green} />{[[29,49],[44,44],[64,46],[38,63],[56,61],[49,78]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="1.6" ry="3" fill="#f5da8a" />)}</>; break;
    case 'BANANA': art = <><path d="M17 20q-4 59 50 53l19-20q-6 37-48 35Q5 83 8 37Z" fill={`url(#${id}-yellow)`} stroke="#bc9235" strokeWidth="2" /><path d="M15 39q4 34 43 37" fill="none" stroke="#fff4a8" strokeWidth="4" /><path d="m12 20 9-1 2 10-8 5Z" fill="#655437" /></>; break;
    case 'DIAMOND': art = <><path d="m12 35 18-21h40l18 21-38 58Z" fill="#77cbe5" stroke="#197296" strokeWidth="2" /><path d="m12 35 18-21 8 21ZM70 14l18 21H62Z" fill="#caf8ff" /><path d="m30 14 8 21L50 14l12 21 8-21Z" fill="#f1feff" /><path d="m12 35 38 58-12-58ZM88 35 50 93l12-58Z" fill="#238db9" /><path d="M38 35h24L50 93Z" fill="#a5eafa" /><path d="M12 35h76M30 14l20 79 20-79" stroke="#ffffff" strokeOpacity=".7" fill="none" /><path d="m81 9 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff" /></>; break;
    case 'BELL': art = <><circle cx="50" cy="17" r="7" fill={gold} stroke="#8d651c" /><path d="M21 69q12-5 12-33a17 17 0 0 1 34 0q0 28 12 33Z" fill={gold} stroke="#946729" strokeWidth="2" /><ellipse cx="50" cy="70" rx="31" ry="7" fill="#8a5a15" /><ellipse cx="50" cy="68" rx="28" ry="5" fill="#e5ba54" /><circle cx="50" cy="78" r="8" fill={gold} /><path d="M41 30q-5 11-5 25" stroke="#fff0b3" strokeWidth="5" strokeLinecap="round" fill="none" /></>; break;
    case 'CROWN': art = <><path d="m15 27 17 17 18-25 18 25 17-17-9 50H24Z" fill={gold} stroke="#916620" strokeWidth="2" /><path d="M25 70h50v14H25Z" fill={gold} stroke="#a47723" />{[15,50,85].map((x,i)=><circle key={x} cx={x} cy={i===1?18:26} r="5" fill="#ffe7a2" stroke="#b4842f" />)}<path d="m50 41 6 10-6 10-6-10Z" fill={red} /><path d="M29 75h42" stroke="#fff0b9" strokeWidth="2" /></>; break;
    case 'TROPHY': art = <><path d="M29 24H15q-2 25 22 29m34-29h14q2 25-22 29" stroke="#b68b30" strokeWidth="7" fill="none" /><path d="M26 17h48l-4 33q-5 16-20 16-15 0-20-16Z" fill={gold} stroke="#a47727" /><path d="M46 66h8v15H46Z" fill={gold} /><path d="M32 82h36v9H32Z" fill="#49392b" stroke="#b28b4d" /><path d="M37 22v20" stroke="#fff4b8" strokeWidth="5" strokeLinecap="round" /></>; break;
    case 'MONEY': art = <><path d="m22 30 57 8-8 41-57-8Z" fill={green} stroke="#315c42" strokeWidth="2" /><path d="m29 22 57 8-8 41-57-8Z" fill="#507f4d" stroke="#b5bc84" strokeWidth="2" /><ellipse cx="55" cy="48" rx="15" ry="19" fill="#cbd1a1" transform="rotate(11 55 48)" /><text x="55" y="55" fill="#376340" fontWeight="bold" fontSize="22" textAnchor="middle">$</text><circle cx="28" cy="77" r="15" fill={gold} stroke="#9c7629" /><text x="28" y="82" fill="#8b611c" fontSize="12" fontWeight="bold" textAnchor="middle">GC</text></>; break;
    case 'FIRE': art = <><path d="M49 9q16 17 10 34 10-2 16-19 21 34 5 55Q51 110 21 79 4 56 33 31q-5 27 9 24Q34 31 49 9Z" fill={`url(#${id}-orange)`} stroke="#c15b20" /><path d="M48 48q19 21 8 37-19 12-24-4-2-11 16-33Z" fill="#fff2a1" /></>; break;
    case 'TARGET': art = <>{[38,29,20,10].map((r,i)=><circle key={r} cx="48" cy="52" r={r} fill={i%2?'#f6edde':red} stroke="#ad3540" strokeWidth="1" />)}<path d="m49 52 35-38" stroke="#463c32" strokeWidth="4" /><path d="m73 25 2-15 7 8 11 0-10 10Z" fill={gold} stroke="#986c26" /></>; break;
    case 'SEVEN': art = <><text x="50" y="83" textAnchor="middle" fontFamily="Georgia, serif" fontSize="94" fontWeight="900" fill={red} stroke="#e9c779" strokeWidth="2">7</text><path d="M27 20h39" stroke="#fff2d2" strokeWidth="3" strokeLinecap="round" /></>; break;
    case 'BAR': art = <><rect x="8" y="24" width="84" height="53" rx="8" fill="#1d2430" stroke="#dabb68" strokeWidth="4" /><path d="M15 31h70M15 70h70" stroke="#8a7449" /><text x="50" y="61" fontFamily="Georgia, serif" fontWeight="900" fontSize="28" textAnchor="middle" fill={gold}>BAR</text></>; break;
    case 'SLOT': art = <><rect x="13" y="16" width="67" height="72" rx="9" fill={gold} stroke="#8b692a" strokeWidth="2" /><rect x="19" y="35" width="54" height="31" rx="3" fill="#f1eddf" stroke="#806641" /><text x="46" y="58" fill="#aa2d3c" fontFamily="Georgia, serif" fontWeight="bold" fontSize="23" textAnchor="middle">777</text><path d="M24 24h43m-44 51h43" stroke="#6b5231" strokeWidth="3" /><path d="M80 65h9V37" fill="none" stroke="#a78031" strokeWidth="5" /><circle cx="89" cy="32" r="7" fill={red} /></>; break;
    default: art = <><path d="m50 8 12 27 29 3-22 20 6 29-25-14-25 14 6-29L9 38l29-3Z" fill={gold} stroke="#a87c28" strokeWidth="2" /><path d="m50 8 1 44-20 6 7-23Z" fill="#fff4c5" opacity=".6" />{symbol === 'SCATTER' && <path d="m85 3 3 8 9 3-9 3-3 9-3-9-8-3 8-3Z" fill="#fff7ce" stroke="#b18b3c" />}</>;
  }
  return <svg viewBox="0 0 100 100" className={`slot-symbol ${className}`} aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-gold`} x2=".75" y2="1"><stop stopColor="#fff1b1" /><stop offset=".35" stopColor="#e3b852" /><stop offset=".7" stopColor="#af792c" /><stop offset="1" stopColor="#f0cd72" /></linearGradient>
      <radialGradient id={`${id}-red`} cx="30%" cy="20%"><stop stopColor="#ff8479" /><stop offset=".5" stopColor="#d82e40" /><stop offset="1" stopColor="#851526" /></radialGradient>
      <radialGradient id={`${id}-yellow`} cx="30%" cy="20%"><stop stopColor="#fff8aa" /><stop offset=".5" stopColor="#f0cd42" /><stop offset="1" stopColor="#c5a327" /></radialGradient>
      <radialGradient id={`${id}-orange`} cx="30%" cy="20%"><stop stopColor="#ffdf75" /><stop offset=".5" stopColor="#ed932f" /><stop offset="1" stopColor="#bd481f" /></radialGradient>
      <linearGradient id={`${id}-green`} x2="1" y2="1"><stop stopColor="#94ba51" /><stop offset="1" stopColor="#285537" /></linearGradient>
      <radialGradient id={`${id}-purple`} cx="30%" cy="20%"><stop stopColor="#c499dc" /><stop offset=".5" stopColor="#8556b2" /><stop offset="1" stopColor="#432169" /></radialGradient>
    </defs>
    <ellipse cx="50" cy="94" rx="31" ry="3" fill="#172032" opacity=".15" />{art}
  </svg>;
}

export function CasinoArtwork({ game, className = '' }: { game: string; className?: string }) {
  return <div className={`casino-artwork casino-artwork-${game} ${className}`} aria-hidden="true">
    <div className="artwork-table-line" />
    {['blackjack', 'poker', 'videopoker'].includes(game) ? <div className="artwork-cards"><PlayingCard card={{ rank: 'A', suit: 'spades' }} /><PlayingCard card={{ rank: 'K', suit: 'hearts' }} /><CasinoChip value={100} /></div> :
      game === 'craps' ? <div className="artwork-dice"><Dice value={5} /><Dice value={3} /><CasinoChip value={25} /></div> :
      ['wheel', 'roulette'].includes(game) ? <div className="artwork-wheel"><div className="artwork-wheel-hub">{game === 'roulette' ? '0' : '50x'}</div><span className="artwork-wheel-ball" /></div> :
      game === 'slots' ? <div className="artwork-reels">{['CHERRY','SEVEN','BELL'].map(s => <div key={s}><SlotSymbol symbol={s} /></div>)}</div> :
      ['bingo','keno'].includes(game) ? <div className="artwork-balls">{[7,24,39].map(n => <span key={n}>{n}</span>)}</div> :
      game === 'mines' ? <div className="artwork-gems">{[1,2,3].map(n => <SlotSymbol key={n} symbol="DIAMOND" />)}</div> :
      game === 'plinko' ? <div className="artwork-plinko">{Array.from({length: 5}, (_, row) => <div key={row}>{Array.from({length: row+3}, (_,col) => <i key={col} />)}</div>)}<CasinoChip value="GC" /></div> :
      <svg viewBox="0 0 260 145" className="artwork-chart"><path d="M20 115H245M20 115V20" stroke="#bda573" strokeOpacity=".2" fill="none" /><path d={game === 'crash' ? 'M25 108Q150 113 220 22' : 'M30 105Q110 108 150 70T225 32'} stroke="#e1b868" strokeWidth="5" strokeLinecap="round" fill="none" /><circle cx="222" cy="27" r="8" fill="#ffdf8d" /><text x="60" y="58" fill="#e9d4a6" fontFamily="Georgia,serif" fontSize="30">{game === 'crash' ? '2.48x' : '10.00x'}</text></svg>}
  </div>;
}
