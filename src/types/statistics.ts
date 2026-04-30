export interface TrainingStats {
  totalSessions: number;
  averageScore: number;
  bestScore: number;
  averageAccuracy: number;
  averageReactionTime: number;
  improvementTrend: number; // 正数表示提升，负数表示下降
  recentScores: number[];
}

export interface TaskStats {
  taskId: string;
  taskName: string;
  sessions: number;
  bestScore: number;
  averageScore: number;
  averageAccuracy: number;
  lastPlayed: number;
}

export interface SkillRadar {
  accuracy: number;
  speed: number;
  consistency: number;
  tracking: number;
  reaction: number;
  switching: number;
}

export interface TimeSeriesData {
  timestamp: number;
  score: number;
  accuracy: number;
  reactionTime: number;
}

export type TimeRange = 'day' | 'week' | 'month' | 'year';
