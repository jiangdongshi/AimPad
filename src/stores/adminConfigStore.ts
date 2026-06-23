/**
 * 管理后台配置状态管理
 * 使用 Zustand + persist 管理管理员编辑的训练配置
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrainingTaskConfig } from '@/types/training';
import { DEFAULT_PRESET_TASKS } from '@/config/defaultPresetTasks';
import { DEFAULT_HOT_TASK_IDS } from '@/config/defaultHotTasks';
import { getDeviceId } from '@/utils/deviceId';

interface AdminConfigState {
  // 预设任务配置（管理员编辑的工作副本）
  presetTasks: TrainingTaskConfig[];

  // 热门任务配置
  hotTaskIds: string[];

  // 密码哈希（SHA-256 hex，以 deviceId 加盐）
  passwordHash: string | null;

  // 会话级认证状态（不持久化）
  isAuthenticated: boolean;

  // 密码操作
  setPassword: (password: string) => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  login: () => void;
  logout: () => void;

  // 任务编辑
  updateTask: (taskId: string, updates: Partial<TrainingTaskConfig>) => void;
  resetTask: (taskId: string) => void;
  resetAllTasks: () => void;
  addTask: (task: TrainingTaskConfig) => void;
  removeTask: (taskId: string) => void;

  // 热门任务管理
  toggleHotTask: (taskId: string) => void;
  moveHotTaskUp: (taskId: string) => void;
  moveHotTaskDown: (taskId: string) => void;
}

// SHA-256 哈希辅助函数
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeHash(password: string): Promise<string> {
  const deviceId = getDeviceId();
  return sha256(`${deviceId}:${password}`);
}

export const useAdminConfigStore = create<AdminConfigState>()(
  persist(
    (set, get) => ({
      presetTasks: structuredClone(DEFAULT_PRESET_TASKS),
      hotTaskIds: [...DEFAULT_HOT_TASK_IDS],
      passwordHash: null,
      isAuthenticated: false,

      setPassword: async (password: string) => {
        const hash = await computeHash(password);
        set({ passwordHash: hash, isAuthenticated: true });
      },

      verifyPassword: async (password: string) => {
        const hash = await computeHash(password);
        return hash === get().passwordHash;
      },

      login: () => set({ isAuthenticated: true }),

      logout: () => set({ isAuthenticated: false }),

      updateTask: (taskId: string, updates: Partial<TrainingTaskConfig>) => {
        set(state => ({
          presetTasks: state.presetTasks.map(t =>
            t.id === taskId ? { ...t, ...updates } : t
          ),
        }));
      },

      resetTask: (taskId: string) => {
        const defaultTask = DEFAULT_PRESET_TASKS.find(t => t.id === taskId);
        if (!defaultTask) return;
        set(state => ({
          presetTasks: state.presetTasks.map(t =>
            t.id === taskId ? structuredClone(defaultTask) : t
          ),
        }));
      },

      resetAllTasks: () => {
        set({ presetTasks: structuredClone(DEFAULT_PRESET_TASKS) });
      },

      addTask: (task: TrainingTaskConfig) => {
        set(state => ({
          presetTasks: [...state.presetTasks, task],
        }));
      },

      removeTask: (taskId: string) => {
        set(state => ({
          presetTasks: state.presetTasks.filter(t => t.id !== taskId),
          hotTaskIds: state.hotTaskIds.filter(id => id !== taskId),
        }));
      },

      toggleHotTask: (taskId: string) => {
        set(state => {
          if (state.hotTaskIds.includes(taskId)) {
            return { hotTaskIds: state.hotTaskIds.filter(id => id !== taskId) };
          }
          return { hotTaskIds: [...state.hotTaskIds, taskId] };
        });
      },

      moveHotTaskUp: (taskId: string) => {
        set(state => {
          const idx = state.hotTaskIds.indexOf(taskId);
          if (idx <= 0) return state;
          const newIds = [...state.hotTaskIds];
          [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
          return { hotTaskIds: newIds };
        });
      },

      moveHotTaskDown: (taskId: string) => {
        set(state => {
          const idx = state.hotTaskIds.indexOf(taskId);
          if (idx < 0 || idx >= state.hotTaskIds.length - 1) return state;
          const newIds = [...state.hotTaskIds];
          [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
          return { hotTaskIds: newIds };
        });
      },
    }),
    {
      name: 'aimpad-admin-config',
      partialize: (state) => ({
        presetTasks: state.presetTasks,
        hotTaskIds: state.hotTaskIds,
        passwordHash: state.passwordHash,
      }),
    }
  )
);
