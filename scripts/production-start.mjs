/**
 * Production entrypoint: optionally seed the clinic demo, then start the API.
 * Used by `npm start` on Render, Railway, and similar platforms.
 * `npm run build` must run first so backend/dist and frontend/dist exist.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');

function run(nodeArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArgs, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): node ${nodeArgs.join(' ')}`));
    });
  });
}

function tsxCli() {
  const candidates = [
    path.join(backend, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'tsx is not installed, so the demo seed cannot run. The build command must be: npm install --include=dev && npm run build'
    );
  }
  return found;
}

console.log('Production bootstrap…');

if (process.env.SEED_DEMO_DATA === 'true') {
  console.log('SEED_DEMO_DATA=true — loading the clinic demo when the database is empty…');
  // Seed is excluded from tsc. Local `npm run seed` uses tsx, and so does this boot.
  await run([tsxCli(), 'src/db/seed.ts'], backend);
}

console.log('Starting API…');
await run(['dist/index.js'], backend);
