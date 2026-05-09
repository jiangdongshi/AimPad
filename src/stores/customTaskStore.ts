/**
 * 自定义任务状态管理
 * 使用 Zustand + persist 管理自定义任务列表
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomTask, SceneConfig } from '@/types/customTask';
import { encodeShareCode, decodeShareCode } from '@/utils/shareCode';

interface CustomTaskState {
  // 自定义任务列表
  tasks: CustomTask[];
  // 收藏的任务 ID 列表（包含预设和自定义任务）
  favorites: string[];

  // 操作方法
  addTask: (config: SceneConfig) => CustomTask;
  removeTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<SceneConfig>) => void;
  getTaskById: (id: string) => CustomTask | undefined;
  getAllTasks: () => CustomTask[];
  incrementPlayCount: (id: string) => void;
  importFromShareCode: (code: string) => CustomTask | null;
  clearAllTasks: () => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const STORAGE_KEY = 'aimpad-custom-tasks';

export const useCustomTaskStore = create<CustomTaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      favorites: [],

      addTask: (config: SceneConfig): CustomTask => {
        const now = Date.now();
        const task: CustomTask = {
          ...config,
          id: `custom-${now}`,
          shareCode: encodeShareCode(config),
          createdAt: now,
          updatedAt: now,
          isPublic: false,
          playCount: 0,
        };

        set((state) => ({
          tasks: [...state.tasks, task],
        }));

        return task;
      },

      removeTask: (id: string) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },

      updateTask: (id: string, updates: Partial<SceneConfig>) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;

            const updated = { ...t, ...updates, updatedAt: Date.now() };
            // 如果配置变更，重新生成分享码
            if (updates.target || updates.movement || updates.spawn || updates.display) {
              updated.shareCode = encodeShareCode(updated);
            }
            return updated;
          }),
        }));
      },

      getTaskById: (id: string): CustomTask | undefined => {
        return get().tasks.find((t) => t.id === id);
      },

      getAllTasks: (): CustomTask[] => {
        return get().tasks;
      },

      incrementPlayCount: (id: string) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, playCount: t.playCount + 1 } : t
          ),
        }));
      },

      importFromShareCode: (code: string): CustomTask | null => {
        const config = decodeShareCode(code);
        if (!config) return null;

        const now = Date.now();
        const task: CustomTask = {
          ...config,
          id: `custom-${now}`,
          shareCode: code,
          createdAt: now,
          updatedAt: now,
          isPublic: false,
          playCount: 0,
        };

        set((state) => ({
          tasks: [...state.tasks, task],
        }));

        return task;
      },

      clearAllTasks: () => {
        set({ tasks: [] });
      },

      toggleFavorite: (id: string) => {
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((f) => f !== id)
            : [...state.favorites, id],
        }));
      },

      isFavorite: (id: string): boolean => {
        return get().favorites.includes(id);
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
