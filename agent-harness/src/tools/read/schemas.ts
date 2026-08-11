import { z } from "zod";

const shortText = z.string().trim().min(1).max(80);

export const emptyInputSchema = z.object({}).strict();

export const circleSearchInputSchema = z
  .object({
    query: shortText,
    category: z.string().trim().min(1).max(40).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
    sort: z
      .enum(["recommended", "active", "members", "latest"])
      .default("recommended"),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export const forumSearchInputSchema = z
  .object({
    query: shortText,
    circleId: z.string().uuid().optional(),
    type: z
      .enum(["general", "squad", "help", "trade", "activity"])
      .optional(),
    sort: z.enum(["latest", "hot", "recommended"]).default("latest"),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export const profileStatusSchema = z
  .object({
    profileComplete: z.boolean(),
    missingFields: z.array(z.string()),
    profile: z
      .object({
        nickname: z.string().nullable(),
        gender: z.string().nullable(),
        genderPreference: z.string().nullable(),
        intention: z.string().nullable(),
        grade: z.string().nullable(),
        campus: z.string().nullable(),
        department: z.string().nullable(),
        mbti: z.string().nullable(),
        bio: z.string().nullable(),
        signature: z.string().nullable(),
        tags: z.array(z.string()).max(10),
      })
      .strict(),
  })
  .strict();

export const questionnaireStatusSchema = z
  .object({
    complete: z.boolean(),
    currentVersion: z.string(),
    submittedVersion: z.string().nullable(),
    needsUpdate: z.boolean(),
    submittedAt: z.string().nullable(),
  })
  .strict();

const circleSearchItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()).max(5),
    memberCount: z.number().int().nonnegative(),
    recommendationReasons: z.array(z.string()).max(5),
  })
  .strict();

export const circleSearchResultSchema = z
  .object({
    total: z.number().int().nonnegative(),
    circles: z.array(circleSearchItemSchema).max(10),
  })
  .strict();

const forumPostSearchItemSchema = z
  .object({
    postId: z.string(),
    circleId: z.string().nullable(),
    title: z.string(),
    type: z.string(),
    summary: z.string().nullable(),
    likeCount: z.number().int().nonnegative(),
    commentCount: z.number().int().nonnegative(),
    createdAt: z.string().nullable(),
  })
  .strict();

export const forumSearchResultSchema = z
  .object({
    total: z.number().int().nonnegative(),
    posts: z.array(forumPostSearchItemSchema).max(10),
  })
  .strict();

export const resonanceCapsuleStatusResultSchema = z.object({
  total: z.number().int().nonnegative(),
  capsules: z.array(z.object({
    id: z.string(), title: z.string(), status: z.string(),
    role: z.enum(["creator", "participant"]),
    hasResponded: z.boolean(), otherHasResponded: z.boolean(),
    expiresAt: z.string(),
  }).strict()).max(50),
}).strict();

export const meetupSafetyStatusResultSchema = z.object({
  total: z.number().int().nonnegative(),
  plans: z.array(z.object({
    id: z.string(), title: z.string(), status: z.string(),
    meetingAt: z.string(), expectedEndAt: z.string(),
  }).strict()).max(50),
}).strict();
