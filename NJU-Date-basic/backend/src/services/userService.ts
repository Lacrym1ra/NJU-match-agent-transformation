import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { forumComments, forumPosts, users } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

export interface UserStats {
  creditScore: number;
  receivedLikes: number;
  receivedFavorites: number;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [user] = await db
    .select({
      creditScore: users.creditScore,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  const [postStats] = await db
    .select({
      receivedLikes: sql`COALESCE(SUM(${forumPosts.likeCount}), 0)`.mapWith(Number),
      receivedFavorites: sql`COALESCE(SUM(${forumPosts.favoriteCount}), 0)`.mapWith(Number),
    })
    .from(forumPosts)
    .where(and(eq(forumPosts.userId, userId), isNull(forumPosts.deletedAt)));

  const [commentStats] = await db
    .select({
      receivedLikes: sql`COALESCE(SUM(${forumComments.likeCount}), 0)`.mapWith(Number),
    })
    .from(forumComments)
    .where(and(eq(forumComments.userId, userId), isNull(forumComments.deletedAt)));

  return {
    creditScore: user.creditScore ?? 100,
    receivedLikes: (postStats?.receivedLikes ?? 0) + (commentStats?.receivedLikes ?? 0),
    receivedFavorites: postStats?.receivedFavorites ?? 0,
  };
}
