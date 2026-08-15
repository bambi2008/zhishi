import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';


const projectRoot = resolve(import.meta.dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const extraArguments = process.argv.slice(2);
const result = spawnSync(
  npxCommand,
  [
    '--yes',
    'eas-cli@latest',
    'build',
    '--platform',
    'ios',
    '--profile',
    'production',
    ...extraArguments,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAS_NO_VCS: '1',
      EAS_PROJECT_ROOT: projectRoot,
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
