export type TaskType =
  | 'static-clicking'
  | 'dynamic-clicking'
  | 'tracking'
  | 'target-switching'
  | 'reaction';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// 游戏难度（暂停界面可调节）
export type GameDifficulty = 'easy' | 'simple' | 'normal' | 'hard' | 'hell';

export interface GameDifficultyConfig {
  label: string;           // 显示名称（locale key）
  targetSizeMultiplier: number; // 目标大小倍率
  targetLifetime: number;  // 目标存活时间（ms），0 表示无限制
}

export const GAME_DIFFICULTY_CONFIG: Record<GameDifficulty, GameDifficultyConfig> = {
  easy:   { label: 'difficulty.easy',   targetSizeMultiplier: 1.5, targetLifetime: 0 },
  simple: { label: 'difficulty.simple', targetSizeMultiplier: 1.0, targetLifetime: 0 },
  normal: { label: 'difficulty.normal', targetSizeMultiplier: 0.7, targetLifetime: 0 },
  hard:   { label: 'difficulty.hard',   targetSizeMultiplier: 0.5, targetLifetime: 2000 },
  hell:   { label: 'difficulty.hell',   targetSizeMultiplier: 0.3, targetLifetime: 1200 },
};

export interface TrainingTaskConfig {
  id: string;
  name: string;
  type: TaskType;
  description: string;
  descriptionEn: string;
  difficulty: Difficulty;
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

// 预设任务配置
export const TRAINING_TASKS: TrainingTaskConfig[] = [
  {
    id: 'gridshot',
    name: 'Gridshot',
    type: 'static-clicking',
    description: '快速点击网格中的固定目标，训练基础定位能力',
    descriptionEn: 'Quickly click fixed targets in a grid to train basic aiming',
    difficulty: 'beginner',
    duration: 30000,
    parameters: {
      targetCount: 3,
      targetSize: 0.8,
      targetSpeed: 0,
      spawnInterval: 800,
      minDistance: 5,
      maxDistance: 10,
    },
    scoring: {
      weightAccuracy: 0.4,
      weightSpeed: 0.4,
      weightConsistency: 0.2,
    },
  },
  {
    id: 'spidershot',
    name: 'Spidershot',
    type: 'static-clicking',
    description: '从中心向四周快速射击目标，训练大范围定位',
    descriptionEn: 'Quickly shoot targets outward from center to train wide-range aiming',
    difficulty: 'beginner',
    duration: 30000,
    parameters: {
      targetCount: 1,
      targetSize: 0.6,
      targetSpeed: 0,
      spawnInterval: 1200,
      minDistance: 3,
      maxDistance: 12,
    },
    scoring: {
      weightAccuracy: 0.3,
      weightSpeed: 0.5,
      weightConsistency: 0.2,
    },
  },
  {
    id: 'sphere-track',
    name: 'SphereTrack',
    type: 'tracking',
    description: '持续追踪移动中的球体，训练跟枪平滑度',
    descriptionEn: 'Continuously track a moving sphere to improve tracking smoothness',
    difficulty: 'intermediate',
    duration: 30000,
    parameters: {
      targetCount: 1,
      targetSize: 1.2,
      targetSpeed: 3,
      spawnInterval: 0,
      minDistance: 5,
      maxDistance: 10,
    },
    scoring: {
      weightAccuracy: 0.6,
      weightSpeed: 0.1,
      weightConsistency: 0.3,
    },
  },
  {
    id: 'strafe-track',
    name: 'StrafeTrack',
    type: 'tracking',
    description: '追踪左右移动的目标，模拟实战跟枪',
    descriptionEn: 'Track a horizontally moving target to simulate real combat tracking',
    difficulty: 'intermediate',
    duration: 30000,
    parameters: {
      targetCount: 1,
      targetSize: 1.0,
      targetSpeed: 5,
      spawnInterval: 0,
      minDistance: 8,
      maxDistance: 15,
    },
    scoring: {
      weightAccuracy: 0.5,
      weightSpeed: 0.2,
      weightConsistency: 0.3,
    },
  },
  {
    id: 'target-switch',
    name: 'TargetSwitch',
    type: 'target-switching',
    description: '在多个目标间快速切换，训练目标切换能力',
    descriptionEn: 'Quickly switch between multiple targets to train target switching',
    difficulty: 'intermediate',
    duration: 30000,
    parameters: {
      targetCount: 5,
      targetSize: 0.7,
      targetSpeed: 0,
      spawnInterval: 500,
      minDistance: 5,
      maxDistance: 12,
    },
    scoring: {
      weightAccuracy: 0.3,
      weightSpeed: 0.5,
      weightConsistency: 0.2,
    },
  },
  {
    id: 'reflex-shot',
    name: 'ReflexShot',
    type: 'reaction',
    description: '目标随机出现并快速消失，训练反应速度',
    descriptionEn: 'Targets appear randomly and disappear quickly to train reaction speed',
    difficulty: 'advanced',
    duration: 30000,
    parameters: {
      targetCount: 1,
      targetSize: 0.5,
      targetSpeed: 0,
      spawnInterval: 2000,
      minDistance: 5,
      maxDistance: 15,
    },
    scoring: {
      weightAccuracy: 0.3,
      weightSpeed: 0.6,
      weightConsistency: 0.1,
    },
  },
];
