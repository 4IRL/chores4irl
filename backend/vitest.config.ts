import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        env: {
            TEST_DB_PATH: ':memory:',
        },
    },
});
