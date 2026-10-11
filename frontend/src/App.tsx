import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import i18n from './i18n/config';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LobbyPage from './pages/LobbyPage';
import ProfilePage from './pages/ProfilePage';
import TasksPage from './pages/TasksPage';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminGamesPage from '@/pages/admin/AdminGamesPage';
import AdminEconomyPage from '@/pages/admin/AdminEconomyPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminAuditPage from '@/pages/admin/AdminAuditPage';
import AdminChatPage from '@/pages/admin/AdminChatPage';
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage';
import AdminPage from './pages/AdminPage';
import ShopPage from './components/shop/ShopPage';
import ResponsibleGamingPage from './components/rg/ResponsibleGamingPage';
import Layout from './components/layout/Layout';

const SlotsGame = lazy(() => import('./components/games/SlotsGame').then(m => ({ default: m.SlotsGame })));
const RouletteGame = lazy(() => import('./components/games/RouletteGame').then(m => ({ default: m.RouletteGame })));
const CrapsGame = lazy(() => import('./components/games/CrapsGame'));
const WheelGame = lazy(() => import('./components/games/WheelGame'));
const KenoGame = lazy(() => import('./components/games/KenoGame'));
const PlinkoGame = lazy(() => import('./components/games/PlinkoGame'));
const BlackjackGame = lazy(() => import('./components/games/BlackjackGame'));
const VideoPokerGame = lazy(() => import('./components/games/VideoPokerGame'));
const MinesGame = lazy(() => import('./components/games/MinesGame'));
const CrashGame = lazy(() => import('./components/games/CrashGame'));
const LimboGame = lazy(() => import('./components/games/LimboGame'));
const PokerPage = lazy(() => import('./components/games/PokerPage'));
const BingoPage = lazy(() => import('./components/games/BingoPage'));

function GamePage({ children }: { children: React.ReactNode }) {
  return <Layout><div className="casino-game"><Suspense fallback={<p role="status" className="py-16 text-center text-slate-400">{i18n.t('common.loading')}</p>}>{children}</Suspense></div></Layout>;
}

function PlayerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'ADMIN') return <Navigate to="/lobby" />;
  return <>{children}</>;
}

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const { user } = useAuthStore();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0D0D1A] text-white font-display text-xl">{i18n.t('common.loading')}</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/lobby'} />} />
      <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/lobby'} />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/lobby" element={<PlayerRoute><LobbyPage /></PlayerRoute>} />
      <Route path="/profile" element={<PlayerRoute><ProfilePage /></PlayerRoute>} />
      <Route path="/tasks" element={<PlayerRoute><TasksPage /></PlayerRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboardPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/dashboard" element={<AdminRoute><AdminLayout><AdminDashboardPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminLayout><AdminUsersPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/games" element={<AdminRoute><AdminLayout><AdminGamesPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/economy" element={<AdminRoute><AdminLayout><AdminEconomyPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><AdminLayout><AdminSettingsPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/audit" element={<AdminRoute><AdminLayout><AdminAuditPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/chat" element={<AdminRoute><AdminLayout><AdminChatPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/notifications" element={<AdminRoute><AdminLayout><AdminNotificationsPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/legacy" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/shop" element={<PlayerRoute><ShopPage /></PlayerRoute>} />
      <Route path="/responsible-gaming" element={<PlayerRoute><ResponsibleGamingPage /></PlayerRoute>} />
      <Route path="/game/slots" element={<PlayerRoute><GamePage><SlotsGame /></GamePage></PlayerRoute>} />
      <Route path="/game/roulette" element={<PlayerRoute><GamePage><RouletteGame /></GamePage></PlayerRoute>} />
      <Route path="/game/blackjack" element={<PlayerRoute><GamePage><BlackjackGame /></GamePage></PlayerRoute>} />
      <Route path="/game-videopoker" element={<PlayerRoute><GamePage><VideoPokerGame /></GamePage></PlayerRoute>} />
      <Route path="/game-craps" element={<PlayerRoute><GamePage><CrapsGame /></GamePage></PlayerRoute>} />
      <Route path="/game-wheel" element={<PlayerRoute><GamePage><WheelGame /></GamePage></PlayerRoute>} />
      <Route path="/game-keno" element={<PlayerRoute><GamePage><KenoGame /></GamePage></PlayerRoute>} />
      <Route path="/game-plinko" element={<PlayerRoute><GamePage><PlinkoGame /></GamePage></PlayerRoute>} />
      <Route path="/game-mines" element={<PlayerRoute><GamePage><MinesGame /></GamePage></PlayerRoute>} />
      <Route path="/game-crash" element={<PlayerRoute><GamePage><CrashGame /></GamePage></PlayerRoute>} />
      <Route path="/game-limbo" element={<PlayerRoute><GamePage><LimboGame /></GamePage></PlayerRoute>} />
      <Route path="/game-poker" element={<PlayerRoute><GamePage><PokerPage /></GamePage></PlayerRoute>} />
      <Route path="/game-bingo" element={<PlayerRoute><GamePage><BingoPage /></GamePage></PlayerRoute>} />
      <Route path="/" element={<Navigate to={isAuthenticated ? (user?.role === 'ADMIN' ? '/admin' : '/lobby') : '/login'} />} />
    </Routes>
  );
}

export default App;
