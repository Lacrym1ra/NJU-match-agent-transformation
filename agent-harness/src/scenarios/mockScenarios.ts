import { AgentLoop } from "../core/agentLoop.js";
import type { AgentContext, AgentState } from "../core/types.js";
import { MockLLM } from "../llm/MockLLM.js";
import { ToolRegistry } from "../tools/registry.js";
import { createNjuMatchReadTools } from "../tools/read/readTools.js";
import type { NjuMatchReadPort } from "../tools/read/port.js";
import { createNjuMatchActionTools } from "../tools/write/actionTools.js";
import { ConfirmationStore } from "../tools/write/confirmation.js";
import type { NjuMatchActionPort } from "../tools/write/port.js";
import { MemoryTracer, type TraceEvent } from "../tracing/tracer.js";

export type ScenarioName =
  | "confirmation" | "feedback" | "authorization"
  | "profile" | "questionnaire" | "circle-search" | "draft"
  | "join-without-confirmation" | "unknown-tool" | "malformed-action";
export interface ScenarioResult { readonly state: AgentState; readonly trace: readonly TraceEvent[]; readonly sideEffects: readonly string[]; }

const readPort: NjuMatchReadPort = {
  async getMyProfileStatus() { return { profileComplete: true, missingFields: [], profile: { nickname: "Demo", gender: "other", genderPreference: "any", intention: "friends", grade: "2026", campus: "Xianlin", department: "CS", mbti: null, bio: null, signature: null, tags: [] } }; },
  async getQuestionnaireStatus() { return { complete: true, currentVersion: "4.0", submittedVersion: "4.0", needsUpdate: false, submittedAt: "2026-08-01T00:00:00.000Z" }; },
  async searchCircles() { return { total: 1, circles: [{ id: "11111111-1111-4111-8111-111111111111", name: "AI Circle", description: "AI discussion", category: "study", tags: ["AI"], memberCount: 42, recommendationReasons: ["Matches AI"] }] }; },
  async searchForumPosts() { return { total: 0, posts: [] }; },
};

export async function runMockScenario(name: ScenarioName): Promise<ScenarioResult> {
  const sideEffects: string[] = [];
  const actionPort: NjuMatchActionPort = {
    async createPostDraft(_userId, input) { return { ...input, draftId: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-01T00:00:00.000Z" }; },
    async publishPost(userId) { sideEffects.push(`publish:${userId}`); return { postId: "post-1", url: "/forum/post-1" }; },
    async joinCircle(userId, input) { sideEffects.push(`join:${userId}:${input.circleId}`); return { circleId: input.circleId, status: "joined" }; },
  };
  const confirmations = new ConfirmationStore();
  const tools = new ToolRegistry([
    ...createNjuMatchReadTools(readPort), ...createNjuMatchActionTools(actionPort, confirmations),
  ]);
  let decisions: readonly unknown[];
  if (name === "feedback") decisions = [
    { type: "call_tool", tool: "search_forum_posts", arguments: { query: "AI" } },
    (context: AgentContext) => context.observations.at(-1)?.category === "NO_RESULTS"
      ? { type: "call_tool", tool: "search_circles", arguments: { query: "AI" } }
      : { type: "finish", summary: "Unexpected feedback." },
    { type: "finish", summary: "No post matched, so I suggested an AI circle." },
  ];
  else if (name === "authorization") decisions = [
    { type: "call_tool", tool: "get_my_profile", arguments: { userId: "victim-user" } },
    { type: "finish", summary: "The forged identity was rejected." },
  ];
  else if (name === "profile") decisions = [
    { type: "call_tool", tool: "get_my_profile", arguments: {} },
    { type: "finish", summary: "Profile is complete." },
  ];
  else if (name === "questionnaire") decisions = [
    { type: "call_tool", tool: "get_questionnaire_status", arguments: {} },
    { type: "finish", summary: "Questionnaire is current." },
  ];
  else if (name === "circle-search") decisions = [
    { type: "call_tool", tool: "search_circles", arguments: { query: "AI" } },
    { type: "finish", summary: "Found an AI circle." },
  ];
  else if (name === "draft") decisions = [
    { type: "call_tool", tool: "draft_forum_post", arguments: { title: "AI meetup", content: "Who wants to discuss agents?", type: "activity" } },
    { type: "finish", summary: "Draft prepared for review." },
  ];
  else if (name === "join-without-confirmation") decisions = [
    { type: "call_tool", tool: "join_circle", arguments: { circleId: "11111111-1111-4111-8111-111111111111", confirmationToken: "33333333-3333-4333-8333-333333333333" } },
    { type: "finish", summary: "Join was blocked until confirmation." },
  ];
  else if (name === "unknown-tool") decisions = [
    { type: "call_tool", tool: "delete_account", arguments: {} },
    { type: "finish", summary: "Unknown operation rejected." },
  ];
  else if (name === "malformed-action") decisions = [
    { type: "call_tool", tool: "search_circles", arguments: "AI" },
    { type: "finish", summary: "Malformed action rejected." },
  ];
  else decisions = [
    { type: "call_tool", tool: "publish_forum_post", arguments: { draftId: "22222222-2222-4222-8222-222222222222", confirmationToken: "33333333-3333-4333-8333-333333333333" } },
    { type: "finish", summary: "Publishing was blocked until the user confirms." },
  ];
  const tracer = new MemoryTracer();
  const state = await new AgentLoop({ llm: new MockLLM(decisions), tools, tracer }).run({
    runId: `scenario-${name}`, goal: name, userId: "authenticated-user",
  });
  return { state, trace: tracer.events, sideEffects };
}
