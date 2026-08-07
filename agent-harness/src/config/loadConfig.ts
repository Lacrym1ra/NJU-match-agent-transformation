import { z } from "zod";
import type { AgentRunConfig } from "../core/types.js";

const configSchema = z.object({
  maxSteps: z.number().int().min(1).max(20).default(6),
  toolTimeoutMs: z.number().int().min(100).max(60_000).default(10_000),
  duplicateActionLimit: z.number().int().min(1).max(10).default(2),
}).strict();

export type HarnessConfigSource = Partial<Record<keyof AgentRunConfig, unknown>>;

export function loadHarnessConfig(source: HarnessConfigSource): AgentRunConfig {
  return configSchema.parse(source);
}
