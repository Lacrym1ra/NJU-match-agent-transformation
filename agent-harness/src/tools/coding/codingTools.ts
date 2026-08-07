import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { Observation } from "../../core/types.js";
import type { Tool } from "../types.js";

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CodingPort {
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  runCommand(command: string, args: readonly string[]): Promise<CommandResult>;
}

export type CodingConfirmableAction = "write_file" | "run_command";

interface ConfirmationRecord {
  readonly userId: string;
  readonly action: CodingConfirmableAction;
  readonly resourceId: string;
  readonly expiresAt: number;
}

export class CodingConfirmationStore {
  readonly #records = new Map<string, ConfirmationRecord>();
  readonly #ttlMs: number;

  public constructor(ttlMs = 5 * 60_000) { this.#ttlMs = ttlMs; }

  public issue(userId: string, action: CodingConfirmableAction, resourceId: string): string {
    const token = randomUUID();
    this.#records.set(token, { userId, action, resourceId, expiresAt: Date.now() + this.#ttlMs });
    return token;
  }

  public consume(token: string, userId: string, action: CodingConfirmableAction, resourceId: string): boolean {
    const record = this.#records.get(token);
    this.#records.delete(token);
    return record !== undefined && record.expiresAt >= Date.now()
      && record.userId === userId && record.action === action && record.resourceId === resourceId;
  }
}

const relativePathSchema = z.string().trim().min(1).max(500);
const readSchema = z.object({ path: relativePathSchema }).strict();
const writeSchema = z.object({
  path: relativePathSchema,
  content: z.string().max(100_000),
  confirmationToken: z.string().uuid(),
}).strict();
const testSchema = z.object({ script: z.enum(["test", "lint", "build", "typecheck"]) }).strict();
const commandSchema = z.object({
  command: z.string().trim().min(1).max(40),
  args: z.array(z.string().max(300)).max(30).default([]),
  confirmationToken: z.string().uuid().optional(),
}).strict();

const blockedCommands = new Set([
  "rm", "rmdir", "del", "erase", "format", "shutdown", "reboot",
  "powershell", "pwsh", "cmd", "sh", "bash", "zsh", "sudo",
]);
const sensitiveNames = /^(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx)|id_rsa|id_ed25519)$/i;

function normalizedRelativePath(input: string): string | null {
  if (path.isAbsolute(input)) return null;
  const normalized = input.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === ".." || segment === ".git" || sensitiveNames.test(segment))) {
    return null;
  }
  return segments.join("/");
}

function commandResource(command: string, args: readonly string[]) {
  return [command.toLowerCase(), ...args].join(" ");
}

function isSafeReadOnlyCommand(command: string, args: readonly string[]) {
  const name = command.toLowerCase();
  if (name === "git") return args[0] === "status" || args[0] === "diff";
  if (name !== "npm") return false;
  if (args[0] === "test") return true;
  return args[0] === "run" && ["test", "lint", "build", "typecheck"].includes(args[1] ?? "");
}

function invalid(tool: string): Observation {
  return { tool, ok: false, category: "INVALID_ARGUMENT", summary: "Arguments or workspace path are invalid.", retryable: true };
}

function denied(tool: string, summary: string): Observation {
  return { tool, ok: false, category: "POLICY_DENIED", summary, retryable: false };
}

function boundedOutput(result: CommandResult) {
  return { exitCode: result.exitCode, stdout: result.stdout.slice(-8_000), stderr: result.stderr.slice(-8_000) };
}

export function createCodingTools(port: CodingPort, confirmations: CodingConfirmationStore): readonly Tool[] {
  return [
    {
      name: "read_file",
      async execute(args) {
        const input = readSchema.safeParse(args);
        const safePath = input.success ? normalizedRelativePath(input.data.path) : null;
        if (!input.success || safePath === null) return invalid("read_file");
        const content = await port.readFile(safePath);
        return { tool: "read_file", ok: true, category: "SUCCESS", summary: `Read ${safePath}.`, data: { path: safePath, content: content.slice(0, 100_000) }, retryable: false };
      },
    },
    {
      name: "write_file",
      async execute(args, context) {
        const input = writeSchema.safeParse(args);
        const safePath = input.success ? normalizedRelativePath(input.data.path) : null;
        if (!input.success || safePath === null) return invalid("write_file");
        if (!confirmations.consume(input.data.confirmationToken, context.userId, "write_file", safePath)) {
          return denied("write_file", "A user-bound, path-bound confirmation is required before writing.");
        }
        await port.writeFile(safePath, input.data.content);
        return { tool: "write_file", ok: true, category: "SUCCESS", summary: `Wrote ${safePath}.`, retryable: false };
      },
    },
    {
      name: "run_tests",
      async execute(args) {
        const input = testSchema.safeParse(args);
        if (!input.success) return invalid("run_tests");
        const commandArgs = input.data.script === "test" ? ["test"] : ["run", input.data.script];
        const result = await port.runCommand("npm", commandArgs);
        const data = boundedOutput(result);
        return result.exitCode === 0
          ? { tool: "run_tests", ok: true, category: "SUCCESS", summary: `${input.data.script} passed.`, data, retryable: false }
          : { tool: "run_tests", ok: false, category: "VALIDATION_FAILED", summary: `${input.data.script} failed with exit code ${result.exitCode}.`, data, retryable: true };
      },
    },
    {
      name: "run_command",
      async execute(args, context) {
        const input = commandSchema.safeParse(args);
        if (!input.success) return invalid("run_command");
        const command = input.data.command.toLowerCase();
        const resource = commandResource(command, input.data.args);
        if (blockedCommands.has(command) || (command === "git" && ["reset", "clean", "push"].includes(input.data.args[0] ?? ""))) {
          return denied("run_command", "Destructive or shell-expanding commands are blocked by policy.");
        }
        if (!isSafeReadOnlyCommand(command, input.data.args)) {
          const token = input.data.confirmationToken;
          if (token === undefined || !confirmations.consume(token, context.userId, "run_command", resource)) {
            return denied("run_command", `Explicit confirmation is required for: ${resource}`);
          }
        }
        const result = await port.runCommand(command, input.data.args);
        const data = boundedOutput(result);
        return result.exitCode === 0
          ? { tool: "run_command", ok: true, category: "SUCCESS", summary: `Command completed: ${resource}`, data, retryable: false }
          : { tool: "run_command", ok: false, category: "VALIDATION_FAILED", summary: `Command failed with exit code ${result.exitCode}: ${resource}`, data, retryable: true };
      },
    },
  ];
}
