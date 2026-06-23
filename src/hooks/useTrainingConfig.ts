/**
 * 训练配置解析 Hook
 * 管理员（已认证）看到 adminConfigStore 的编辑副本
 * 普通用户看到编译时的默认配置
 */

import { useAdminConfigStore } from '@/stores/adminConfigStore';
import { DEFAULT_PRESET_TASKS } from '@/config/defaultPresetTasks';
import { DEFAULT_HOT_TASK_IDS } from '@/config/defaultHotTasks';
import type { TrainingTaskConfig } from '@/types/training';

export function useTrainingConfig() {
  const isAdmin = useAdminConfigStore((s) => s.isAuthenticated);
  const adminTasks = useAdminConfigStore((s) => s.presetTasks);
  const adminHotIds = useAdminConfigStore((s) => s.hotTaskIds);

  const presetTasks: TrainingTaskConfig[] = isAdmin ? adminTasks : DEFAULT_PRESET_TASKS;
  const hotTaskIds: string[] = isAdmin ? adminHotIds : DEFAULT_HOT_TASK_IDS;

  const getTaskById = (id: string): TrainingTaskConfig | undefined =>
    presetTasks.find(t => t.id === id);

  // 从 hotTaskIds 解析出完整的热门任务列表（保持排序，过滤不存在/无效 id）
  const hotTasks: TrainingTaskConfig[] = hotTaskIds
    .map(id => getTaskById(id))
    .filter((t): t is TrainingTaskConfig => t !== undefined);

  return {
    presetTasks,
    hotTaskIds,
    hotTasks,
    getTaskById,
  };
}
