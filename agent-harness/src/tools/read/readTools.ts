import type { ZodType } from "zod";
import type { Observation } from "../../core/types.js";
import type { Tool } from "../types.js";
import type { NjuMatchReadPort } from "./port.js";
import {
  circleSearchInputSchema,
  circleSearchResultSchema,
  emptyInputSchema,
  forumSearchInputSchema,
  forumSearchResultSchema,
  profileStatusSchema,
  questionnaireStatusSchema,
} from "./schemas.js";

function invalidArguments(tool: string): Observation {
  return {
    tool,
    ok: false,
    category: "INVALID_ARGUMENT",
    summary: `Arguments for ${tool} did not match its schema.`,
    retryable: true,
  };
}

function readTool<TInput, TOutput>(options: {
  readonly name: string;
  readonly inputSchema: ZodType<TInput>;
  readonly outputSchema: ZodType<TOutput>;
  readonly execute: (userId: string, input: TInput) => Promise<TOutput>;
  readonly summarize: (result: TOutput) => string;
  readonly isEmpty?: (result: TOutput) => boolean;
}): Tool {
  return {
    name: options.name,
    async execute(args, context) {
      const input = options.inputSchema.safeParse(args);
      if (!input.success) {
        return invalidArguments(options.name);
      }

      const output = options.outputSchema.safeParse(
        await options.execute(context.userId, input.data),
      );
      if (!output.success) {
        return {
          tool: options.name,
          ok: false,
          category: "SERVICE_ERROR",
          summary: `Output from ${options.name} did not match its contract.`,
          retryable: true,
        };
      }

      const result = output.data;
      const empty = options.isEmpty?.(result) ?? false;

      return {
        tool: options.name,
        ok: !empty,
        category: empty ? "NO_RESULTS" : "SUCCESS",
        summary: options.summarize(result),
        data: result,
        retryable: empty,
      };
    },
  };
}

export function createNjuMatchReadTools(port: NjuMatchReadPort): readonly Tool[] {
  return [
    readTool({
      name: "get_my_profile",
      inputSchema: emptyInputSchema,
      outputSchema: profileStatusSchema,
      execute: (userId) => port.getMyProfileStatus(userId),
      summarize: (result) =>
        result.profileComplete
          ? "The current user's profile is complete."
          : `The current user's profile is missing ${result.missingFields.length} required field(s).`,
    }),
    readTool({
      name: "get_questionnaire_status",
      inputSchema: emptyInputSchema,
      outputSchema: questionnaireStatusSchema,
      execute: (userId) => port.getQuestionnaireStatus(userId),
      summarize: (result) => {
        if (!result.complete) return "The questionnaire is incomplete.";
        if (result.needsUpdate) return "The questionnaire must be updated.";
        return "The questionnaire is complete and current.";
      },
    }),
    readTool({
      name: "search_circles",
      inputSchema: circleSearchInputSchema,
      outputSchema: circleSearchResultSchema,
      execute: (userId, input) => port.searchCircles(userId, input),
      summarize: (result) =>
        result.circles.length === 0
          ? "No visible circles matched the query."
          : `Found ${result.circles.length} visible circle(s).`,
      isEmpty: (result) => result.circles.length === 0,
    }),
    readTool({
      name: "search_forum_posts",
      inputSchema: forumSearchInputSchema,
      outputSchema: forumSearchResultSchema,
      execute: (userId, input) => port.searchForumPosts(userId, input),
      summarize: (result) =>
        result.posts.length === 0
          ? "No visible forum posts matched the query."
          : `Found ${result.posts.length} visible forum post(s).`,
      isEmpty: (result) => result.posts.length === 0,
    }),
  ];
}
