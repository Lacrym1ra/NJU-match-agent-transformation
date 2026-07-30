import type { Observation } from "../core/types.js";
import type { Tool, ToolContext } from "./types.js";

export class ToolRegistry {
  readonly #tools = new Map<string, Tool>();

  public constructor(tools: readonly Tool[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  public register(tool: Tool): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    this.#tools.set(tool.name, tool);
  }

  public names(): readonly string[] {
    return [...this.#tools.keys()].sort();
  }

  public async execute(
    name: string,
    args: Readonly<Record<string, unknown>>,
    context: ToolContext,
    timeoutMs: number,
  ): Promise<Observation> {
    const tool = this.#tools.get(name);
    if (tool === undefined) {
      return {
        tool: name,
        ok: false,
        category: "NOT_FOUND",
        summary: `Tool is not registered: ${name}`,
        retryable: false,
      };
    }

    let timeout: NodeJS.Timeout | undefined;
    const timeoutResult = new Promise<Observation>((resolve) => {
      timeout = setTimeout(() => {
        resolve({
          tool: name,
          ok: false,
          category: "SERVICE_ERROR",
          summary: `Tool timed out after ${timeoutMs} ms.`,
          retryable: true,
        });
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        tool.execute(args, context).catch((error: unknown) => ({
          tool: name,
          ok: false,
          category: "SERVICE_ERROR" as const,
          summary: error instanceof Error ? error.message : "Tool execution failed.",
          retryable: true,
        })),
        timeoutResult,
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }
}
