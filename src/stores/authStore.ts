import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';
import { authApi } from '@/api/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, code: string) => Promise<void>;
  register: (email: string, code: string, username: string) => Promise<void>;
  sendCode: (email: string, purpose: 'login' | 'register' | 'reset') => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      sendCode: async (email, purpose) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.sendCode({ email, purpose });
          set({ isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: (err as Error).message });
          throw err;
        }
      },

      register: async (email, code, username) => {
        set({ isLoading: true, error: null });
        try {
          const { token, user } = await authApi.register({ email, code, username });
          set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: (err as Error).message });
          throw err;
        }
      },

      login: async (email, code) => {
        set({ isLoading: true, error: null });
        try {
          const { token, user } = await authApi.login({ email, code });
          set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: (err as Error).message });
          throw err;
        }
      },

      resetPassword: async (email, code, password) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.resetPassword({ email, code, password });
          set({ isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: (err as Error).message });
          throw err;
        }
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false, error: null });
      },

      fetchUser: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const { user } = await authApi.me();
          set({ user, isAuthenticated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'aimpad-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
