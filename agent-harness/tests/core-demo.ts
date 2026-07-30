import {
  AgentLoop,
  MemoryTracer,
  MockLLM,
  ToolRegistry,
  type AgentContext,
} from "../src/index.js";

const tools = new ToolRegistry([
  {
    name: "search_forum_posts",
    execute: async () => ({
      tool: "search_forum_posts",
      ok: false,
      category: "NO_RESULTS",
      summary: "No weekend badminton posts were found.",
      retryable: true,
    }),
  },
  {
    name: "search_circles",
    execute: async () => ({
      tool: "search_circles",
      ok: true,
      category: "SUCCESS",
      summary: "Found the Xianlin Badminton circle.",
      data: { circleId: "circle-badminton-xianlin" },
      retryable: false,
    }),
  },
]);

const llm = new MockLLM([
  {
    type: "call_tool",
    tool: "search_forum_posts",
    arguments: { query: "weekend badminton" },
  },
  (context: AgentContext) => {
    if (context.observations.at(-1)?.category !== "NO_RESULTS") {
      throw new Error("Expected NO_RESULTS feedback.");
    }
    return {
      type: "call_tool",
      tool: "search_circles",
      arguments: { query: "badminton", campus: "Xianlin" },
    };
  },
  {
    type: "finish",
    summary: "No matching post was found; one relevant circle was suggested.",
  },
]);

const tracer = new MemoryTracer();
const state = await new AgentLoop({ llm, tools, tracer }).run({
  runId: "demo-core-001",
  goal: "Find a weekend badminton activity in Xianlin.",
  userId: "demo-user",
});

console.log(JSON.stringify({ state, trace: tracer.events }, null, 2));
