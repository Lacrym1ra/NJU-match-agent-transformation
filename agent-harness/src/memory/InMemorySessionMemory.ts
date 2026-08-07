import type { MemoryEntry, SessionMemory } from "./types.js";

export interface InMemorySessionMemoryOptions {
  readonly maxEntriesPerSession?: number;
  readonly maxSessions?: number;
}

function key(userId: string, sessionId: string): string {
  return `${userId}\u0000${sessionId}`;
}

export class InMemorySessionMemory implements SessionMemory {
  readonly #sessions = new Map<string, MemoryEntry[]>();
  readonly #maxEntriesPerSession: number;
  readonly #maxSessions: number;

  public constructor(options: InMemorySessionMemoryOptions = {}) {
    this.#maxEntriesPerSession = options.maxEntriesPerSession ?? 24;
    this.#maxSessions = options.maxSessions ?? 1_000;
    if (this.#maxEntriesPerSession < 1 || this.#maxSessions < 1) {
      throw new Error("Memory limits must be positive integers.");
    }
  }

  public async load(userId: string, sessionId: string): Promise<readonly MemoryEntry[]> {
    return [...(this.#sessions.get(key(userId, sessionId)) ?? [])];
  }

  public async append(userId: string, sessionId: string, entry: MemoryEntry): Promise<void> {
    const sessionKey = key(userId, sessionId);
    if (!this.#sessions.has(sessionKey) && this.#sessions.size >= this.#maxSessions) {
      const oldest = this.#sessions.keys().next().value as string | undefined;
      if (oldest !== undefined) this.#sessions.delete(oldest);
    }
    const entries = [...(this.#sessions.get(sessionKey) ?? []), entry]
      .slice(-this.#maxEntriesPerSession);
    this.#sessions.delete(sessionKey);
    this.#sessions.set(sessionKey, entries);
  }

  public async clear(userId: string, sessionId: string): Promise<void> {
    this.#sessions.delete(key(userId, sessionId));
  }
}
