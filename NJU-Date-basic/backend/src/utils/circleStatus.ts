export const CIRCLE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING_REVIEW: 'pending_review',
  REJECTED: 'rejected',
  BANNED: 'banned',
  ARCHIVED: 'archived',
} as const;

export type CircleStatus = typeof CIRCLE_STATUS[keyof typeof CIRCLE_STATUS];
