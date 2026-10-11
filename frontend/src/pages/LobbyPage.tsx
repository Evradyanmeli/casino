import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import { DailyRewardCard } from '@/components/economy/DailyRewardCard';
import { ListChecks, Flag } from 'lucide-react';
import { CasinoArtwork, PlayingCard, CasinoChip } from '@/components/games/GameVisuals';

const gameRoute = (slug: string) => {
  const prefix = (['slots', 'roulette', 'blackjack'] as const).includes(slug as any) ? '/game/' : '/game-';
  return prefix + slug;
};

const games = [
  { slug: 'slots', nameKey: 'lobby.gamesList.slots', icon: 'slots', color: 'from-purple-600 to-pink-600' },
  { slug: 'blackjack', nameKey: 'lobby.gamesList.blackjack', icon: 'blackjack', color: 'from-green-700 to-emerald-600' },
  { slug: 'roulette', nameKey: 'lobby.gamesList.roulette', icon: 'roulette', color: 'from-red-700 to-rose-600' },
  { slug: 'poker', nameKey: 'lobby.gamesList.poker', icon: 'poker', color: 'from-blue-700 to-indigo-600' },
  { slug: 'craps', nameKey: 'lobby.gamesList.craps', icon: 'craps', color: 'from-yellow-600 to-amber-600' },
  { slug: 'bingo', nameKey: 'lobby.gamesList.bingo', icon: 'bingo', color: 'from-orange-600 to-red-500' },
  { slug: 'mines', nameKey: 'lobby.gamesList.mines', icon: 'mines', color: 'from-gray-700 to-slate-800' },
  { slug: 'crash', nameKey: 'lobby.gamesList.crash', icon: 'crash', color: 'from-teal-600 to-cyan-600' },
  { slug: 'plinko', nameKey: 'lobby.gamesList.plinko', icon: 'plinko', color: 'from-pink-600 to-purple-600' },
  { slug: 'wheel', nameKey: 'lobby.gamesList.wheel', icon: 'wheel', color: 'from-amber-500 to-yellow-500' },
  { slug: 'limbo', nameKey: 'lobby.gamesList.limbo', icon: 'limbo', color: 'from-violet-600 to-purple-800' },
  { slug: 'keno', nameKey: 'lobby.gamesList.keno', icon: 'keno', color: 'from-cyan-600 to-blue-600' },
  { slug: 'videopoker', nameKey: 'lobby.gamesList.videopoker', icon: 'videopoker', color: 'from-emerald-600 to-green-700' },
];

export default function LobbyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Layout>
      <div className="space-y-8">
        <section className="lobby-hero">
          <div className="relative z-10 flex flex-col items-start justify-center">
            <p className="casino-eyebrow">{t('casino.welcome')}</p>
            <h1 className="lobby-title max-w-md">{t('casino.heroTitle')}</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#b8c5be]">{t('casino.heroDescription')}</p>
            <a href="#game-collection" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-full border border-[#d1b675]/40 bg-[#c7a35e]/10 px-5 py-2 text-sm font-semibold text-[#e6cc94] hover:bg-[#c7a35e]/20">{t('casino.explore')}<span aria-hidden="true">↓</span></a>
          </div>
          <div className="lobby-hero-art" aria-hidden="true"><PlayingCard card={{rank:'A',suit:'spades'}} /><PlayingCard card={{rank:'K',suit:'hearts'}} /><CasinoChip value={25} /><CasinoChip value={100} /></div>
        </section>
        <DailyRewardCard />

        <section id="game-collection" className="scroll-mt-24">
          <div className="mb-5 flex items-end justify-between gap-3"><div><p className="casino-eyebrow">{t('casino.collection')}</p><h2 className="text-2xl text-[#f1e7d1]" style={{fontFamily:'Georgia, serif'}}>{t('lobby.games')}</h2></div><span className="text-xs text-slate-500">13 {t('casino.experiences')}</span></div>
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {games.map((game, index) => (
              <button
                key={game.slug}
                onClick={() => navigate(gameRoute(game.slug))}
                className="casino-game-tile group"
                aria-label={`${t('lobby.playNow')} : ${t(game.nameKey)}`}
              >
                <CasinoArtwork game={game.slug} />
                <div className="relative p-4 flex items-center gap-3">
                  <span className="text-[10px] tabular-nums text-[#ad9360]">{String(index + 1).padStart(2, '0')}</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white group-hover:text-gold transition-colors">
                      {t(game.nameKey)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{t(`casino.genres.${game.slug}`)}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-600 ml-auto flex-shrink-0 group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => navigate('/tasks')} className="card flex items-center justify-between hover:border-gray-600 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-white">
                <ListChecks className="w-5 h-5" />
              </div>
              <span className="font-medium text-white">{t('lobby.tasks')}</span>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={() => navigate('/tasks')} className="card flex items-center justify-between hover:border-gray-600 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-white">
                <Flag className="w-5 h-5" />
              </div>
              <span className="font-medium text-white">{t('lobby.race')}</span>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/responsible-gaming')}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
          >
            {t('lobby.responsibleGaming')}
          </button>
        </div>
      </div>
    </Layout>
  );
}
