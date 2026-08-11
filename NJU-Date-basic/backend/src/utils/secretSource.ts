import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const MAX_SECRET_BYTES = 16 * 1024;

export interface SecretSourceOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly allowedRoots?: readonly string[];
}

function defaultAllowedRoots(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string[] {
  return [
    '/run/secrets',
    '/run/credentials',
    env.CREDENTIALS_DIRECTORY,
  ].filter((value): value is string => typeof value === 'string' && path.isAbsolute(value));
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function loadSecret(envVar: string, options: SecretSourceOptions = {}): string {
  const env = options.env ?? process.env;
  const inlineValue = env[envVar]?.trim();
  const fileEnvVar = `${envVar}_FILE`;
  const configuredPath = env[fileEnvVar]?.trim();

  if (inlineValue && configuredPath) {
    throw new Error(`[config] ${envVar} and ${fileEnvVar} must not both be set`);
  }
  if (!configuredPath) return inlineValue ?? '';
  if (!path.isAbsolute(configuredPath)) {
    throw new Error(`[config] ${fileEnvVar} must be an absolute path in an approved runtime secret directory`);
  }

  let secretPath: string;
  try {
    secretPath = realpathSync(configuredPath);
  } catch {
    throw new Error(`[config] ${fileEnvVar} cannot be resolved`);
  }

  const allowedRoots = (options.allowedRoots ?? defaultAllowedRoots(env)).flatMap((root) => {
    try {
      return [realpathSync(root)];
    } catch {
      // Some supported runtimes expose only one of the optional secret roots
      // (for example Docker mounts /run/secrets without /run/credentials).
      return [];
    }
  });
  if (!allowedRoots.some((root) => isWithinRoot(secretPath, root))) {
    throw new Error(`[config] ${fileEnvVar} must be inside an approved runtime secret directory`);
  }

  const file = statSync(secretPath);
  if (!file.isFile() || file.size > MAX_SECRET_BYTES) {
    throw new Error(`[config] ${fileEnvVar} must reference a regular secret file no larger than ${MAX_SECRET_BYTES} bytes`);
  }
  const value = readFileSync(secretPath, 'utf8').trim();
  if (!value) throw new Error(`[config] ${fileEnvVar} must not be empty`);
  return value;
}
