import { redis, closeRedis } from '../shared/redis';
import { prisma } from '../shared/db';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  // 1. Create a dummy APPROVED product (skipped discovery/sourcing)
  const product = await prisma.product.create({
    data: {
      externalUrl: `https://test.com/copy/${Date.now()}`,
      title: 'Galaxy Projector',
      description: 'A projector that puts stars on your ceiling.',
      status: 'APPROVED',
      viralScore: 95,
      supplierUrl: 'https://aliexpress.com/item/123',
      costPrice: 15.00
    }
  });

  logger.info(`Created test product: ${product.id}`);

  // 2. Push to Copywrite Queue
  await redis.lpush(QUEUES.COPYWRITE, product.id);
  logger.info('Pushed to copywrite queue');

  await closeRedis();
  await prisma.$disconnect();
}

main().catch((err) => logger.error(err));

