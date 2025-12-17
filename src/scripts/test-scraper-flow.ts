import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });

import { redis, closeRedis } from '../shared/redis';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  logger.info('🚀 Starting Scraper Flow Test...');

  const job = {
    source: 'tiktok', // We use 'tiktok' as key but it routes to YouTube now
    hashtag: 'galaxy projector astronaut', // Distinct visual shape for easier Google Lens sourcing
    limit: 1
  };

  await redis.lpush(QUEUES.SCRAPE, JSON.stringify(job));
  
  logger.info('✅ Pushed job to SCRAPE queue. Watch the logs!');
  
  await closeRedis();
}

main().catch(console.error);

