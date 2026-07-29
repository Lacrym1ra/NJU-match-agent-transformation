export const CIRCLE_MEMBERSHIP_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
} as const;

export type CircleMembershipStatus =
  typeof CIRCLE_MEMBERSHIP_STATUS[keyof typeof CIRCLE_MEMBERSHIP_STATUS];
