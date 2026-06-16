import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeId } from '@/types/theme';

export type LocaleId = 'en' | 'zh';

interface SettingsState {
  // Theme
  theme: ThemeId;

  // Language
  locale: LocaleId;

  // Gamepad
  leftDeadzone: number;
  rightDeadzone: number;
  gamepadSensitivity: number;
  gamepadInvertY: boolean;
  gamepadFireButton: string;

  // Mouse
  mouseSensitivity: number;
  mouseInvertY: boolean;

  // Display
  crosshairStyle: 'dot' | 'cross' | 'circle';
  crosshairColor: string;
  crosshairSize: number;
  fov: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';

  // Sound
  soundEnabled: boolean;
  soundVolume: number;

  // Actions
  updateSettings: (partial: Partial<SettingsState>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  theme: 'default' as ThemeId,
  locale: 'en' as LocaleId,
  leftDeadzone: 0.1,
  rightDeadzone: 0.1,
  gamepadSensitivity: 1.0,
  gamepadInvertY: false,
  gamepadFireButton: 'RT',
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

      updateSettings: (partial) => {
        set((state) => ({ ...state, ...partial }));
      },

      resetToDefaults: () => {
        set({ ...DEFAULT_SETTINGS });
      },
    }),
    {
      name: 'aimpad_settings',
      merge: (persisted: unknown, current) => {
        const p = persisted as Record<string, unknown> | null;
        // Migrate legacy gamepadDeadzone → leftDeadzone / rightDeadzone
        const legacyDeadzone = p?.gamepadDeadzone as number | undefined;
        return {
          ...current,
          ...(p as any),
          leftDeadzone: (p?.leftDeadzone as number) ?? legacyDeadzone ?? current.leftDeadzone,
          rightDeadzone: (p?.rightDeadzone as number) ?? legacyDeadzone ?? current.rightDeadzone,
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        leftDeadzone: state.leftDeadzone,
        rightDeadzone: state.rightDeadzone,
        gamepadSensitivity: state.gamepadSensitivity,
        gamepadInvertY: state.gamepadInvertY,
        gamepadFireButton: state.gamepadFireButton,
        mouseSensitivity: state.mouseSensitivity,
        mouseInvertY: state.mouseInvertY,
        crosshairStyle: state.crosshairStyle,
        crosshairColor: state.crosshairColor,
        crosshairSize: state.crosshairSize,
        fov: state.fov,
        quality: state.quality,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
      }),
    }
  )
);
