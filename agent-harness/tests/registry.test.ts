import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ToolRegistry } from "../src/index.js";

describe("ToolRegistry", () => {
  it("rejects duplicate tool names", () => {
    const duplicate = {
      name: "search_circles",
      execute: async () => ({
        tool: "search_circles",
        ok: true,
        category: "SUCCESS" as const,
        summary: "ok",
        retryable: false,
      }),
    };

    assert.throws(
      () => new ToolRegistry([duplicate, duplicate]),
      /Tool already registered/,
    );
  });

  it("normalizes thrown tool errors", async () => {
    const registry = new ToolRegistry([
      {
        name: "broken_tool",
        execute: async () => {
          throw new Error("Database unavailable.");
        },
      },
    ]);
    const observation = await registry.execute(
      "broken_tool",
      {},
      { runId: "run-001", userId: "user-001" },
      100,
    );

    assert.equal(observation.ok, false);
    assert.equal(observation.category, "SERVICE_ERROR");
    assert.equal(observation.summary, "Database unavailable.");
    assert.equal(observation.retryable, true);
  });
});
