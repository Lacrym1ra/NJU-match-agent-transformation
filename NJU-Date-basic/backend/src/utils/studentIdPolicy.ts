import { isValidStudentId } from './studentId.js';

export function canonicalStudentIdFromEmail(email: string): string | null {
  const localPart = email.split('@')[0] ?? '';
  return isValidStudentId(localPart) ? localPart : null;
}

export function canonicalStudentEmailFromId(studentId: string): string {
  return `${studentId}@smail.nju.edu.cn`;
}

export function shouldAutoBindByEmail(email: string, inputStudentId: string): boolean {
  const canonical = canonicalStudentIdFromEmail(email);
  return !!canonical && canonical === inputStudentId;
}
