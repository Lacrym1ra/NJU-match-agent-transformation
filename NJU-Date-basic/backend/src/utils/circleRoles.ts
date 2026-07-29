export const CIRCLE_MEMBER_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const;

export type CircleMemberRole = typeof CIRCLE_MEMBER_ROLE[keyof typeof CIRCLE_MEMBER_ROLE];
