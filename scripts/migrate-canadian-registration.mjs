/**
 * Root wrapper for Canadian patient registration migration.
 * Prefer: npm run migrate:canadian
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('npm', ['run', 'migrate:canadian', '--workspace=backend'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
