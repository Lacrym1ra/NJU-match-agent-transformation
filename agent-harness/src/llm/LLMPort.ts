import type { AgentContext } from "../core/types.js";

export interface LLMPort {
  decide(context: AgentContext): Promise<unknown>;
}
