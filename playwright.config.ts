import { defineConfig, devices } from '@playwright/test';

const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
        headless: true,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: PLAYWRIGHT_BASE_URL ? undefined : [
        {
            command: 'npm run dev --workspace backend',
            url: 'http://localhost:3000/api/chores',
            reuseExistingServer: !process.env.CI,
            timeout: 15_000,
        },
        {
            command: 'npm run dev --workspace frontend',
            url: 'http://localhost:5174',
            reuseExistingServer: !process.env.CI,
            timeout: 15_000,
        },
    ],
});
