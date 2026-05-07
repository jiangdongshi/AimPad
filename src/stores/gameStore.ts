import { create } from 'zustand';
import type { TrainingTaskConfig, TrainingResult } from '@/types/training';

type GameStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'completed';

interface GameState {
  status: GameStatus;
  currentTask: TrainingTaskConfig | null;
  result: TrainingResult | null;
  score: number;
  hits: number;
  misses: number;
  timeRemaining: number;
  fps: number;

  startTraining: (task: TrainingTaskConfig) => void;
  pauseTraining: () => void;
  resumeTraining: () => void;
  endTraining: (result: TrainingResult) => void;
  resetTraining: () => void;
  updateScore: (hits: number, misses: number) => void;
  setTimeRemaining: (time: number) => void;
  setFps: (fps: number) => void;
  updateFrameData: (data: { hits: number; misses: number; timeRemaining: number; fps: number }) => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'idle',
  currentTask: null,
  result: null,
  score: 0,
  hits: 0,
  misses: 0,
  timeRemaining: 0,
  fps: 0,

  startTraining: (task) => set({
    status: 'loading',
    currentTask: task,
    result: null,
    score: 0,
    hits: 0,
    misses: 0,
    timeRemaining: Math.ceil(task.duration / 1000),
  }),

  pauseTraining: () => set({ status: 'paused' }),

  resumeTraining: () => set({ status: 'playing' }),

  endTraining: (result) => set({
    status: 'completed',
    result,
    score: result.score,
  }),

  resetTraining: () => set({
    status: 'idle',
    currentTask: null,
    result: null,
    score: 0,
    hits: 0,
    misses: 0,
    timeRemaining: 0,
  }),

  updateScore: (hits, misses) => set({ hits, misses }),

  setTimeRemaining: (time) => set({ timeRemaining: time }),

  setFps: (fps) => set({ fps }),

  // 批量更新帧数据，避免多次 setState 触发重复渲染
  updateFrameData: (data: { hits: number; misses: number; timeRemaining: number; fps: number }) =>
    set(data),
}));
