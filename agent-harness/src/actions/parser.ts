import type { AgentAction } from "../core/types.js";

export class ActionParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ActionParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAction(value: unknown): AgentAction {
  if (!isRecord(value)) {
    throw new ActionParseError("Action must be an object.");
  }

  if (value.type === "finish") {
    if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
      throw new ActionParseError("Finish action requires a non-empty summary.");
    }

    return {
      type: "finish",
      summary: value.summary.trim(),
    };
  }

  if (value.type === "call_tool") {
    if (typeof value.tool !== "string" || value.tool.trim().length === 0) {
      throw new ActionParseError("Tool action requires a non-empty tool name.");
    }

    if (!isRecord(value.arguments)) {
      throw new ActionParseError("Tool action arguments must be an object.");
    }

    return {
      type: "call_tool",
      tool: value.tool,
      arguments: value.arguments,
    };
  }

  throw new ActionParseError("Unknown action type.");
}
