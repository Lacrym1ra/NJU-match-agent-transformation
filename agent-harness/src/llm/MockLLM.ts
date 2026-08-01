import type { AgentContext } from "../core/types.js";
import type { LLMPort } from "./LLMPort.js";

export type MockDecision =
  | unknown
  | ((context: AgentContext) => unknown | Promise<unknown>);

export class MockLLM implements LLMPort {
  readonly #decisions: readonly MockDecision[];
  readonly #contexts: AgentContext[] = [];
  #cursor = 0;

  public constructor(decisions: readonly MockDecision[]) {
    this.#decisions = decisions;
  }

  public get contexts(): readonly AgentContext[] {
    return this.#contexts;
  }

  public async decide(context: AgentContext): Promise<unknown> {
    this.#contexts.push(context);
    const decision = this.#decisions[this.#cursor];
    this.#cursor += 1;

    if (decision === undefined) {
      throw new Error("MockLLM has no decision for this step.");
    }

    if (typeof decision === "function") {
      return decision(context);
    }

    return decision;
  }
}
