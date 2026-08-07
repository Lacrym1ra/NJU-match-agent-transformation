import { spawn } from "node:child_process";
import { realpath, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CodingPort, CommandResult } from "./codingTools.js";

function resolveInside(root: string, relativePath: string) {
  const candidate = path.resolve(root, relativePath);
  const relation = path.relative(root, candidate);
  if (relation === "" || (!relation.startsWith(`..${path.sep}`) && relation !== ".." && !path.isAbsolute(relation))) {
    return candidate;
  }
  throw new Error("Path is outside the configured workspace.");
}

function assertInside(root: string, candidate: string) {
  const relation = path.relative(root, candidate);
  if (relation === "" || (!relation.startsWith(`..${path.sep}`) && relation !== ".." && !path.isAbsolute(relation))) {
    return candidate;
  }
  throw new Error("Resolved path escapes the configured workspace through a symbolic link.");
}

export class NodeCodingPort implements CodingPort {
  readonly #root: string;
  readonly #timeoutMs: number;

  public constructor(root: string, timeoutMs = 30_000) {
    this.#root = path.resolve(root);
    this.#timeoutMs = timeoutMs;
  }

  public async readFile(relativePath: string) {
    const root = await realpath(this.#root);
    const candidate = resolveInside(root, relativePath);
    const actual = assertInside(root, await realpath(candidate));
    return readFile(actual, "utf8");
  }

  public async writeFile(relativePath: string, content: string) {
    const root = await realpath(this.#root);
    const candidate = resolveInside(root, relativePath);
    let target: string;
    try {
      target = assertInside(root, await realpath(candidate));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      assertInside(root, await realpath(path.dirname(candidate)));
      target = candidate;
    }
    await writeFile(target, content, "utf8");
  }

  public runCommand(command: string, args: readonly string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], { cwd: this.#root, shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => child.kill(), this.#timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => { stdout = (stdout + chunk.toString()).slice(-20_000); });
      child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-20_000); });
      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      child.once("close", (code) => { clearTimeout(timeout); resolve({ exitCode: code ?? -1, stdout, stderr }); });
    });
  }
}
