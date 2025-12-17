import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });

import { redis, closeRedis } from '../shared/redis';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  logger.info('🚀 Starting Scraper Flow Test...');

  const query = process.env.SCRAPER_TEST_QUERY || 'galaxy projector astronaut';
  const limitRaw = Number(process.env.SCRAPER_TEST_LIMIT || 1);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 1;

  const job = {
    source: 'youtube',
    hashtag: query, // Distinct visual shape for easier Google Lens sourcing
    limit,
  };

  await redis.lpush(QUEUES.SCRAPE, JSON.stringify(job));
  
  logger.info(`✅ Pushed job to SCRAPE queue (query="${query}", limit=${limit}). Watch the logs!`);
  
  await closeRedis();
}

main().catch(console.error);

