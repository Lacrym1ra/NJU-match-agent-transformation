import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AgentLoop, InMemorySessionMemory, MemoryTracer, MockLLM, ToolRegistry,
  type AgentContext,
} from "../src/index.js";

test("session memory is isolated by authenticated user and available on a later run", async () => {
  const memory = new InMemorySessionMemory({ maxEntriesPerSession: 4 });
  const first = new AgentLoop({
    llm: new MockLLM([{ type: "finish", summary: "first answer" }]),
    tools: new ToolRegistry(), tracer: new MemoryTracer(), memory,
  });
  await first.run({ runId: "run-1", sessionId: "session", userId: "user-1", goal: "first goal" });

  let remembered = "";
  const second = new AgentLoop({
    llm: new MockLLM([(context: AgentContext) => {
      remembered = context.memory.map((entry) => entry.content).join("|");
      return { type: "finish", summary: "second answer" };
    }]),
    tools: new ToolRegistry(), tracer: new MemoryTracer(), memory,
  });
  await second.run({ runId: "run-2", sessionId: "session", userId: "user-1", goal: "second goal" });

  assert.match(remembered, /first goal/);
  assert.match(remembered, /first answer/);
  assert.deepEqual(await memory.load("user-2", "session"), []);
});

test("session memory keeps only the configured number of recent entries", async () => {
  const memory = new InMemorySessionMemory({ maxEntriesPerSession: 2 });
  for (const content of ["one", "two", "three"]) {
    await memory.append("user", "session", {
      kind: "user_goal", content, createdAt: "2026-08-07T00:00:00.000Z",
    });
  }
  assert.deepEqual((await memory.load("user", "session")).map((entry) => entry.content), ["two", "three"]);
});
