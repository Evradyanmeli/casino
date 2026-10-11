export const ECONOMIC_DEFAULTS: Record<string, number> = {
  welcome_bonus: 5000, daily_reward_base: 1000, daily_reward_streak_7: 2500,
  daily_reward_streak_30: 10000, competition_prize_first: 2500,
  competition_prize_second: 1500, competition_prize_third: 1000,
  default_house_edge: 5, initial_capital: 50000000,
};

export function isValidEconomicSetting(key: string, value: unknown): value is number {
  return Object.hasOwn(ECONOMIC_DEFAULTS, key) && typeof value === 'number' &&
    Number.isFinite(value) && value >= 0 &&
    (key === 'default_house_edge' ? value < 100 : Number.isSafeInteger(value)) &&
    (!key.startsWith('daily_reward_') || value > 0) &&
    (key !== 'initial_capital' || value > 0) &&
    (!key.startsWith('competition_prize_') || value <= 2147483647);
}
