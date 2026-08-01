import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { forumComments, forumPosts, users } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

export interface UserStats {
  creditScore: number;
  receivedLikes: number;
  receivedFavorites: number;
}

const REQUIRED_PROFILE_FIELDS = [
  'nickname',
  'gender',
  'genderPref',
  'intention',
  'grade',
  'campus',
  'department',
] as const;

export async function getAgentProfileStatus(userId: string) {
  const [user] = await db
    .select({
      nickname: users.nickname,
      gender: users.gender,
      genderPref: users.genderPref,
      intention: users.intention,
      grade: users.grade,
      campus: users.campus,
      department: users.department,
      mbti: users.mbti,
      bio: users.bio,
      signature: users.signature,
      tags: users.tags,
      profileComplete: users.profileComplete,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  const missingFields = REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = user[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  return {
    profileComplete: Boolean(user.profileComplete) && missingFields.length === 0,
    missingFields,
    profile: {
      nickname: user.nickname,
      gender: user.gender,
      genderPreference: user.genderPref,
      intention: user.intention,
      grade: user.grade,
      campus: user.campus,
      department: user.department,
      mbti: user.mbti,
      bio: user.bio,
      signature: user.signature,
      tags: user.tags,
    },
  };
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
