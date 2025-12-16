import { redis, closeRedis } from '../shared/redis';
import { prisma } from '../shared/db';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  // 1. Create a dummy product
  const product = await prisma.product.create({
    data: {
      externalUrl: `https://test.com/${Date.now()}`,
      title: 'Amazing Flying Toaster',
      description: 'The best toaster that flies.',
      status: 'DETECTED',
      viralScore: 50
    }
  });

  logger.info(`Created test product: ${product.id}`);

  // 2. Push to Discovery Queue
  await redis.lpush(QUEUES.DISCOVERY, product.id);
  logger.info('Pushed to discovery queue');

  await closeRedis();
  await prisma.$disconnect();
}

main().catch((err) => logger.error(err));

