import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://admin:change_me_secure_password@localhost:5432/dropship_bot?schema=public',
      REDIS_URL: 'redis://localhost:6379'
    }
  },
});

