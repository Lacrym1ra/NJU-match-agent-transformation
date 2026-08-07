import assert from "node:assert/strict";
import { test } from "node:test";
import { loadHarnessConfig } from "../src/index.js";

test("declarative harness config applies bounded defaults", () => {
  assert.deepEqual(loadHarnessConfig({ maxSteps: 4 }), {
    maxSteps: 4, toolTimeoutMs: 10_000, duplicateActionLimit: 2,
  });
});

test("declarative harness config rejects unsafe budgets", () => {
  assert.throws(() => loadHarnessConfig({ maxSteps: 100 }), /Too big/);
  assert.throws(() => loadHarnessConfig({ toolTimeoutMs: 0 }), /Too small/);
});
