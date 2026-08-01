import type { Observation } from "../../core/types.js";
import type { Tool } from "../types.js";
import { ConfirmationStore } from "./confirmation.js";
import type { NjuMatchActionPort } from "./port.js";
import { joinCircleInputSchema, postDraftInputSchema, publishPostInputSchema } from "./schemas.js";

const invalid = (tool: string): Observation => ({
  tool, ok: false, category: "INVALID_ARGUMENT",
  summary: `Arguments for ${tool} did not match its schema.`, retryable: true,
});

const denied = (tool: string): Observation => ({
  tool, ok: false, category: "POLICY_DENIED",
  summary: "Explicit user confirmation is missing, expired, mismatched, or already used.", retryable: false,
});

export function createNjuMatchActionTools(
  port: NjuMatchActionPort,
  confirmations: ConfirmationStore,
): readonly Tool[] {
  return [
    {
      name: "draft_forum_post",
      async execute(args, context) {
        const input = postDraftInputSchema.safeParse(args);
        if (!input.success) return invalid("draft_forum_post");
        const draft = await port.createPostDraft(context.userId, input.data);
        return {
          tool: "draft_forum_post", ok: true, category: "SUCCESS",
          summary: "Post draft created. Ask the user to review it before publishing.",
          data: { ...draft, requiresConfirmation: true, confirmationAction: "publish_forum_post" },
          retryable: false,
        };
      },
    },
    {
      name: "publish_forum_post",
      async execute(args, context) {
        const input = publishPostInputSchema.safeParse(args);
        if (!input.success) return invalid("publish_forum_post");
        if (!confirmations.consume(input.data.confirmationToken, context.userId, "publish_forum_post", input.data.draftId)) {
          return denied("publish_forum_post");
        }
        const result = await port.publishPost(context.userId, input.data.draftId);
        return { tool: "publish_forum_post", ok: true, category: "SUCCESS", summary: "Post published.", data: result, retryable: false };
      },
    },
    {
      name: "join_circle",
      async execute(args, context) {
        const input = joinCircleInputSchema.safeParse(args);
        if (!input.success) return invalid("join_circle");
        if (!confirmations.consume(input.data.confirmationToken, context.userId, "join_circle", input.data.circleId)) {
          return denied("join_circle");
        }
        const { confirmationToken: _confirmationToken, ...request } = input.data;
        const result = await port.joinCircle(context.userId, request);
        return { tool: "join_circle", ok: true, category: "SUCCESS", summary: result.status === "joined" ? "Joined the circle." : "Circle join request submitted.", data: result, retryable: false };
      },
    },
  ];
}
