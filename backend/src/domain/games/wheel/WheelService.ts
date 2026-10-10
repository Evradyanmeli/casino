import { randomInt } from 'node:crypto';

interface WheelSegment {
  multiplier: number;
  color: string;
  weight: number;
}

interface WheelState {
  sessionId: string;
  segments: WheelSegment[];
  result: { segment: WheelSegment; index: number };
  bet: number;
  payout: number;
  state: 'betting' | 'result';
}

const SEGMENTS: WheelSegment[] = [
  { multiplier: 50, color: '#FF1744', weight: 1 },
  { multiplier: 10, color: '#FF9100', weight: 4 },
  { multiplier: 5, color: '#FFD740', weight: 8 },
  { multiplier: 3, color: '#69F0AE', weight: 15 },
  { multiplier: 2, color: '#40C4FF', weight: 20 },
  { multiplier: 1.5, color: '#7C4DFF', weight: 20 },
  { multiplier: 1, color: '#E0E0E0', weight: 32 },
  { multiplier: 0, color: '#262636', weight: 0 },
];

function pickSegment(segments: WheelSegment[]): { segment: WheelSegment; index: number } {
  const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);
  let roll = randomInt(1000000000) / 1000000000 * totalWeight;
  for (let i = 0; i < segments.length; i++) {
    roll -= segments[i].weight;
    if (roll < 0) return { segment: segments[i], index: i };
  }
  return { segment: segments.at(-1)!, index: segments.length - 1 };
}

let sessionCounter = 0;

export class WheelService {
  async spin(userId: string, bet: number, edge = 0.05): Promise<WheelState> {
    if (!Number.isFinite(edge) || edge < 0 || edge >= 1) throw new Error('Invalid house edge');
    const segments = SEGMENTS.map(s => ({ ...s }));
    // A wheel with only >=1x outcomes cannot have a positive house edge.
    const weightedReturn = segments.reduce((sum, s) => sum + s.weight * s.multiplier, 0);
    segments.at(-1)!.weight = weightedReturn / (1 - edge) - segments.reduce((sum, s) => sum + s.weight, 0);
    sessionCounter++;
    const result = pickSegment(segments);
    return {
      sessionId: `wheel-${userId}-${sessionCounter}`,
      segments,
      result,
      bet,
      payout: Math.floor(bet * result.segment.multiplier),
      state: 'result',
    };
  }
}
