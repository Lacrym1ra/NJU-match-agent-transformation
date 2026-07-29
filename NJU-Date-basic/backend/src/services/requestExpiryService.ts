import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { contactUnlockRequests, friendRequests } from '../db/schema.js';

export async function expireStaleG2Requests(now = new Date()) {
  const nowIso = now.toISOString();

  const expiredFriendRequests = await db.update(friendRequests)
    .set({
      status: 'expired',
      updatedAt: nowIso,
    })
    .where(and(
      eq(friendRequests.status, 'pending'),
      lte(friendRequests.expiresAt, nowIso),
    ))
    .returning({ id: friendRequests.id });

  const expiredContactUnlockRequests = await db.update(contactUnlockRequests)
    .set({
      status: 'expired',
      updatedAt: nowIso,
    })
    .where(and(
      eq(contactUnlockRequests.status, 'pending'),
      lte(contactUnlockRequests.expiresAt, nowIso),
    ))
    .returning({ id: contactUnlockRequests.id });

  return {
    friendRequestCount: expiredFriendRequests.length,
    contactUnlockRequestCount: expiredContactUnlockRequests.length,
  };
}
