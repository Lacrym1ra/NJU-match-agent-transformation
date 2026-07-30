export const AGENT_STATUSES = [
  "RUNNING",
  "WAITING_CONFIRMATION",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "BUDGET_EXCEEDED",
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type ObservationCategory =
  | "SUCCESS"
  | "INVALID_ARGUMENT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NO_RESULTS"
  | "POLICY_DENIED"
  | "SERVICE_ERROR";

export interface Observation {
  readonly tool: string;
  readonly ok: boolean;
  readonly category: ObservationCategory;
  readonly summary: string;
  readonly data?: unknown;
  readonly retryable: boolean;
}

export interface CallToolAction {
  readonly type: "call_tool";
  readonly tool: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface FinishAction {
  readonly type: "finish";
  readonly summary: string;
}

export type AgentAction = CallToolAction | FinishAction;

export interface AgentState {
  readonly runId: string;
  readonly status: AgentStatus;
  readonly step: number;
  readonly observations: readonly Observation[];
  readonly finalSummary?: string;
  readonly stopReason?: string;
}

export interface AgentContext {
  readonly runId: string;
  readonly goal: string;
  readonly step: number;
  readonly maxSteps: number;
  readonly observations: readonly Observation[];
  readonly availableTools: readonly string[];
}

export interface AgentRunConfig {
  readonly maxSteps: number;
  readonly toolTimeoutMs: number;
  readonly duplicateActionLimit: number;
}

export interface RunRequest {
  readonly runId: string;
  readonly goal: string;
  readonly userId: string;
}
