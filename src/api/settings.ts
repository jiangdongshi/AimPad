import { api } from './client';

export interface ServerSettings {
  theme: string;
  locale: string;
  crosshairStyle: string;
  crosshairColor: string;
  crosshairSize: number;
  fov: number;
  quality: string;
  soundEnabled: boolean;
  soundVolume: number;
  gamepadDeadzone: number;
  gamepadSensitivity: number;
  gamepadInvertY: boolean;
  gamepadFireButton: string;
  mouseSensitivity: number;
  mouseInvertY: boolean;
  updatedAt: string;
}

export const settingsApi = {
  get: () => api.get<{ settings: ServerSettings }>('/settings'),

  update: (data: Record<string, unknown>) =>
    api.put<{ settings: ServerSettings }>('/settings', data),
};
