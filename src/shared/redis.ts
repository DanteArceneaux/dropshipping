import Redis from 'ioredis';

// Use environment variable or default to localhost
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
});

export const closeRedis = async () => {
  await redis.quit();
};

