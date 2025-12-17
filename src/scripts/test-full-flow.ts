import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });

import { redis, closeRedis } from '../shared/redis';
import { prisma } from '../shared/db';
import { QUEUES } from '../shared/types';
import { logger } from '../shared/logger';
import { Prisma } from '@prisma/client';

async function main() {
  // This script is used to validate the "brain" stages (copywriting → video → optional Shopify sync)
  // without creating unlimited duplicate products.
  //
  // Key idea: we UPSERT on a stable externalUrl. If the product already exists and was previously
  // listed on Shopify, the pipeline will update that same Shopify product (idempotent) instead of
  // creating a new listing every time.
  const externalUrl = process.env.FLOW_TEST_EXTERNAL_URL || 'https://test.local/full-flow/self-stirring-mug';
  const title = process.env.FLOW_TEST_TITLE || 'Self-Stirring Mug';
  const description = process.env.FLOW_TEST_DESCRIPTION || 'Mug that spins.';
  const imageUrl =
    process.env.FLOW_TEST_IMAGE_URL ||
    'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80';

  // 1. Upsert a demo product in an APPROVED (sourced) state.
  const product = await prisma.product.upsert({
    where: { externalUrl },
    update: {
      title,
      description,
      status: 'APPROVED',
      viralScore: 90,
      supplierUrl: 'http://ali.com/mug',
      costPrice: 8.5,
      images: [imageUrl],

      // Force regeneration so you can see new copy/video each run.
      marketingCopy: Prisma.DbNull,
      videoScript: Prisma.DbNull,
    },
    create: {
      externalUrl,
      title,
      description,
      status: 'APPROVED',
      viralScore: 90,
      supplierUrl: 'http://ali.com/mug',
      costPrice: 8.5,
      images: [imageUrl],
    },
  });

  logger.info(`Prepared test product: ${product.id} (externalUrl=${externalUrl})`);

  // 2. Push to Copywrite Queue (which will trigger Video -> Sync)
  await redis.lpush(QUEUES.COPYWRITE, product.id);
  logger.info('Pushed to COPYWRITE queue. Watch logs for full flow.');

  await closeRedis();
  await prisma.$disconnect();
}

main().catch((err) => logger.error(err));

