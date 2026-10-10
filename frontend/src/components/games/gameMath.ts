export const PLINKO_MULTIPLIERS: Record<string, Record<number, number[]>> = {
  low: {
    8: [10, 3, 1.4, 0.6, 0.4, 0.6, 1.4, 3, 10],
    12: [20, 5, 2, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 2, 5, 20],
    16: [50, 10, 3, 1.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.5, 1.5, 3, 10, 50],
  },
  medium: {
    8: [18, 5, 1.8, 0.6, 0.3, 0.6, 1.8, 5, 18],
    12: [35, 8, 2.5, 1, 0.4, 0.2, 0.2, 0.2, 0.4, 1, 2.5, 8, 35],
    16: [88, 15, 4, 2, 0.5, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.5, 2, 4, 15, 88],
  },
  high: {
    8: [30, 8, 2.5, 0.6, 0.2, 0.6, 2.5, 8, 30],
    12: [60, 12, 3.5, 1, 0.3, 0.1, 0.1, 0.1, 0.3, 1, 3.5, 12, 60],
    16: [150, 25, 6, 2.5, 0.5, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 2.5, 6, 25, 150],
  },
};

export function nextWheelAngle(previous: number, index: number, weights: number[]): number {
  if (!Number.isInteger(index) || index < 0 || index >= weights.length) {
    throw new Error('Indice de roue invalide');
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const center = (weights.slice(0, index).reduce((sum, weight) => sum + weight, 0) + weights[index] / 2) / total * 360;
  const target = (360 - center) % 360;
  const remainder = ((previous % 360) + 360) % 360;
  return previous + 5 * 360 + (target - remainder + 360) % 360;
}

export function signedNet(payout: number, bet: number): string {
  const net = payout - bet;
  return `${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}`;
}
