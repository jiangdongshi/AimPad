/**
 * 自定义训练任务配置类型定义
 * 用于配置驱动的训练任务系统
 */

// 运动类型
export type MovementType = 'static' | 'linear' | 'circular' | 'sine' | 'random' | 'figure8';

// 目标形状
export type TargetShape = 'sphere' | 'cube' | 'cylinder' | 'flat';

// 生成模式
export type SpawnMode = 'interval' | 'continuous' | 'burst';

// 任务类型（用于分类）
export type TaskCategory = 'static-clicking' | 'dynamic-clicking' | 'tracking' | 'target-switching' | 'reaction';

// 目标配置
export interface TargetConfig {
  shape: TargetShape;
  size: number;           // 0.3 ~ 2.0
  color: string;           // hex color
  glowIntensity: number;  // 0 ~ 1
  emissive: boolean;       // 是否自发光
}

// 运动模式额外参数
export interface MovementPattern {
  amplitude?: number;   // 运动幅度
  frequency?: number;   // 运动频率
  phase?: number;       // 初始相位
}

// 运动边界
export interface MovementBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// 运动配置
export interface MovementConfig {
  type: MovementType;
  speed: number;          // 1 ~ 10
  randomness?: number;    // 0 ~ 100, 路径噪声强度（跟踪训练用）
  pattern?: MovementPattern;
  bounds?: MovementBounds;
}

// 生成配置
export interface SpawnConfig {
  mode: SpawnMode;
  interval: number;       // ms (interval 模式)
  maxActive: number;       // 最大同时存在目标数
  lifetime: number;        // ms, 0 = 无限
  staggerDelay: number;    // burst 模式下的间隔
}

// 网格显示配置 (仅 grid 类型需要)
export interface GridDisplayConfig {
  rows: number;            // 1 ~ 10
  cols: number;            // 1 ~ 20
  showLines: boolean;
  lineColor: string;
  wallColor: string;
  wallHeight: number;      // 目标墙高度
}

// 计分权重
export interface ScoringWeights {
  weightAccuracy: number;     // 0 ~ 1
  weightSpeed: number;        // 0 ~ 1
  weightConsistency: number;  // 0 ~ 1
}

// 完整场景配置
export interface SceneConfig {
  // 基础信息
  id?: string;             // 分享码解码时自动生成
  name: string;            // 任务名称 (1-32 字符)
  description: string;     // 任务描述 (0-200 字符)

  // 任务类型
  category: TaskCategory;

  // 训练时长（ms），0 表示不限时
  duration: number;

  // 目标配置
  target: TargetConfig;

  // 运动配置
  movement: MovementConfig;

  // 生成配置
  spawn: SpawnConfig;

  // 网格显示配置 (仅 grid/static 类型需要)
  display?: GridDisplayConfig;

  // 计分配置
  scoring: ScoringWeights;
}

// 自定义任务（带元数据）
export interface CustomTask extends SceneConfig {
  id: string;              // 本地唯一 ID
  shareCode: string;       // 分享码
  createdAt: number;        // 创建时间戳
  updatedAt: number;        // 更新时间戳
  isPublic: boolean;        // 是否公开
  playCount: number;       // 被游玩次数
}

// 预设任务转换为自定义任务格式
export function toCustomTask(config: SceneConfig, shareCode: string): CustomTask {
  const now = Date.now();
  return {
    ...config,
    id: `custom-${now}`,
    shareCode,
    createdAt: now,
    updatedAt: now,
    isPublic: false,
    playCount: 0,
  };
}

// 默认目标配置
export const DEFAULT_TARGET: TargetConfig = {
  shape: 'sphere',
  size: 0.8,
  color: '#ADD8E6',
  glowIntensity: 0.5,
  emissive: true,
};

// 默认运动配置
export const DEFAULT_MOVEMENT: MovementConfig = {
  type: 'static',
  speed: 3,
  bounds: { xMin: -5, xMax: 5, yMin: 3, yMax: 8 },
};

// 默认生成配置
export const DEFAULT_SPAWN: SpawnConfig = {
  mode: 'interval',
  interval: 800,
  maxActive: 3,
  lifetime: 0,
  staggerDelay: 0,
};

// 默认网格显示配置
export const DEFAULT_DISPLAY: GridDisplayConfig = {
  rows: 3,
  cols: 5,
  showLines: true,
  lineColor: '#333344',
  wallColor: '#1a1a2e',
  wallHeight: 10,
};

// 默认计分配置
export const DEFAULT_SCORING: ScoringWeights = {
  weightAccuracy: 0.4,
  weightSpeed: 0.4,
  weightConsistency: 0.2,
};

// 创建空白配置的工厂函数
export function createDefaultSceneConfig(): SceneConfig {
  return {
    name: '',
    description: '',
    category: 'static-clicking',
    duration: 30000,
    target: { ...DEFAULT_TARGET },
    movement: { ...DEFAULT_MOVEMENT },
    spawn: { ...DEFAULT_SPAWN },
    display: { ...DEFAULT_DISPLAY },
    scoring: { ...DEFAULT_SCORING },
  };
}

// 预设任务模板（可作为自定义任务的起点）
export const TASK_TEMPLATES: Omit<SceneConfig, 'name' | 'description'>[] = [
  {
    category: 'static-clicking',
    duration: 30000,
    target: { shape: 'sphere', size: 0.8, color: '#FF3333', glowIntensity: 0.5, emissive: true },
    movement: { type: 'static', speed: 0, bounds: { xMin: -5, xMax: 5, yMin: 3, yMax: 8 } },
    spawn: { mode: 'interval', interval: 800, maxActive: 3, lifetime: 0, staggerDelay: 0 },
    display: { rows: 3, cols: 5, showLines: true, lineColor: '#333344', wallColor: '#1a1a2e', wallHeight: 10 },
    scoring: { weightAccuracy: 0.4, weightSpeed: 0.4, weightConsistency: 0.2 },
  },
  {
    category: 'tracking',
    duration: 30000,
    target: { shape: 'sphere', size: 1.2, color: '#33D94D', glowIntensity: 0.6, emissive: true },
    movement: { type: 'circular', speed: 3, bounds: { xMin: -4, xMax: 4, yMin: 4, yMax: 8 } },
    spawn: { mode: 'continuous', interval: 0, maxActive: 1, lifetime: 0, staggerDelay: 0 },
    display: { rows: 3, cols: 5, showLines: true, lineColor: '#333344', wallColor: '#1a1a2e', wallHeight: 10 },
    scoring: { weightAccuracy: 0.6, weightSpeed: 0.1, weightConsistency: 0.3 },
  },
];
