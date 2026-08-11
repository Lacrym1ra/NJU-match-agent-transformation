import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [script, ...scriptArgs] = process.argv.slice(2);
if (!script) {
  console.error('Usage: node run-powershell.mjs <script.ps1> [arguments]');
  process.exit(2);
}

const systemRoot = process.env.SystemRoot || process.env.WINDIR;
if (!systemRoot) {
  console.error('SystemRoot is unavailable; this command must run on Windows.');
  process.exit(2);
}

const executable = path.join(
  systemRoot,
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
const result = spawnSync(executable, [
  '-NoLogo',
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  path.resolve(script),
  ...scriptArgs,
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
