import { ActionParseError, parseAction } from "../actions/parser.js";
import type { LLMPort } from "../llm/LLMPort.js";
import type { SessionMemory } from "../memory/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Tracer } from "../tracing/tracer.js";
import {
  initialState,
  reduceBudgetExceeded,
  reduceFailure,
  reduceFinish,
  reduceObservation,
} from "./reducer.js";
import { StopController } from "./stopController.js";
import type {
  AgentContext,
  AgentRunConfig,
  AgentState,
  Observation,
  RunRequest,
} from "./types.js";

export const DEFAULT_RUN_CONFIG: AgentRunConfig = {
  maxSteps: 6,
  toolTimeoutMs: 10_000,
  duplicateActionLimit: 2,
};

export interface AgentLoopDependencies {
  readonly llm: LLMPort;
  readonly tools: ToolRegistry;
  readonly tracer: Tracer;
  readonly memory?: SessionMemory;
  readonly config?: Partial<AgentRunConfig>;
}

function invalidActionObservation(error: ActionParseError): Observation {
  return {
    tool: "harness.parse_action",
    ok: false,
    category: "INVALID_ARGUMENT",
    summary: error.message,
    retryable: true,
  };
}

export class AgentLoop {
  readonly #llm: LLMPort;
  readonly #tools: ToolRegistry;
  readonly #tracer: Tracer;
  readonly #memory: SessionMemory | undefined;
  readonly #config: AgentRunConfig;

  public constructor(dependencies: AgentLoopDependencies) {
    this.#llm = dependencies.llm;
    this.#tools = dependencies.tools;
    this.#tracer = dependencies.tracer;
    this.#memory = dependencies.memory;
    this.#config = {
      ...DEFAULT_RUN_CONFIG,
      ...dependencies.config,
    };
  }

  public async run(request: RunRequest): Promise<AgentState> {
    let state = initialState(request.runId);
    const stopController = new StopController(this.#config);
    const sessionId = request.sessionId ?? request.runId;
    const memory = this.#memory === undefined
      ? []
      : await this.#memory.load(request.userId, sessionId);

    await this.#memory?.append(request.userId, sessionId, {
      kind: "user_goal",
      content: request.goal,
      createdAt: new Date().toISOString(),
    });

    while (state.status === "RUNNING") {
      state = stopController.beforeDecision(state);
      if (state.status !== "RUNNING") {
        break;
      }

      const context: AgentContext = {
        runId: request.runId,
        goal: request.goal,
        step: state.step,
        maxSteps: this.#config.maxSteps,
        observations: state.observations,
        memory,
        availableTools: this.#tools.names(),
        ...(request.context === undefined ? {} : { inputContext: request.context }),
      };

      let rawAction: unknown;
      try {
        rawAction = await this.#llm.decide(context);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "LLM decision failed.";
        state = reduceFailure(state, message);
        break;
      }

      try {
        const action = parseAction(rawAction);
        state = stopController.afterAction(state, action);
        if (state.status !== "RUNNING") {
          this.#tracer.record({
            runId: request.runId,
            step: state.step,
            action,
          });
          break;
        }

        if (action.type === "finish") {
          this.#tracer.record({
            runId: request.runId,
            step: state.step,
            action,
          });
          state = reduceFinish(state, action);
          continue;
        }

        const observation = await this.#tools.execute(
          action.tool,
          action.arguments,
          {
            runId: request.runId,
            userId: request.userId,
          },
          this.#config.toolTimeoutMs,
        );

        this.#tracer.record({
          runId: request.runId,
          step: state.step,
          action,
          observation,
        });
        state = reduceObservation(state, observation);
        await this.#memory?.append(request.userId, sessionId, {
          kind: "observation",
          content: JSON.stringify({
            tool: observation.tool,
            category: observation.category,
            summary: observation.summary,
          }),
          createdAt: new Date().toISOString(),
        });
      } catch (error: unknown) {
        if (!(error instanceof ActionParseError)) {
          state = reduceFailure(state, "Unexpected action processing failure.");
          break;
        }

        const observation = invalidActionObservation(error);
        this.#tracer.record({
          runId: request.runId,
          step: state.step,
          rawAction,
          observation,
        });
        state = reduceObservation(state, observation);
      }
    }

    if (state.status === "RUNNING") {
      return reduceBudgetExceeded(state, "Agent stopped without a final state.");
    }

    if (state.finalSummary) {
      await this.#memory?.append(request.userId, sessionId, {
        kind: "assistant_summary",
        content: state.finalSummary,
        createdAt: new Date().toISOString(),
      });
    }

    return state;
  }
}
