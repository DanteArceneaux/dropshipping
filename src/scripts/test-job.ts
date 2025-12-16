import { redis, closeRedis } from '../shared/redis';
import { QUEUES, ScrapeJobPayload } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  const job: ScrapeJobPayload = {
    source: 'tiktok',
    url: 'https://www.tiktok.com/@test/video/99999999'
  };

  logger.info(`Pushing job to queue: ${JSON.stringify(job)}`);
  await redis.lpush(QUEUES.SCRAPE, JSON.stringify(job));
  
  logger.info('Done.');
  await closeRedis();
}

main().catch((err) => logger.error(err));

