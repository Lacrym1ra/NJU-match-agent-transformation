import { mkdir, writeFile } from "node:fs/promises";
import { runMockScenario, type ScenarioName } from "../src/scenarios/mockScenarios.js";

const name = process.argv[2] as ScenarioName | undefined;
if (!name || !["confirmation", "feedback", "authorization"].includes(name)) {
  throw new Error("Expected scenario: confirmation, feedback, or authorization");
}
const result = await runMockScenario(name);
await mkdir(".agent-traces", { recursive: true });
await writeFile(`.agent-traces/${name}.json`, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`${name}: ${result.state.status}; observations=${result.state.observations.map((item) => item.category).join(",")}`);
