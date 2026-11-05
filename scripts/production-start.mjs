/**
 * Production entrypoint: optionally seed the clinic demo, then start the API.
 * Used by `npm start` on Render, Railway, and similar platforms.
 * `npm run build` must run first so backend/dist and frontend/dist exist.
 */
import { spawn } from 'child_process';
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

console.log('Production bootstrap…');

if (process.env.SEED_DEMO_DATA === 'true') {
  console.log('SEED_DEMO_DATA=true — loading the clinic demo when the database is empty…');
  await run(['dist/db/seed.js'], backend);
}

console.log('Starting API…');
await run(['dist/index.js'], backend);
