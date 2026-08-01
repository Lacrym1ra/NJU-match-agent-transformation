import type {
  AgentAction,
  AgentRunConfig,
  AgentState,
} from "./types.js";
import { reduceBudgetExceeded } from "./reducer.js";

function actionKey(action: AgentAction): string {
  if (action.type === "finish") {
    return `finish:${action.summary}`;
  }

  return `tool:${action.tool}:${JSON.stringify(action.arguments)}`;
}

export class StopController {
  readonly #config: AgentRunConfig;
  readonly #actionCounts = new Map<string, number>();

  public constructor(config: AgentRunConfig) {
    this.#config = config;
  }

  public beforeDecision(state: AgentState): AgentState {
    if (state.step >= this.#config.maxSteps) {
      return reduceBudgetExceeded(
        state,
        `Maximum step count reached: ${this.#config.maxSteps}`,
      );
    }

    return state;
  }

  public afterAction(state: AgentState, action: AgentAction): AgentState {
    const key = actionKey(action);
    const count = (this.#actionCounts.get(key) ?? 0) + 1;
    this.#actionCounts.set(key, count);

    if (count > this.#config.duplicateActionLimit) {
      return reduceBudgetExceeded(
        state,
        `Duplicate action limit reached for ${action.type}.`,
      );
    }

    return state;
  }
}
