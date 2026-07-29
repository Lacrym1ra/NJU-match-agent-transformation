import { api } from './client';

export interface StudentIdBindStatus {
  verified: boolean;
  last4: string | null;
  source: string | null;
  mergedIntoUserId: string | null;
}

export const getStudentIdBindStatus = () =>
  api.get<StudentIdBindStatus>('/student-id/bind/status');

export const sendStudentIdBindCode = (studentId: string) =>
  api.post<{ success: true; expiresIn: number }>('/student-id/bind/send-code', { studentId });

export const verifyStudentIdBind = (studentId: string, code: string) =>
  api.post<{ success: true; autoBound: boolean }>('/student-id/bind/verify', { studentId, code });

