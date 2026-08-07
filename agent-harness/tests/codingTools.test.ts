import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AgentLoop } from "../src/core/agentLoop.js";
import type { AgentContext } from "../src/core/types.js";
import { MockLLM } from "../src/llm/MockLLM.js";
import {
  CodingConfirmationStore,
  createCodingTools,
  type CodingPort,
} from "../src/tools/coding/codingTools.js";
import { createCodingHarness } from "../src/tools/coding/codingHarness.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { MemoryTracer } from "../src/tracing/tracer.js";

function fixture() {
  const effects: string[] = [];
  let testExitCode = 1;
  const port: CodingPort = {
    async readFile(path) { effects.push(`read:${path}`); return "export const answer = 41;"; },
    async writeFile(path) { effects.push(`write:${path}`); },
    async runCommand(command, args) {
      effects.push(`command:${command} ${args.join(" ")}`);
      const exitCode = testExitCode;
      testExitCode = 0;
      return { exitCode, stdout: exitCode === 0 ? "tests passed" : "", stderr: exitCode === 0 ? "" : "1 test failed" };
    },
  };
  return { effects, port };
}

test("coding guardrail blocks destructive shell commands before the port sees them", async () => {
  const { effects, port } = fixture();
  const tools = new ToolRegistry(createCodingTools(port, new CodingConfirmationStore()));
  const result = await tools.execute("run_command", {
    command: "rm", args: ["-rf", "/"], confirmationToken: "11111111-1111-4111-8111-111111111111",
  }, { runId: "run-1", userId: "user-1" }, 1_000);

  assert.equal(result.category, "POLICY_DENIED");
  assert.deepEqual(effects, []);
});

test("coding path guard rejects traversal and credential-like files before reading", async () => {
  const { effects, port } = fixture();
  const tools = new ToolRegistry(createCodingTools(port, new CodingConfirmationStore()));
  const traversal = await tools.execute("read_file", { path: "../outside.txt" },
    { runId: "run-path-1", userId: "user-1" }, 1_000);
  const credential = await tools.execute("read_file", { path: ".env" },
    { runId: "run-path-2", userId: "user-1" }, 1_000);

  assert.equal(traversal.category, "INVALID_ARGUMENT");
  assert.equal(credential.category, "INVALID_ARGUMENT");
  assert.deepEqual(effects, []);
});

test("test sensor feeds deterministic failure back and Mock LLM changes its next action", async () => {
  const { effects, port } = fixture();
  const tracer = new MemoryTracer();
  const loop = new AgentLoop({
    llm: new MockLLM([
      { type: "call_tool", tool: "run_tests", arguments: { script: "test" } },
      (context: AgentContext) => context.observations.at(-1)?.category === "VALIDATION_FAILED"
        ? { type: "call_tool", tool: "read_file", arguments: { path: "src/answer.ts" } }
        : { type: "finish", summary: "Unexpected feedback." },
      { type: "finish", summary: "The failing test was inspected before changing code." },
    ]),
    tools: new ToolRegistry(createCodingTools(port, new CodingConfirmationStore())),
    tracer,
  });

  const state = await loop.run({ runId: "run-2", userId: "user-1", goal: "fix tests" });
  assert.equal(state.status, "SUCCEEDED");
  assert.deepEqual(state.observations.map((item) => item.category), ["VALIDATION_FAILED", "SUCCESS"]);
  assert.deepEqual(effects, ["command:npm test", "read:src/answer.ts"]);
});

test("write_file requires a user-bound, path-bound, single-use confirmation", async () => {
  const { effects, port } = fixture();
  const confirmations = new CodingConfirmationStore();
  const tools = new ToolRegistry(createCodingTools(port, confirmations));
  const token = confirmations.issue("user-1", "write_file", "src/answer.ts");

  const accepted = await tools.execute("write_file", {
    path: "src/answer.ts", content: "export const answer = 42;", confirmationToken: token,
  }, { runId: "run-3", userId: "user-1" }, 1_000);
  const replay = await tools.execute("write_file", {
    path: "src/answer.ts", content: "export const answer = 0;", confirmationToken: token,
  }, { runId: "run-4", userId: "user-1" }, 1_000);

  assert.equal(accepted.category, "SUCCESS");
  assert.equal(replay.category, "POLICY_DENIED");
  assert.deepEqual(effects, ["write:src/answer.ts"]);
});

test("coding harness factory runs the real workspace adapter through AgentLoop", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nju-coding-harness-"));
  try {
    await writeFile(path.join(root, "answer.ts"), "export const answer = 42;", "utf8");
    const harness = createCodingHarness({
      root,
      llm: new MockLLM([
        { type: "call_tool", tool: "read_file", arguments: { path: "answer.ts" } },
        { type: "finish", summary: "Inspected the workspace file." },
      ]),
    });
    const result = await harness.run({ runId: "factory-run", userId: "developer", goal: "inspect answer" });
    assert.equal(result.state.status, "SUCCEEDED");
    assert.equal(result.state.observations[0]?.category, "SUCCESS");
    assert.match(JSON.stringify(result.state.observations[0]?.data), /answer = 42/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
