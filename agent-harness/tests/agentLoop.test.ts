import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AgentLoop,
  MemoryTracer,
  MockLLM,
  ToolRegistry,
  type AgentContext,
  type Observation,
  type Tool,
} from "../src/index.js";

function tool(
  name: string,
  handler: Tool["execute"],
): Tool {
  return {
    name,
    execute: handler,
  };
}

const request = {
  runId: "run-001",
  goal: "Find a relevant circle.",
  userId: "authenticated-user",
};

describe("AgentLoop", () => {
  it("executes a tool, feeds back its observation, and finishes", async () => {
    const calls: string[] = [];
    const tools = new ToolRegistry([
      tool("search_circles", async (_args, context) => {
        calls.push(context.userId);
        return {
          tool: "search_circles",
          ok: true,
          category: "SUCCESS",
          summary: "Found one circle.",
          data: { ids: ["badminton-xianlin"] },
          retryable: false,
        };
      }),
    ]);
    const llm = new MockLLM([
      {
        type: "call_tool",
        tool: "search_circles",
        arguments: { query: "badminton" },
      },
      (context: AgentContext) => {
        assert.equal(context.observations[0]?.category, "SUCCESS");
        return {
          type: "finish",
          summary: "Found a badminton circle in Xianlin.",
        };
      },
    ]);
    const tracer = new MemoryTracer();
    const state = await new AgentLoop({ llm, tools, tracer }).run(request);

    assert.equal(state.status, "SUCCEEDED");
    assert.equal(state.step, 2);
    assert.equal(state.observations.length, 1);
    assert.deepEqual(calls, ["authenticated-user"]);
    assert.equal(tracer.events.length, 2);
  });

  it("returns parse feedback and lets the next decision recover", async () => {
    const llm = new MockLLM([
      { type: "call_tool", tool: "", arguments: {} },
      (context: AgentContext) => {
        assert.equal(
          context.observations[0]?.category,
          "INVALID_ARGUMENT",
        );
        return { type: "finish", summary: "Recovered from invalid output." };
      },
    ]);
    const state = await new AgentLoop({
      llm,
      tools: new ToolRegistry(),
      tracer: new MemoryTracer(),
    }).run(request);

    assert.equal(state.status, "SUCCEEDED");
    assert.equal(state.observations[0]?.tool, "harness.parse_action");
  });

  it("uses NO_RESULTS feedback to choose a different business tool", async () => {
    const calls: string[] = [];
    const noResults: Observation = {
      tool: "search_forum_posts",
      ok: false,
      category: "NO_RESULTS",
      summary: "No matching posts.",
      retryable: true,
    };
    const tools = new ToolRegistry([
      tool("search_forum_posts", async () => {
        calls.push("search_forum_posts");
        return noResults;
      }),
      tool("search_circles", async () => {
        calls.push("search_circles");
        return {
          tool: "search_circles",
          ok: true,
          category: "SUCCESS",
          summary: "Found a related circle.",
          retryable: false,
        };
      }),
    ]);
    const llm = new MockLLM([
      {
        type: "call_tool",
        tool: "search_forum_posts",
        arguments: { query: "weekend badminton" },
      },
      (context: AgentContext) => {
        assert.equal(context.observations[0]?.category, "NO_RESULTS");
        return {
          type: "call_tool",
          tool: "search_circles",
          arguments: { query: "badminton" },
        };
      },
      { type: "finish", summary: "Suggested a related circle instead." },
    ]);
    const state = await new AgentLoop({
      llm,
      tools,
      tracer: new MemoryTracer(),
    }).run(request);

    assert.equal(state.status, "SUCCEEDED");
    assert.deepEqual(calls, ["search_forum_posts", "search_circles"]);
  });

  it("stops deterministically at the maximum step count", async () => {
    const tools = new ToolRegistry([
      tool("empty_search", async () => ({
        tool: "empty_search",
        ok: false,
        category: "NO_RESULTS",
        summary: "No result.",
        retryable: true,
      })),
    ]);
    const llm = new MockLLM([
      { type: "call_tool", tool: "empty_search", arguments: { page: 1 } },
      { type: "call_tool", tool: "empty_search", arguments: { page: 2 } },
      { type: "call_tool", tool: "empty_search", arguments: { page: 3 } },
    ]);
    const state = await new AgentLoop({
      llm,
      tools,
      tracer: new MemoryTracer(),
      config: { maxSteps: 2, duplicateActionLimit: 10 },
    }).run(request);

    assert.equal(state.status, "BUDGET_EXCEEDED");
    assert.equal(state.step, 2);
    assert.match(state.stopReason ?? "", /Maximum step count/);
  });

  it("stops repeated identical actions", async () => {
    const repeated = {
      type: "call_tool",
      tool: "search_circles",
      arguments: { query: "same" },
    };
    const tools = new ToolRegistry([
      tool("search_circles", async () => ({
        tool: "search_circles",
        ok: false,
        category: "NO_RESULTS",
        summary: "No result.",
        retryable: true,
      })),
    ]);
    const state = await new AgentLoop({
      llm: new MockLLM([repeated, repeated]),
      tools,
      tracer: new MemoryTracer(),
      config: { maxSteps: 6, duplicateActionLimit: 1 },
    }).run(request);

    assert.equal(state.status, "BUDGET_EXCEEDED");
    assert.match(state.stopReason ?? "", /Duplicate action limit/);
  });

  it("turns an unknown tool into a non-retryable observation", async () => {
    const llm = new MockLLM([
      { type: "call_tool", tool: "unknown_tool", arguments: {} },
      { type: "finish", summary: "Reported the unavailable capability." },
    ]);
    const state = await new AgentLoop({
      llm,
      tools: new ToolRegistry(),
      tracer: new MemoryTracer(),
    }).run(request);

    assert.equal(state.status, "SUCCEEDED");
    assert.equal(state.observations[0]?.category, "NOT_FOUND");
    assert.equal(state.observations[0]?.retryable, false);
  });

  it("converts a tool timeout into retryable SERVICE_ERROR feedback", async () => {
    const tools = new ToolRegistry([
      tool(
        "slow_tool",
        async () =>
          new Promise<Observation>((resolve) => {
            setTimeout(() => {
              resolve({
                tool: "slow_tool",
                ok: true,
                category: "SUCCESS",
                summary: "Too late.",
                retryable: false,
              });
            }, 50);
          }),
      ),
    ]);
    const llm = new MockLLM([
      { type: "call_tool", tool: "slow_tool", arguments: {} },
      { type: "finish", summary: "Stopped after timeout." },
    ]);
    const state = await new AgentLoop({
      llm,
      tools,
      tracer: new MemoryTracer(),
      config: { toolTimeoutMs: 5 },
    }).run(request);

    assert.equal(state.status, "SUCCEEDED");
    assert.equal(state.observations[0]?.category, "SERVICE_ERROR");
    assert.equal(state.observations[0]?.retryable, true);
  });

  it("fails cleanly when the LLM port throws", async () => {
    const llm = new MockLLM([
      () => {
        throw new Error("Provider unavailable.");
      },
    ]);
    const state = await new AgentLoop({
      llm,
      tools: new ToolRegistry(),
      tracer: new MemoryTracer(),
    }).run(request);

    assert.equal(state.status, "FAILED");
    assert.equal(state.stopReason, "Provider unavailable.");
  });
});
