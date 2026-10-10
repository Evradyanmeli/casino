import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/layout/Layout';
import { DailyRewardCard } from '@/components/economy/DailyRewardCard';
import { Dices, Swords, FerrisWheel, Spade, Dice5, Grid3X3, Bomb, TrendingUp, CircleDot, Rocket, Target, Diamond, ListChecks, Flag } from 'lucide-react';

const gameRoute = (slug: string) => {
  const prefix = (['slots', 'roulette', 'blackjack'] as const).includes(slug as any) ? '/game/' : '/game-';
  return prefix + slug;
};

const gameIcons: Record<string, React.ReactNode> = {
  slots: <Dices className="w-6 h-6" />,
  blackjack: <Swords className="w-6 h-6" />,
  roulette: <FerrisWheel className="w-6 h-6" />,
  poker: <Spade className="w-6 h-6" />,
  craps: <Dice5 className="w-6 h-6" />,
  bingo: <Grid3X3 className="w-6 h-6" />,
  mines: <Bomb className="w-6 h-6" />,
  crash: <TrendingUp className="w-6 h-6" />,
  plinko: <CircleDot className="w-6 h-6" />,
  wheel: <FerrisWheel className="w-6 h-6" />,
  limbo: <Rocket className="w-6 h-6" />,
  keno: <Target className="w-6 h-6" />,
  videopoker: <Diamond className="w-6 h-6" />,
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
        <DailyRewardCard />

        <div>
          <h2 className="text-2xl font-display text-white mb-6">{t('lobby.games')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <button
                key={game.slug}
                onClick={() => navigate(gameRoute(game.slug))}
                className="group relative overflow-hidden rounded-xl bg-[#1A1A2E] border border-gray-800 hover:border-gray-600 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
                <div className="relative p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 flex-shrink-0 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {gameIcons[game.icon]}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white group-hover:text-gold transition-colors">
                      {t(game.nameKey)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('lobby.playNow')}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-600 ml-auto flex-shrink-0 group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

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
