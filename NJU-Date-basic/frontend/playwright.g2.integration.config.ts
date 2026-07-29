import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.INTEGRATION_FRONTEND_PORT ?? 3101);
const backendPort = Number(process.env.INTEGRATION_BACKEND_PORT ?? 3100);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const apiBase = `http://127.0.0.1:${backendPort}/api/v1`;
const browserChannel = process.env.INTEGRATION_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './tests/g2-integration',
  testMatch: /g2-integration\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `NODE_ENV=development PORT=${backendPort} FRONTEND_URLS=${frontendUrl},http://localhost:${frontendPort} npm --prefix ../backend run dev:integration`,
      url: `http://127.0.0.1:${backendPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `VITE_USE_MOCK=false VITE_API_BASE=${apiBase} npm run dev:integration`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
});
