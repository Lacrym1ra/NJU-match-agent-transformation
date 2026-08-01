import type { Observation } from "../core/types.js";

export interface ToolContext {
  readonly runId: string;
  readonly userId: string;
}

export interface Tool {
  readonly name: string;
  execute(
    args: Readonly<Record<string, unknown>>,
    context: ToolContext,
  ): Promise<Observation>;
}
