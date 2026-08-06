import assert from "node:assert/strict";
import test from "node:test";
import { ConfirmationStore, createNjuMatchActionTools } from "../src/index.js";
import type { NjuMatchActionPort, PostDraftInput } from "../src/index.js";

const userId = "user-1";
const draftId = "11111111-1111-4111-8111-111111111111";
const circleId = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const calls: string[] = [];
  const port: NjuMatchActionPort = {
    async createPostDraft(identity: string, input: PostDraftInput) {
      calls.push(`draft:${identity}`);
      return { ...input, draftId, createdAt: "2026-08-01T00:00:00.000Z" };
    },
    async publishPost(identity: string, id: string) {
      calls.push(`publish:${identity}:${id}`);
      return { postId: "post-1", url: "/forum/post-1" };
    },
    async joinCircle(identity: string, input) {
      calls.push(`join:${identity}:${input.circleId}`);
      return { circleId: input.circleId, status: "joined" };
    },
  };
  const confirmations = new ConfirmationStore();
  const tools = createNjuMatchActionTools(port, confirmations);
  const byName = (name: string) => tools.find((tool) => tool.name === name)!;
  const context = { runId: "run-1", userId };
  return { calls, confirmations, byName, context };
}

test("drafting is side-effect free and requests confirmation", async () => {
  const { calls, byName, context } = fixture();
  const result = await byName("draft_forum_post").execute({
    title: "Study partners", content: "Looking for a weekly study group.", type: "squad",
  }, context);
  assert.equal(result.ok, true);
  assert.equal((result.data as { requiresConfirmation: boolean }).requiresConfirmation, true);
  assert.deepEqual(calls, ["draft:user-1"]);
});

test("publishing without confirmation is denied", async () => {
  const { calls, byName, context } = fixture();
  const result = await byName("publish_forum_post").execute({
    draftId, confirmationToken: "33333333-3333-4333-8333-333333333333",
  }, context);
  assert.equal(result.category, "POLICY_DENIED");
  assert.deepEqual(calls, []);
});

test("confirmed publish executes once for the authenticated user", async () => {
  const { calls, confirmations, byName, context } = fixture();
  const token = confirmations.issue(userId, "publish_forum_post", draftId);
  const args = { draftId, confirmationToken: token };
  assert.equal((await byName("publish_forum_post").execute(args, context)).ok, true);
  assert.equal((await byName("publish_forum_post").execute(args, context)).category, "POLICY_DENIED");
  assert.deepEqual(calls, [`publish:${userId}:${draftId}`]);
});

test("confirmation is bound to the user and resource", async () => {
  const { confirmations, byName, context } = fixture();
  const token = confirmations.issue("another-user", "join_circle", circleId);
  const result = await byName("join_circle").execute({ circleId, confirmationToken: token }, context);
  assert.equal(result.category, "POLICY_DENIED");
});

test("confirmed optional circle join executes", async () => {
  const { calls, confirmations, byName, context } = fixture();
  const token = confirmations.issue(userId, "join_circle", circleId);
  const result = await byName("join_circle").execute({
    circleId, applicationReason: "Interested in AI", confirmationToken: token,
  }, context);
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [`join:${userId}:${circleId}`]);
});
