import { redis, closeRedis } from '../shared/redis';
import { prisma } from '../shared/db';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  // 1. Create a dummy VETTED product
  const product = await prisma.product.create({
    data: {
      externalUrl: `https://test.com/sourcing/${Date.now()}`,
      title: 'Viral LED Lights',
      description: 'Lights that sync to music.',
      status: 'VETTED',
      viralScore: 90
    }
  });

  logger.info(`Created test product: ${product.id}`);

  // 2. Push to Sourcing Queue (simulating Discovery Agent success)
  await redis.lpush(QUEUES.SOURCING, product.id);
  logger.info('Pushed to sourcing queue');

  await closeRedis();
  await prisma.$disconnect();
}

main().catch((err) => logger.error(err));

