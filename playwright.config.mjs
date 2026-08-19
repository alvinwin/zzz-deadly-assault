import { defineConfig } from '@playwright/test';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
export default defineConfig({ testDir: './tests/e2e', webServer: { command: 'npm run build:fixture && cd dist && PORT=4174 node ../scripts/serve.mjs', port: 4174, reuseExistingServer: false }, use: { baseURL: 'http://127.0.0.1:4174', launchOptions: executablePath ? { executablePath } : {} } });
