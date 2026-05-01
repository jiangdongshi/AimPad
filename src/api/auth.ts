import { api } from './client';
import type { AuthResponse, SendCodeRequest, RegisterRequest, LoginRequest, ResetPasswordRequest, User } from '@/types/auth';

export const authApi = {
  sendCode: (data: SendCodeRequest) =>
    api.post<{ success: boolean; message: string }>('/auth/send-code', data),

  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<{ success: boolean; message: string }>('/auth/reset-password', data),

  me: () =>
    api.get<{ user: User; settings: Record<string, unknown> }>('/auth/me'),
};
