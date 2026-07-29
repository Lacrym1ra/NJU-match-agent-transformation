import { AppError } from '../utils/errors.js';

export const G2_CIRCLE_REQUEST_COOLDOWN_POLICY = {
  rejectLimit: 2,
  rejectWindowDays: 30,
  cooldownDays: 7,
} as const;

export interface G2RejectedRequestTimestamp {
  createdAt?: string | null;
  updatedAt?: string | null;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseTimestamp(value?: string | null) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
}

export function getG2CircleRequestRejectWindowStart(now = new Date()) {
  return addDays(now, -G2_CIRCLE_REQUEST_COOLDOWN_POLICY.rejectWindowDays).toISOString();
}

export function calculateG2CircleRequestRetryAt(
  rejectedRows: G2RejectedRequestTimestamp[],
  now = new Date(),
) {
  if (rejectedRows.length < G2_CIRCLE_REQUEST_COOLDOWN_POLICY.rejectLimit) {
    return null;
  }

  const latestRejectedAt = rejectedRows
    .map((row) => parseTimestamp(row.updatedAt) ?? parseTimestamp(row.createdAt))
    .filter((time): time is number => time !== null)
    .sort((a, b) => b - a)[0];

  if (latestRejectedAt === undefined) {
    return null;
  }

  const retryAt = addDays(
    new Date(latestRejectedAt),
    G2_CIRCLE_REQUEST_COOLDOWN_POLICY.cooldownDays,
  );

  return retryAt.getTime() > now.getTime() ? retryAt.toISOString() : null;
}

export function assertG2CircleRequestCooldown(
  rejectedRows: G2RejectedRequestTimestamp[],
  message: string,
  now = new Date(),
) {
  const retryAt = calculateG2CircleRequestRetryAt(rejectedRows, now);
  if (!retryAt) return;

  const err = new AppError(429, 'REQUEST_RATE_LIMITED', message) as AppError & { retryAt: string };
  err.retryAt = retryAt;
  throw err;
}
