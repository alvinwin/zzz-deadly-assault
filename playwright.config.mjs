import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', webServer: { command: 'PORT=4174 node scripts/serve.mjs', port: 4174, reuseExistingServer: false }, use: { baseURL: 'http://127.0.0.1:4174' } });
