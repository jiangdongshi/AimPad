import { trainingStorage } from './storage';
import type { ExportPayload, ImportResult } from '@/types/profile';

export async function exportAllData(): Promise<string> {
  const records = await trainingStorage.getRecords(undefined, 100000);
  const profile = JSON.parse(localStorage.getItem('aimpad_profile') || '{}');
  const settings = JSON.parse(localStorage.getItem('aimpad_settings') || '{}');
  const customTasks = JSON.parse(localStorage.getItem('aimpad_custom_tasks') || '[]');

  const payload: ExportPayload = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      deviceId: profile.deviceId || '',
      recordCount: records.length,
      customTaskCount: customTasks.length,
    },
    profile,
    settings,
    trainingRecords: records,
    customTasks,
    preferences: {
      taskDurations: JSON.parse(localStorage.getItem('aimpad_task_durations') || '{}'),
      taskDifficulties: JSON.parse(localStorage.getItem('aimpad_task_difficulties') || '{}'),
      ballColor: localStorage.getItem('aimpad_ball_color') || '#ADD8E6',
      wallColor: localStorage.getItem('aimpad_wall_color') || '',
    },
  };
  return JSON.stringify(payload, null, 2);
}

export async function importData(json: string): Promise<ImportResult> {
  let payload: ExportPayload;
  try {
    payload = JSON.parse(json);
  } catch {
    return { imported: false, recordCount: 0, taskCount: 0, merged: false, error: 'Invalid JSON file' };
  }

  if (payload.meta.version !== 1) {
    return { imported: false, recordCount: 0, taskCount: 0, merged: false, error: 'Unsupported data version' };
  }

  // Merge training records (dedup by id)
  const existingIds = new Set((await trainingStorage.getRecords(undefined, 100000)).map(r => r.id));
  let importedRecords = 0;
  for (const record of payload.trainingRecords) {
    if (!existingIds.has(record.id)) {
      await trainingStorage.saveRecord(record);
      importedRecords++;
    }
  }

  // Merge custom tasks (dedup by id)
  const existingTasks: Array<{ id: string }> = JSON.parse(
    localStorage.getItem('aimpad_custom_tasks') || '[]'
  );
  const existingTaskIds = new Set(existingTasks.map((t: { id: string }) => t.id));
  let importedTasks = 0;
  for (const task of payload.customTasks) {
    if (!existingTaskIds.has(task.id)) {
      existingTasks.push(task);
      importedTasks++;
    }
  }
  localStorage.setItem('aimpad_custom_tasks', JSON.stringify(existingTasks));

  return { imported: true, recordCount: importedRecords, taskCount: importedTasks, merged: true };
}

export async function getStorageSize(): Promise<{ indexedDB: number; localStorage: number }> {
  // Estimate IndexedDB size
  let indexedDBSize = 0;
  try {
    const records = await trainingStorage.getRecords(undefined, 100000);
    indexedDBSize = new Blob([JSON.stringify(records)]).size;
  } catch {
    // ignore
  }

  // Calculate localStorage size
  let localStorageSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorageSize += key.length + value.length;
      }
    }
  }

  return { indexedDB: indexedDBSize, localStorage: localStorageSize * 2 }; // UTF-16 → bytes
}

export function clearAllData(): Promise<void> {
  localStorage.clear();
  return trainingStorage.clearAll();
}
