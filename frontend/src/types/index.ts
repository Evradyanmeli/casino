export interface User {
  id: string;
  email: string;
  pseudo: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  balance: number;
  xp: number;
  level: number;
  avatar?: string;
  customAvatar?: string;
  birthDate?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
}

export interface UserStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  biggestWin?: number;
  totalBet: number;
}

export interface DashboardStats {
  activeUsers?: number;
  totalUsers: number;
  activeUsers24h: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalUserBalance: number;
  totalGamesPlayed: number;
  revenue: number;
  houseBalance: number;
}

export interface GameStat {
  game: string;
  playCount: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
}

export interface GameConfig {
  id: string;
  gameType: string;
  houseEdge: number;
  minBet: number;
  maxBet: number;
  active: boolean;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
  admin?: { id: string; pseudo: string };
}

export interface ChatMessageFull {
  id: string;
  userId: string;
  content: string;
  room: string;
  createdAt: string;
  user: { id: string; pseudo: string; avatar?: string | null };
}

export interface HouseBalance {
  balance: number;
  capital: number;
}

export interface SystemSetting {
  key: string;
  value: any;
  updatedAt?: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  pseudo: string;
  role: string;
  status: string;
  balance: number;
  xp: number;
  level: number;
  createdAt: string;
}
