import api from './api';

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  condition: any;
  xpReward: number;
  createdAt: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  badge: Badge;
}

export interface TaskCondition {
  action: string;
  game?: string;
  count: number;
}

export interface TaskReward {
  xp: number;
  coins: number;
}

export interface Task {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  condition: TaskCondition;
  reward: TaskReward;
  expiresIn: number | null;
  createdAt: string;
}

export interface UserTask {
  id: string;
  userId: string;
  taskId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  expiresAt: string;
  completedAt: string | null;
  task: Task;
}

export interface LevelInfo {
  xp: number;
  level: number;
  nextLevelXp: number;
}

export interface LevelProgress {
  xp: number;
  level: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

export interface Race {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  prize: Record<string, number>;
  status: string;
  createdAt: string;
}

export interface RaceEntry {
  id: string;
  raceId: string;
  userId: string;
  xp: number;
  rank: number | null;
  prize: number;
  claimed: boolean;
  user: { id: string; pseudo: string; avatar: string | null };
}

export interface RaceRank {
  rank: number;
  xp: number;
  prize: number;
}

export const progressionApi = {
  getBadges: () => api.get<Badge[]>('/progression/badges').then(r => r.data),
  getMyBadges: () => api.get<UserBadge[]>('/progression/badges/mine').then(r => r.data),
  getTasks: () => api.get<{ daily: UserTask[]; weekly: UserTask[] }>('/progression/tasks').then(r => r.data),
  claimTask: (id: string) => api.post<{ xp: number; coins: number; leveledUp: boolean; newLevel: number }>(`/progression/tasks/${id}/claim`).then(r => r.data),
  getLevel: () => api.get<LevelInfo>('/progression/level').then(r => r.data),
  getLevelProgress: () => api.get<LevelProgress>('/progression/level/progress').then(r => r.data),
  getRace: () => api.get<Race | null>('/progression/race').then(r => r.data),
  getLeaderboard: () => api.get<RaceEntry[]>('/progression/race/leaderboard').then(r => r.data),
  getMyRank: () => api.get<RaceRank>('/progression/race/my-rank').then(r => r.data),
  claimRacePrize: () => api.post<{ prize: number }>('/progression/race/claim').then(r => r.data),
};
