import { defineConfig, devices } from '@playwright/test';
import { loadPorts } from './scripts/ports.mjs';

const { ports } = loadPorts();
// Children inherit the resolved ports so every process agrees (and reports source 'env').
const portEnv = {
  TT_JWKS_PORT: String(ports.TT_JWKS_PORT),
  TT_BACKEND_PORT: String(ports.TT_BACKEND_PORT),
  TT_FRONTEND_PORT: String(ports.TT_FRONTEND_PORT),
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  // All spec files share one seeded household against one local D1 (global-setup
  // runs once for the whole suite, not per file) — offline-outbox.spec.ts in
  // particular creates/deletes real chores against it mid-test. `fullyParallel:
  // false` only serializes tests *within* a file; different files still land on
  // separate workers by default and can race each other's mutations, which is
  // what caused timezone-parity.spec.ts to intermittently see 3 chores instead
  // of the 2 seeded ones. `workers: 1` forces every file to run strictly
  // serially against the shared state.
  workers: 1,
  use: {
    baseURL: `http://localhost:${ports.TT_FRONTEND_PORT}`,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(^|\/)webkit-[^/]*\.spec\.ts$/,
    },
    {
      // Only WebKit-specific checks (files named webkit-*.spec.ts) run here; the shared
      // seeded household and workers: 1 make running every spec twice costly and racy.
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /(^|\/)webkit-[^/]*\.spec\.ts$/,
    },
  ],
  webServer: [
    {
      command: 'node jwks-server.mjs',
      cwd: './e2e',
      port: ports.TT_JWKS_PORT,
      env: portEnv,
      // Never attach to a stack another checkout (or `make dev`) already started.
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev',
      cwd: './backend',
      port: ports.TT_BACKEND_PORT,
      env: portEnv,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // A built + `vite preview` server, not `vite dev` — avoids the cold-start
      // JIT-compile latency of the dev server, which was flaky enough to
      // intermittently fail the first assertion after `page.goto('/')`.
      // `url` (not `port`) so readiness waits for an actual HTTP 2xx/3xx response,
      // not just the TCP listener binding — the static-file middleware can lag
      // a moment behind the port opening, which showed up as a 404 on the very
      // first navigation once vite-plugin-pwa's extra build step made this gap
      // wide enough to hit reliably.
      command: `npm run build && npm run preview -- --port ${ports.TT_FRONTEND_PORT} --strictPort`,
      cwd: './frontend',
      url: `http://localhost:${ports.TT_FRONTEND_PORT}`,
      env: portEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
