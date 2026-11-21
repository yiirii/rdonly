import { defineConfig } from '@playwright/test'
const chrome = { channel: 'chrome' as const }
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:4173/', ...chrome },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173/', reuseExistingServer: true },
  projects: [
    { name: 'iphone', use: { ...chrome, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, testIgnore: /electron/ },
    { name: 'laptop', use: { ...chrome, viewport: { width: 1440, height: 900 } }, testIgnore: /electron/ },
    { name: 'electron', testMatch: /electron\.spec/ },
  ],
})
