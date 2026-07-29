export {
  areUsersActiveCircleMembers,
  areUsersBlocked,
  areUsersCircleFriends,
  areUsersGlobalFriends,
  buildCircleFriendPairCondition,
  buildGlobalFriendPairCondition,
  canUseCircleFriendForumContext,
  ensureGlobalFriendship,
  listCircleFriendshipsForTargets,
  listVisibleFriendCircles,
  normalizeFriendPair,
  revokeOrphanedGlobalFriendshipsForCirclePairs,
} from './socialGraphService.js';
export type {
  VisibleFriendCircle,
} from './socialGraphService.js';
