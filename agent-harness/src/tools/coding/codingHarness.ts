import { AgentLoop } from "../../core/agentLoop.js";
import type { AgentRunConfig, AgentState, RunRequest } from "../../core/types.js";
import type { LLMPort } from "../../llm/LLMPort.js";
import type { SessionMemory } from "../../memory/types.js";
import { ToolRegistry } from "../registry.js";
import { MemoryTracer, type TraceEvent } from "../../tracing/tracer.js";
import { CodingConfirmationStore, createCodingTools } from "./codingTools.js";
import { NodeCodingPort } from "./nodeCodingPort.js";

export interface CodingHarnessOptions {
  readonly root: string;
  readonly llm: LLMPort;
  readonly config?: Partial<AgentRunConfig>;
  readonly memory?: SessionMemory;
  readonly commandTimeoutMs?: number;
}

export interface CodingHarnessRunResult {
  readonly state: AgentState;
  readonly trace: readonly TraceEvent[];
}

export function createCodingHarness(options: CodingHarnessOptions) {
  const confirmations = new CodingConfirmationStore();
  const port = new NodeCodingPort(options.root, options.commandTimeoutMs);

  return {
    confirmations,
    async run(request: RunRequest): Promise<CodingHarnessRunResult> {
      const tracer = new MemoryTracer();
      const loop = new AgentLoop({
        llm: options.llm,
        tools: new ToolRegistry(createCodingTools(port, confirmations)),
        tracer,
        ...(options.config === undefined ? {} : { config: options.config }),
        ...(options.memory === undefined ? {} : { memory: options.memory }),
      });
      const state = await loop.run(request);
      return { state, trace: tracer.events };
    },
  };
}
