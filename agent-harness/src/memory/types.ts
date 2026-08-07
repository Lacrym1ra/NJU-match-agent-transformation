export type MemoryEntryKind = "user_goal" | "observation" | "assistant_summary";

export interface MemoryEntry {
  readonly kind: MemoryEntryKind;
  readonly content: string;
  readonly createdAt: string;
}

export interface SessionMemory {
  load(userId: string, sessionId: string): Promise<readonly MemoryEntry[]>;
  append(userId: string, sessionId: string, entry: MemoryEntry): Promise<void>;
  clear(userId: string, sessionId: string): Promise<void>;
}
