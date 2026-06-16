import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDeviceId } from '@/utils/deviceId';
import type { LocalProfile } from '@/types/profile';

interface ProfileState extends LocalProfile {
  updateDisplayName: (name: string) => void;
  regenerateAvatar: () => void;
}

function createDefaultProfile(): LocalProfile {
  const deviceId = getDeviceId();
  return {
    deviceId,
    displayName: `Player_${deviceId.slice(0, 4)}`,
    avatarSeed: Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    version: 1,
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...createDefaultProfile(),

      updateDisplayName: (name: string) => {
        if (name.length >= 1 && name.length <= 32) {
          set({ displayName: name });
        }
      },

      regenerateAvatar: () => {
        set({ avatarSeed: Math.random().toString(36).slice(2, 8) });
      },
    }),
    {
      name: 'aimpad_profile',
      onRehydrateStorage: () => (state) => {
        if (!state?.deviceId) {
          const defaults = createDefaultProfile();
          useProfileStore.setState(defaults);
        }
      },
    }
  )
);
