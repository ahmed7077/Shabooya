import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'desktop-chromium',
      use: { viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: [
    {
      command: 'node tests/server.mjs',
      url: 'http://127.0.0.1:54329/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command:
        'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-publishable-key',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 240000,
    },
  ],
});
