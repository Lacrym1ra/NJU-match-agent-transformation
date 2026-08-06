import assert from "node:assert/strict";
import test from "node:test";
import { runMockScenario } from "../src/scenarios/mockScenarios.js";

test("Mock LLM changes strategy after NO_RESULTS feedback", async () => {
  const result = await runMockScenario("feedback");
  assert.equal(result.state.status, "SUCCEEDED");
  assert.deepEqual(result.state.observations.map((item) => item.category), ["NO_RESULTS", "SUCCESS"]);
  assert.equal(result.trace[1]?.action?.type, "call_tool");
});

test("Mock LLM cannot publish without explicit confirmation", async () => {
  const result = await runMockScenario("confirmation");
  assert.equal(result.state.observations[0]?.category, "POLICY_DENIED");
  assert.deepEqual(result.sideEffects, []);
});

test("Mock LLM cannot forge the authenticated identity", async () => {
  const result = await runMockScenario("authorization");
  assert.equal(result.state.observations[0]?.category, "INVALID_ARGUMENT");
  assert.deepEqual(result.sideEffects, []);
});

const singleToolScenarios = [
  ["profile", "SUCCESS"],
  ["questionnaire", "SUCCESS"],
  ["circle-search", "SUCCESS"],
  ["draft", "SUCCESS"],
  ["join-without-confirmation", "POLICY_DENIED"],
  ["unknown-tool", "NOT_FOUND"],
  ["malformed-action", "INVALID_ARGUMENT"],
] as const;

for (const [scenario, category] of singleToolScenarios) {
  test(`Mock LLM scenario ${scenario} returns ${category}`, async () => {
    const result = await runMockScenario(scenario);
    assert.equal(result.state.status, "SUCCEEDED");
    assert.equal(result.state.observations[0]?.category, category);
    assert.deepEqual(result.sideEffects, []);
  });
}
