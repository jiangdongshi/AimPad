import { api } from './client';
import type { User } from '@/types/auth';

export interface AdminUser extends User {
  lastLoginAt: string | null;
}

export interface AdminTask {
  id: string;
  name: string;
  nameZh: string | null;
  type: string;
  description: string | null;
  duration: number;
  parameters: Record<string, unknown>;
  scoring: Record<string, number>;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
}

export const adminApi = {
  // 用户管理
  getUsers: (page = 1, pageSize = 20, search = '') =>
    api.get<{ users: AdminUser[]; total: number; page: number; pageSize: number }>(
      `/admin/users?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`
    ),

  getUser: (id: number) =>
    api.get<{ user: AdminUser }>(`/admin/users/${id}`),

  updateUser: (id: number, data: { role?: string; nickname?: string }) =>
    api.put<{ user: AdminUser }>(`/admin/users/${id}`, data),

  deleteUser: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/admin/users/${id}`),

  // 训练项目管理
  getTasks: () =>
    api.get<{ tasks: AdminTask[] }>('/admin/tasks'),

  createTask: (task: Partial<AdminTask>) =>
    api.post<{ success: boolean; task: AdminTask }>('/admin/tasks', task),

  updateTask: (id: string, data: Partial<AdminTask>) =>
    api.put<{ task: AdminTask }>(`/admin/tasks/${id}`, data),

  deleteTask: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/admin/tasks/${id}`),
};
