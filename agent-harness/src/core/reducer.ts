import type {
  AgentAction,
  AgentState,
  Observation,
} from "./types.js";

export function initialState(runId: string): AgentState {
  return {
    runId,
    status: "RUNNING",
    step: 0,
    observations: [],
  };
}

export function reduceObservation(
  state: AgentState,
  observation: Observation,
): AgentState {
  if (state.status !== "RUNNING") {
    throw new Error(`Cannot add an observation while ${state.status}.`);
  }

  return {
    ...state,
    step: state.step + 1,
    observations: [...state.observations, observation],
  };
}

export function reduceFinish(
  state: AgentState,
  action: AgentAction,
): AgentState {
  if (state.status !== "RUNNING" || action.type !== "finish") {
    throw new Error("Only a running agent can apply a finish action.");
  }

  return {
    ...state,
    step: state.step + 1,
    status: "SUCCEEDED",
    finalSummary: action.summary,
  };
}

export function reduceBudgetExceeded(
  state: AgentState,
  reason: string,
): AgentState {
  if (state.status !== "RUNNING") {
    return state;
  }

  return {
    ...state,
    status: "BUDGET_EXCEEDED",
    stopReason: reason,
  };
}

export function reduceFailure(
  state: AgentState,
  reason: string,
): AgentState {
  if (state.status !== "RUNNING") {
    return state;
  }

  return {
    ...state,
    status: "FAILED",
    stopReason: reason,
  };
}
