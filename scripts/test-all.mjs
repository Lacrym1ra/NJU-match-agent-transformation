import { spawnSync } from 'node:child_process';
import process from 'node:process';

const npmCli = process.env.npm_execpath;
const npm = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const install = process.argv.includes('--install');

function run(prefix, args) {
  const commandArgs = ['--prefix', prefix, ...args];
  const spawnArgs = npmCli ? [npmCli, ...commandArgs] : commandArgs;
  console.log(`\n> npm ${commandArgs.join(' ')}`);
  const result = spawnSync(npm, spawnArgs, {
    stdio: 'inherit',
    shell: !npmCli && process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (install) {
  run('agent-harness', ['ci']);
  // The backend consumes the local package through file:../../agent-harness.
  // Build it before npm ci snapshots that package into backend/node_modules.
  run('agent-harness', ['run', 'build']);
  run('NJU-Date-basic/backend', ['ci']);
  run('NJU-Date-basic/frontend', ['ci']);
}

run('agent-harness', ['run', 'lint']);
run('agent-harness', ['test']);
run('NJU-Date-basic/backend', ['run', 'lint']);
run('NJU-Date-basic/backend', ['test']);
run('NJU-Date-basic/frontend', ['run', 'lint']);
run('NJU-Date-basic/frontend', ['test']);
run('NJU-Date-basic/frontend', ['run', 'build']);

console.log('\nAll deterministic repository checks passed.');
