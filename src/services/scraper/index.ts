import { redis, closeRedis } from '../../shared/redis';
import { prisma } from '../../shared/db';
import { QUEUES, ScrapeJobPayload } from '../../shared/types';
import { ScraperEngine } from './engine';
import { logger } from '../../shared/logger';

const scraper = new ScraperEngine();

async function startWorker() {
  logger.info('🕷️ Scraper Service started. Listening for jobs...');

  while (true) {
    try {
      // Blocking pop from the right
      // Returns [key, value] or null if timeout (0 means no timeout)
      const result = await redis.brpop(QUEUES.SCRAPE, 0);
      
      if (result) {
        const [_, jobData] = result;
        const job: ScrapeJobPayload = JSON.parse(jobData);
        
        logger.info(`Processing job: ${job.url}`);

        // Scrape
        const candidate = await scraper.processJob(job);

        // Save to DB
        const product = await prisma.product.upsert({
          where: { externalUrl: candidate.externalUrl },
          update: {
            viralScore: Math.floor(candidate.rawStats.views / 1000), // Simple scoring for MVP
            images: candidate.metadata.thumbnailUrl ? [candidate.metadata.thumbnailUrl] : [],
          },
          create: {
            externalUrl: candidate.externalUrl,
            title: candidate.metadata.title,
            viralScore: Math.floor(candidate.rawStats.views / 1000),
            status: 'DETECTED',
            images: candidate.metadata.thumbnailUrl ? [candidate.metadata.thumbnailUrl] : [],
          }
        });

        logger.info(`✅ Saved product: ${product.id} (${product.title})`);
      }
    } catch (error) {
      logger.error(`Error processing job: ${error}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Backoff
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await closeRedis();
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  startWorker();
}

