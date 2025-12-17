import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });

import { redis, closeRedis } from '../shared/redis';
import { prisma } from '../shared/db';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';

async function main() {
  // 1. Create a dummy product (Already Sourced)
  const product = await prisma.product.create({
    data: {
      externalUrl: `https://test.com/full/${Date.now()}`,
      title: 'Self-Stirring Mug',
      description: 'Mug that spins.',
      status: 'APPROVED',
      viralScore: 90,
      supplierUrl: 'http://ali.com/mug',
      costPrice: 8.50,
      images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80'] // Valid mug image
    }
  });

  logger.info(`Created test product: ${product.id}`);

  // 2. Push to Copywrite Queue (which will trigger Video -> Sync)
  await redis.lpush(QUEUES.COPYWRITE, product.id);
  logger.info('Pushed to COPYWRITE queue. Watch logs for full flow.');

  await closeRedis();
  await prisma.$disconnect();
}

main().catch((err) => logger.error(err));

