export function normalizeFriendPair(userId: string, targetUserId: string) {
  return userId < targetUserId
    ? { userAId: userId, userBId: targetUserId }
    : { userAId: targetUserId, userBId: userId };
}
