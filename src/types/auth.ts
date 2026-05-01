export interface User {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SendCodeRequest {
  email: string;
  purpose: 'login' | 'register';
}

export interface RegisterRequest {
  email: string;
  code: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  code: string;
}
