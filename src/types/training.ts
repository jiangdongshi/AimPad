export type TaskType =
  | 'static-clicking'
  | 'dynamic-clicking'
  | 'tracking'
  | 'target-switching'
  | 'reaction';

export interface TrainingTaskConfig {
  id: string;
  name: string;
  type: TaskType;
  description: string;
  descriptionEn: string;
  duration: number; // 毫秒
  parameters: TaskParameters;
  scoring: ScoringWeights;
  icon?: string;
}

export interface TaskParameters {
  targetCount: number;
  targetSize: number;
  targetSpeed: number;
  spawnInterval: number; // ms
  minDistance: number;
  maxDistance: number;
  hitsToBreak?: number;  // 目标被击中多少次后刷新，默认1
}

export interface ScoringWeights {
  weightAccuracy: number;
  weightSpeed: number;
  weightConsistency: number;
}

export interface TrainingResult {
  id: string;
  taskId: string;
  timestamp: number;
  score: number;
  accuracy: number;
  reactionTime: number;
  reactionTimes: number[];
  kills: number;
  misses: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ScoreComponents {
  accuracy: number;       // 0-100
  speed: number;          // 0-100
  consistency: number;    // 0-100
  rawScore: number;
  finalScore: number;
}

// 预设任务配置（向后兼容导出）
export { DEFAULT_PRESET_TASKS as TRAINING_TASKS } from '@/config/defaultPresetTasks';
