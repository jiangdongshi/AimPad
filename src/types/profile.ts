import type { TrainingResult } from './training';
import type { CustomTask } from './customTask';

export interface LocalProfile {
  deviceId: string;
  displayName: string;
  avatarSeed: string;
  createdAt: number;
  version: number;
}

export interface ExportPayload {
  meta: {
    version: number;
    exportedAt: string;
    deviceId: string;
    recordCount: number;
    customTaskCount: number;
  };
  profile: LocalProfile;
  settings: Record<string, unknown>;
  trainingRecords: TrainingResult[];
  customTasks: CustomTask[];
  preferences: {
    taskDurations: Record<string, number>;
    taskDifficulties: Record<string, string>;
    ballColor: string;
    wallColor: string;
  };
}

export interface ImportResult {
  imported: boolean;
  recordCount: number;
  taskCount: number;
  merged: boolean;
  error?: string;
}
