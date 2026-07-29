import { db } from '../db/connection.js';
import { auditLogs } from '../db/schema.js';

interface AuditParams {
  operatorId?: string | null;
  action: string;         // e.g. 'trigger_matching', 'unlock_reveal', 'bulk_email'
  target?: string | null; // target user/entity id
  detail?: Record<string, unknown> | null;
  ip?: string | null;
  result?: 'success' | 'failure';
}

/**
 * Write an admin operation audit record.
 * Failures are swallowed so audit logging never interrupts the main flow.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      operatorId: params.operatorId ?? null,
      action: params.action,
      target: params.target ?? null,
      detail: params.detail != null ? JSON.stringify(params.detail) : null,
      ip: params.ip ?? null,
      result: params.result ?? 'success',
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/** Extract requester IP from an Express request, respecting common proxy headers. */
export function getRequestIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.ip ?? null;
}
