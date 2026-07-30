import type { AgentAction, Observation } from "../core/types.js";

export interface TraceEvent {
  readonly runId: string;
  readonly step: number;
  readonly action?: AgentAction;
  readonly rawAction?: unknown;
  readonly observation?: Observation;
}

export interface Tracer {
  record(event: TraceEvent): void;
}

export class MemoryTracer implements Tracer {
  readonly #events: TraceEvent[] = [];

  public get events(): readonly TraceEvent[] {
    return this.#events;
  }

  public record(event: TraceEvent): void {
    this.#events.push(structuredClone(event));
  }
}
