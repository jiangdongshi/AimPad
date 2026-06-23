/**
 * 管理后台发布工具
 * 将管理员编辑的配置序列化为 TypeScript 源文件并触发浏览器下载
 */

import type { TrainingTaskConfig } from '@/types/training';

function formatTask(task: TrainingTaskConfig): string {
  return [
    `  {`,
    `    id: ${JSON.stringify(task.id)},`,
    `    name: ${JSON.stringify(task.name)},`,
    `    type: ${JSON.stringify(task.type)},`,
    `    description: ${JSON.stringify(task.description)},`,
    `    descriptionEn: ${JSON.stringify(task.descriptionEn)},`,
    `    duration: ${task.duration},`,
    `    parameters: {`,
    `      targetCount: ${task.parameters.targetCount},`,
    `      targetSize: ${task.parameters.targetSize},`,
    `      targetSpeed: ${task.parameters.targetSpeed},`,
    `      spawnInterval: ${task.parameters.spawnInterval},`,
    `      minDistance: ${task.parameters.minDistance},`,
    `      maxDistance: ${task.parameters.maxDistance},`,
    ...(task.parameters.hitsToBreak !== undefined
      ? [`      hitsToBreak: ${task.parameters.hitsToBreak},`]
      : []),
    `    },`,
    `    scoring: {`,
    `      weightAccuracy: ${task.scoring.weightAccuracy},`,
    `      weightSpeed: ${task.scoring.weightSpeed},`,
    `      weightConsistency: ${task.scoring.weightConsistency},`,
    `    },`,
    `  }`,
  ].join('\n');
}

export function generatePresetTasksSource(tasks: TrainingTaskConfig[]): string {
  const header = [
    `import type { TrainingTaskConfig } from '@/types/training';`,
    ``,
    `// ============================================`,
    `// 预设训练任务默认配置`,
    `// 此文件由管理后台生成，提交后编译进 bundle`,
    `// 所有用户看到的预设训练内容由此文件定义`,
    `// ============================================`,
    ``,
    `export const DEFAULT_PRESET_TASKS: TrainingTaskConfig[] = [`,
  ].join('\n');

  const footer = `];\n`;

  return header + '\n' + tasks.map(formatTask).join(',\n') + ',\n' + footer;
}

export function generateHotTasksSource(hotTaskIds: string[]): string {
  const header = [
    `// ============================================`,
    `// 首页"热门训练"默认配置`,
    `// 此文件由管理后台生成，提交后编译进 bundle`,
    `// ============================================`,
    ``,
    `// 热门训练展示的任务 ID 列表（按顺序）`,
    `export const DEFAULT_HOT_TASK_IDS: string[] = [`,
  ].join('\n');

  const body = hotTaskIds.map(id => `  '${id}'`).join(',\n');
  const footer = `];\n`;

  return header + '\n' + body + ',\n' + footer;
}

interface PublishReport {
  presetTasksSource: string;
  hotTasksSource: string;
  changedTaskIds: string[];
  changedHotIds: boolean;
}

export function generatePublishReport(
  tasks: TrainingTaskConfig[],
  hotTaskIds: string[]
): PublishReport {
  return {
    presetTasksSource: generatePresetTasksSource(tasks),
    hotTasksSource: generateHotTasksSource(hotTaskIds),
    changedTaskIds: tasks.map(t => t.id),
    changedHotIds: true,
  };
}

function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/typescript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadConfigFiles(
  tasks: TrainingTaskConfig[],
  hotTaskIds: string[]
): void {
  const tasksSource = generatePresetTasksSource(tasks);
  const hotSource = generateHotTasksSource(hotTaskIds);
  downloadFile('defaultPresetTasks.ts', tasksSource);
  downloadFile('defaultHotTasks.ts', hotSource);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
