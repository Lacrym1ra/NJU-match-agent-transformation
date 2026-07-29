import { createHash } from 'crypto';
import { config } from '../config.js';

export function normalizeStudentId(raw: string): string {
  return String(raw || '').trim();
}

// NJU student ids: undergraduates use 9 digits; postgraduates use 12 digits.
export function isValidStudentId(studentId: string): boolean {
  return /^(?:\d{9}|\d{12})$/.test(studentId);
}

export function maskStudentId(studentId: string): string {
  if (!isValidStudentId(studentId)) return '***';
  const head = studentId.slice(0, 3);
  const tail = studentId.slice(-2);
  return `${head}****${tail}`;
}

export function hashStudentId(studentId: string): string {
  const normalized = normalizeStudentId(studentId);
  // Hash = sha256(normalized + pepper)
  return createHash('sha256')
    .update(`${normalized}:${config.heartbox.studentIdPepper}`)
    .digest('hex');
}

