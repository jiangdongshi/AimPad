import type { ScoreComponents, ScoringWeights } from '@/types/training';

export function calculateStaticClickingScore(
  hits: number,
  misses: number,
  reactionTimes: number[],
  killTimes: number[],
  weights: ScoringWeights
): ScoreComponents {
  // 准确率
  const total = hits + misses;
  const accuracy = total > 0 ? (hits / total) * 100 : 0;

  // 速度得分（反应时间越短越好）
  const avgReaction = reactionTimes.length > 0
    ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
    : 1000;
  const speed = Math.max(0, 100 - (avgReaction / 10));

  // 一致性（击杀时间标准差越小越好）
  const consistency = calculateConsistency(killTimes);

  // 原始分数
  const rawScore = hits * 100;

  // 加权综合分
  const accuracyWeight = weights.weightAccuracy;
  const speedWeight = weights.weightSpeed;
  const consistencyWeight = weights.weightConsistency;

  const finalScore = Math.round(
    rawScore *
    Math.pow(accuracy / 100, accuracyWeight) *
    Math.pow(speed / 100, speedWeight) *
    Math.pow(consistency / 100, consistencyWeight)
  );

  return {
    accuracy: Math.round(accuracy * 10) / 10,
    speed: Math.round(speed * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    rawScore,
    finalScore: Math.max(0, finalScore),
  };
}

export function calculateConsistency(times: number[]): number {
  if (times.length < 2) return 100;

  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  // 标准差越小，一致性越高
  return Math.max(0, 100 - stdDev / 10);
}

export function calculateSmoothness(
  cursorPositions: { x: number; y: number }[],
  targetPositions: { x: number; y: number }[]
): number {
  if (cursorPositions.length < 3) return 0;

  // 计算加速度变化（jerk）
  let totalJerk = 0;
  for (let i = 2; i < cursorPositions.length; i++) {
    const dx1 = cursorPositions[i - 1].x - cursorPositions[i - 2].x;
    const dy1 = cursorPositions[i - 1].y - cursorPositions[i - 2].y;
    const dx2 = cursorPositions[i].x - cursorPositions[i - 1].x;
    const dy2 = cursorPositions[i].y - cursorPositions[i - 1].y;
    const jerk = Math.sqrt(Math.pow(dx2 - dx1, 2) + Math.pow(dy2 - dy1, 2));
    totalJerk += jerk;
  }

  // 计算跟踪误差
  let totalError = 0;
  const len = Math.min(cursorPositions.length, targetPositions.length);
  for (let i = 0; i < len; i++) {
    const dx = cursorPositions[i].x - targetPositions[i].x;
    const dy = cursorPositions[i].y - targetPositions[i].y;
    totalError += Math.sqrt(dx * dx + dy * dy);
  }
  const avgError = totalError / len;

  return Math.max(0, 100 / (1 + totalJerk * 0.1 + avgError * 0.05));
}
