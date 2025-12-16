import { redis, closeRedis } from '../shared/redis';
import { prisma } from '../shared/db';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  // 1. Create a dummy READY_FOR_VIDEO product
  const product = await prisma.product.create({
    data: {
      externalUrl: `https://test.com/video/${Date.now()}`,
      title: 'Levitating Moon Lamp',
      description: 'A lamp that floats.',
      status: 'READY_FOR_VIDEO',
      viralScore: 98,
      marketingCopy: {
        title: 'Magic Moon Lamp',
        description_md: 'It floats!',
        ad_hooks: ['You wont believe this', 'Magic in real life']
      }
    }
  });

  logger.info(`Created test product: ${product.id}`);

  // 2. Push to Video Queue
  await redis.lpush(QUEUES.VIDEO, product.id);
  logger.info('Pushed to video queue');

  await closeRedis();
  await prisma.$disconnect();
}

main().catch((err) => logger.error(err));

