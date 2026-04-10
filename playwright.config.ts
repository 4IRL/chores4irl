import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: 'http://localhost:5174',
        headless: true,
    },
    projects: [
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
    ],
    webServer: [
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
