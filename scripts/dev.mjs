// `npm run app:dev`: starts the Vite dev server, then opens Compass in Electron
// pointed at it. Edits to the UI show up instantly. Uses a separate "Compass Dev"
// data folder, so experiments never touch your real data.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:1420/';
console.log(`UI dev server: ${url}`);

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, COMPASS_DEV_URL: url },
});

child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
