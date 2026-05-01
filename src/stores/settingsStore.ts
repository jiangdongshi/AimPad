import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeId } from '@/types/theme';
import { settingsApi, type ServerSettings } from '@/api/settings';

export type LocaleId = 'en' | 'zh';
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SettingsState {
  // 主题设置
  theme: ThemeId;

  // 语言设置
  locale: LocaleId;

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

  // 同步状态
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;

  // 操作
  updateSettings: (partial: Partial<SettingsState>) => void;
  resetToDefaults: () => void;
  loadFromServer: () => Promise<void>;
  syncToServer: () => Promise<void>;
}

const DEFAULT_SETTINGS = {
  theme: 'default' as ThemeId,
  locale: 'en' as LocaleId,
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

/** 从服务器设置对象中提取可合并到 store 的字段 */
function pickSettings(server: ServerSettings) {
  return {
    theme: server.theme as ThemeId,
    locale: server.locale as LocaleId,
    crosshairStyle: server.crosshairStyle as 'dot' | 'cross' | 'circle',
    crosshairColor: server.crosshairColor,
    crosshairSize: server.crosshairSize,
    fov: server.fov,
    quality: server.quality as 'low' | 'medium' | 'high' | 'ultra',
    soundEnabled: server.soundEnabled,
    soundVolume: server.soundVolume,
    gamepadDeadzone: server.gamepadDeadzone,
    gamepadSensitivity: server.gamepadSensitivity,
    gamepadInvertY: server.gamepadInvertY,
    mouseSensitivity: server.mouseSensitivity,
    mouseInvertY: server.mouseInvertY,
  };
}

/** 从当前 store 状态中提取需要同步到服务器的字段 (snake_case) */
function toServerPayload(state: SettingsState) {
  return {
    theme: state.theme,
    locale: state.locale,
    crosshair_style: state.crosshairStyle,
    crosshair_color: state.crosshairColor,
    crosshair_size: state.crosshairSize,
    fov: state.fov,
    quality: state.quality,
    sound_enabled: state.soundEnabled ? 1 : 0,
    sound_volume: state.soundVolume,
    gamepad_deadzone: state.gamepadDeadzone,
    gamepad_sensitivity: state.gamepadSensitivity,
    gamepad_invert_y: state.gamepadInvertY ? 1 : 0,
    mouse_sensitivity: state.mouseSensitivity,
    mouse_invert_y: state.mouseInvertY ? 1 : 0,
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      syncStatus: 'idle' as SyncStatus,
      lastSyncedAt: null as string | null,

      updateSettings: (partial) => {
        set((state) => ({ ...state, ...partial }));
        // 防抖同步到服务器
        debouncedSyncToServer(get, set);
      },

      resetToDefaults: () => {
        set({ ...DEFAULT_SETTINGS, syncStatus: 'idle', lastSyncedAt: get().lastSyncedAt });
        debouncedSyncToServer(get, set);
      },

      loadFromServer: async () => {
        try {
          const { settings } = await settingsApi.get();
          if (settings) {
            set({
              ...pickSettings(settings),
              syncStatus: 'saved',
              lastSyncedAt: settings.updatedAt,
            });
          }
        } catch {
          // 静默失败，使用本地缓存
          console.warn('[settings] Failed to load from server, using local cache');
        }
      },

      syncToServer: async () => {
        const state = get();
        set({ syncStatus: 'saving' });
        try {
          const { settings } = await settingsApi.update(toServerPayload(state));
          set({ syncStatus: 'saved', lastSyncedAt: settings.updatedAt });
        } catch {
          set({ syncStatus: 'error' });
          console.warn('[settings] Failed to sync to server');
        }
      },
    }),
    {
      name: 'aimpad-settings',
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        gamepadDeadzone: state.gamepadDeadzone,
        gamepadSensitivity: state.gamepadSensitivity,
        gamepadInvertY: state.gamepadInvertY,
        mouseSensitivity: state.mouseSensitivity,
        mouseInvertY: state.mouseInvertY,
        crosshairStyle: state.crosshairStyle,
        crosshairColor: state.crosshairColor,
        crosshairSize: state.crosshairSize,
        fov: state.fov,
        quality: state.quality,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

function debouncedSyncToServer(
  get: () => SettingsState,
  set: (partial: Partial<SettingsState>) => void
) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    // 检查是否有 token（用户已登录）
    try {
      const raw = localStorage.getItem('aimpad-auth');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      if (!token) return;
    } catch {
      return;
    }

    set({ syncStatus: 'saving' });
    try {
      const state = get();
      const { settings } = await settingsApi.update(toServerPayload(state));
      set({ syncStatus: 'saved', lastSyncedAt: settings.updatedAt });
    } catch {
      set({ syncStatus: 'error' });
    }
  }, 800);
}
