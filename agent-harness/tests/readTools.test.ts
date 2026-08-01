import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AgentLoop,
  createNjuMatchReadTools,
  MemoryTracer,
  MockLLM,
  ToolRegistry,
  type AgentContext,
  type CircleSearchInput,
  type ForumSearchInput,
  type NjuMatchReadPort,
} from "../src/index.js";

function createPort(overrides: Partial<NjuMatchReadPort> = {}): NjuMatchReadPort {
  return {
    async getMyProfileStatus() {
      return {
        profileComplete: false,
        missingFields: ["campus"],
        profile: {
          nickname: "Test User",
          gender: "female",
          genderPreference: "any",
          intention: "friend",
          grade: "2024",
          campus: null,
          department: "Computer Science",
          mbti: null,
          bio: null,
          signature: null,
          tags: ["badminton"],
        },
      };
    },
    async getQuestionnaireStatus() {
      return {
        complete: true,
        currentVersion: "4.0",
        submittedVersion: "4.0",
        needsUpdate: false,
        submittedAt: "2026-08-01T00:00:00.000Z",
      };
    },
    async searchCircles() {
      return {
        total: 1,
        circles: [
          {
            id: "circle-001",
            name: "Xianlin Badminton",
            description: "A badminton circle.",
            category: "sports",
            tags: ["badminton"],
            memberCount: 12,
            recommendationReasons: ["Matching interest tag"],
          },
        ],
      };
    },
    async searchForumPosts() {
      return {
        total: 1,
        posts: [
          {
            postId: "post-001",
            circleId: null,
            title: "Weekend badminton",
            type: "activity",
            summary: "Looking for players.",
            likeCount: 2,
            commentCount: 3,
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      };
    },
    ...overrides,
  };
}

const toolContext = {
  runId: "run-read-tools",
  userId: "authenticated-user",
};

describe("NJU-Match read tools", () => {
  it("registers exactly the four MVP read tools", () => {
    const registry = new ToolRegistry(createNjuMatchReadTools(createPort()));

    assert.deepEqual(registry.names(), [
      "get_my_profile",
      "get_questionnaire_status",
      "search_circles",
      "search_forum_posts",
    ]);
  });

  it("gets only the authenticated user's profile status", async () => {
    const seenUserIds: string[] = [];
    const port = createPort({
      async getMyProfileStatus(userId) {
        seenUserIds.push(userId);
        return createPort().getMyProfileStatus(userId);
      },
    });
    const registry = new ToolRegistry(createNjuMatchReadTools(port));
    const observation = await registry.execute(
      "get_my_profile",
      {},
      toolContext,
      100,
    );

    assert.equal(observation.category, "SUCCESS");
    assert.deepEqual(seenUserIds, ["authenticated-user"]);
    assert.deepEqual(
      (observation.data as { missingFields: string[] }).missingFields,
      ["campus"],
    );
  });

  it("rejects a model-supplied userId", async () => {
    let called = false;
    const port = createPort({
      async getMyProfileStatus(userId) {
        called = true;
        return createPort().getMyProfileStatus(userId);
      },
    });
    const registry = new ToolRegistry(createNjuMatchReadTools(port));
    const observation = await registry.execute(
      "get_my_profile",
      { userId: "forged-user" },
      toolContext,
      100,
    );

    assert.equal(observation.category, "INVALID_ARGUMENT");
    assert.equal(called, false);
  });

  it("returns current questionnaire status without exposing answers", async () => {
    const registry = new ToolRegistry(createNjuMatchReadTools(createPort()));
    const observation = await registry.execute(
      "get_questionnaire_status",
      {},
      toolContext,
      100,
    );
    const data = observation.data as Record<string, unknown>;

    assert.equal(observation.category, "SUCCESS");
    assert.equal(data.currentVersion, "4.0");
    assert.equal("answers" in data, false);
  });

  it("applies defaults and limits to circle search", async () => {
    let received: CircleSearchInput | undefined;
    const port = createPort({
      async searchCircles(_userId, input) {
        received = input;
        return { total: 0, circles: [] };
      },
    });
    const registry = new ToolRegistry(createNjuMatchReadTools(port));
    const observation = await registry.execute(
      "search_circles",
      { query: "badminton" },
      toolContext,
      100,
    );

    assert.equal(observation.category, "NO_RESULTS");
    assert.equal(observation.retryable, true);
    assert.equal(received?.limit, 5);
    assert.equal(received?.sort, "recommended");
  });

  it("rejects an oversized forum search limit before calling the port", async () => {
    let called = false;
    const port = createPort({
      async searchForumPosts() {
        called = true;
        return { total: 0, posts: [] };
      },
    });
    const registry = new ToolRegistry(createNjuMatchReadTools(port));
    const observation = await registry.execute(
      "search_forum_posts",
      { query: "badminton", limit: 50 },
      toolContext,
      100,
    );

    assert.equal(observation.category, "INVALID_ARGUMENT");
    assert.equal(called, false);
  });

  it("passes safe forum filters and the authenticated identity", async () => {
    let receivedUserId = "";
    let received: ForumSearchInput | undefined;
    const port = createPort({
      async searchForumPosts(userId, input) {
        receivedUserId = userId;
        received = input;
        return { total: 0, posts: [] };
      },
    });
    const registry = new ToolRegistry(createNjuMatchReadTools(port));
    const circleId = "216d8f3d-1da8-4d67-bf98-e4265ec26f31";
    await registry.execute(
      "search_forum_posts",
      {
        query: "weekend badminton",
        circleId,
        type: "activity",
        sort: "hot",
        limit: 3,
      },
      toolContext,
      100,
    );

    assert.equal(receivedUserId, "authenticated-user");
    assert.deepEqual(received, {
      query: "weekend badminton",
      circleId,
      type: "activity",
      sort: "hot",
      limit: 3,
    });
  });

  it("converts an invalid backend payload into SERVICE_ERROR", async () => {
    const port = createPort({
      async searchCircles() {
        return {
          total: 1,
          circles: [
            {
              id: "circle-001",
              name: "Unsafe",
              description: "Invalid negative count.",
              category: "sports",
              tags: [],
              memberCount: -1,
              recommendationReasons: [],
            },
          ],
        };
      },
    });
    const registry = new ToolRegistry(createNjuMatchReadTools(port));
    const observation = await registry.execute(
      "search_circles",
      { query: "badminton" },
      toolContext,
      100,
    );

    assert.equal(observation.category, "SERVICE_ERROR");
    assert.equal(observation.retryable, true);
  });

  it("runs the read tools through the real AgentLoop feedback path", async () => {
    const tools = new ToolRegistry(createNjuMatchReadTools(createPort()));
    const llm = new MockLLM([
      { type: "call_tool", tool: "get_my_profile", arguments: {} },
      (context: AgentContext) => {
        assert.equal(context.observations[0]?.category, "SUCCESS");
        return {
          type: "call_tool",
          tool: "search_circles",
          arguments: { query: "badminton", limit: 3 },
        };
      },
      (context: AgentContext) => {
        assert.equal(context.observations[1]?.tool, "search_circles");
        return { type: "finish", summary: "Found a relevant circle." };
      },
    ]);
    const state = await new AgentLoop({
      llm,
      tools,
      tracer: new MemoryTracer(),
    }).run({
      runId: "read-tools-loop",
      goal: "Find a circle based on my profile.",
      userId: "authenticated-user",
    });

    assert.equal(state.status, "SUCCEEDED");
    assert.equal(state.step, 3);
    assert.equal(state.observations.length, 2);
  });
});
