import { randomUUID } from "node:crypto";

export type ConfirmableAction = "publish_forum_post" | "join_circle";

interface ConfirmationRecord {
  readonly userId: string;
  readonly action: ConfirmableAction;
  readonly resourceId: string;
  readonly expiresAt: number;
}

export class ConfirmationStore {
  readonly #records = new Map<string, ConfirmationRecord>();
  readonly #ttlMs: number;

  public constructor(ttlMs = 5 * 60_000) {
    this.#ttlMs = ttlMs;
  }

  public issue(userId: string, action: ConfirmableAction, resourceId: string): string {
    const token = randomUUID();
    this.#records.set(token, {
      userId,
      action,
      resourceId,
      expiresAt: Date.now() + this.#ttlMs,
    });
    return token;
  }

  public consume(token: string, userId: string, action: ConfirmableAction, resourceId: string): boolean {
    const record = this.#records.get(token);
    this.#records.delete(token);
    return record !== undefined && record.expiresAt >= Date.now() &&
      record.userId === userId && record.action === action && record.resourceId === resourceId;
  }
}
