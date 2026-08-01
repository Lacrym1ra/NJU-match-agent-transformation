import { z } from "zod";

export const postDraftInputSchema = z.strictObject({
  circleId: z.uuid().optional(),
  title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(10_000),
  type: z.enum(["general", "squad", "help", "trade", "activity"]),
  isAnonymous: z.boolean().optional(),
});

export const publishPostInputSchema = z.strictObject({
  draftId: z.uuid(),
  confirmationToken: z.uuid(),
});

export const joinCircleInputSchema = z.strictObject({
  circleId: z.uuid(),
  applicationReason: z.string().trim().max(500).optional(),
  confirmationToken: z.uuid(),
});
