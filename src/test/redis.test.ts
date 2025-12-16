import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { redis } from '../shared/redis';

describe('Redis Client', () => {
  const TEST_KEY = 'test:ping';

  afterAll(async () => {
    await redis.del(TEST_KEY);
    await redis.quit();
  });

  it('should connect and perform basic operations', async () => {
    await redis.set(TEST_KEY, 'pong');
    const value = await redis.get(TEST_KEY);
    expect(value).toBe('pong');
  });

  it('should handle queues (lpush/rpop)', async () => {
    const queueKey = 'test:queue';
    await redis.lpush(queueKey, 'job1');
    await redis.lpush(queueKey, 'job2');

    const job = await redis.rpop(queueKey);
    expect(job).toBe('job1'); // FIFO (if lpush used with rpop)
    
    await redis.del(queueKey);
  });
});

