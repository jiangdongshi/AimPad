import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // 手柄设置
  gamepadDeadzone: number;
  gamepadSensitivity: number;
  gamepadInvertY: boolean;

  // 鼠标设置
  mouseSensitivity: number;
  mouseInvertY: boolean;

  // 显示设置
  crosshairStyle: 'dot' | 'cross' | 'circle';
  crosshairColor: string;
  crosshairSize: number;
  fov: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';

  // 音效设置
  soundEnabled: boolean;
  soundVolume: number;

  // 操作
  updateSettings: (partial: Partial<SettingsState>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  gamepadDeadzone: 0.1,
  gamepadSensitivity: 1.0,
  gamepadInvertY: false,
  mouseSensitivity: 1.0,
  mouseInvertY: false,
  crosshairStyle: 'dot' as const,
  crosshairColor: '#00ff00',
  crosshairSize: 4,
  fov: 90,
  quality: 'high' as const,
  soundEnabled: true,
  soundVolume: 0.7,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (partial) => set((state) => ({ ...state, ...partial })),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'aimpad-settings',
    }
  )
);
