// Global test setup
import { beforeAll, afterAll, vi } from 'vitest';

beforeAll(() => {
  // console.log('Starting tests...');
});

afterAll(() => {
  // console.log('Tests completed.');
  vi.clearAllMocks();
});

