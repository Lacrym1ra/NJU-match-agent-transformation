import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ...process.env, VITE_USE_MOCK: 'true' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
