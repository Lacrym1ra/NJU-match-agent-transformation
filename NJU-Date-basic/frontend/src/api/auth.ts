import { api } from './client';
import { setToken } from './token';

export interface AuthUser {
  id: string;
  email: string;
  profileComplete: boolean;
  surveyComplete: boolean;
}

export interface VerifyResponse {
  token: string;
  isNewUser: boolean;
  user: AuthUser;
}

export const sendCode = (email: string) =>
  api.post<{ message: string; expiresIn: number }>('/auth/send-code', { email });

// Legacy compatibility API (OTP direct sign-in), currently unused by login page.
export const verifyCode = async (email: string, code: string): Promise<VerifyResponse> => {
  const res = await api.post<VerifyResponse>('/auth/verify-code', { email, code });
  setToken(res.token);
  return res;
};

export const loginWithPassword = async (email: string, password: string): Promise<VerifyResponse> => {
  const res = await api.post<VerifyResponse>('/auth/login', { email, password });
  setToken(res.token);
  return res;
};

export const registerWithPassword = async (email: string, code: string, password: string): Promise<VerifyResponse> => {
  const res = await api.post<VerifyResponse>('/auth/register', { email, code, password });
  setToken(res.token);
  return res;
};

export const sendResetPasswordCode = (email: string) =>
  api.post<{ message: string; expiresIn: number }>('/auth/forgot-password/send-code', { email });

export const resetPassword = (email: string, code: string, newPassword: string) =>
  api.post<{ message: string }>('/auth/forgot-password/reset', { email, code, newPassword });
