import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });

import crypto from 'crypto';
import { redis, closeRedis } from '../../shared/redis';
import { prisma } from '../../shared/db';
import { QUEUES } from '../../shared/types';
import { DiscoveryAgent } from './discovery';
import { SourcingAgent } from './sourcing';
import { CopywriterAgent, CopywritingResult } from './copywriter';
import { VideoScriptAgent, VideoScriptResult } from './video';
import { VideoRenderer } from '../media/renderer';
import { ShopifySyncService } from './shopify-sync';
import { SerpApiSupplierSearch } from './serpapi-sourcing';
import { logger } from '../../shared/logger';
import type { Prisma, ProductStatus } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

interface ProductUpdateData {
  status?: ProductStatus;
  viralScore?: number;
  sentiment?: number;
  supplierUrl?: string | null;
  costPrice?: number | Prisma.Decimal;
  marketingCopy?: Prisma.InputJsonValue;
  videoScript?: Prisma.InputJsonValue;

  // Shopify sync (idempotency + admin links)
  shopifyProductId?: string | null;
  shopifyProductGid?: string | null;
  shopifyAdminUrl?: string | null;
  shopifyVideoMediaId?: string | null;
  listedAt?: Date | null;
}

interface AgentLogData {
  agentName: string;
  decision: string;
  reason: string;
}

// ============================================================================
// Service Instances
// ============================================================================

const discoveryAgent = new DiscoveryAgent();
const sourcingAgent = new SourcingAgent(new SerpApiSupplierSearch());
const copywriterAgent = new CopywriterAgent();
const videoAgent = new VideoScriptAgent();
const videoRenderer = new VideoRenderer();
const shopifySync = new ShopifySyncService();

// ============================================================================
// Reliability: Locks, Retries, DLQ
// ============================================================================

const JOB_LOCK_TTL_SECONDS = 10 * 60; // 10 minutes
const MAX_STAGE_RETRIES = 3;
const RETRY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

type JobLock = { key: string; token: string };

async function acquireJobLock(queueName: string, productId: string): Promise<JobLock | null> {
  const key = `lock:${queueName}:${productId}`;
  const token = crypto.randomUUID();

  const result = await redis.set(key, token, 'EX', JOB_LOCK_TTL_SECONDS, 'NX');
  if (result !== 'OK') {
    return null;
  }

  return { key, token };
}

async function releaseJobLock(lock: JobLock): Promise<void> {
  try {
    await redis.eval(RELEASE_LOCK_LUA, 1, lock.key, lock.token);
  } catch (err) {
    logger.warn(`Failed to release lock ${lock.key}: ${err}`);
  }
}

async function recordStageError(queueName: string, productId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  try {
    await prisma.agentLog.create({
      data: {
        agentName: 'Worker',
        decision: 'ERROR',
        reason: `${queueName} failed: ${msg}`,
        productId,
      },
    });
  } catch (logErr) {
    logger.warn(`Failed to write AgentLog for ${productId}: ${logErr}`);
  }
}

async function handleStageFailure(queueName: string, productId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);

  await recordStageError(queueName, productId, error);

  const retryKey = `retry:${queueName}:${productId}`;
  const attempt = await redis.incr(retryKey);
  await redis.expire(retryKey, RETRY_TTL_SECONDS);

  if (attempt <= MAX_STAGE_RETRIES) {
    const delayMs = attempt * 5000;
    logger.warn(`[${productId}] ${queueName} failed (attempt ${attempt}/${MAX_STAGE_RETRIES}). Retrying in ${delayMs}ms: ${msg}`);
    await new Promise((r) => setTimeout(r, delayMs));
    await redis.lpush(queueName, productId);
    return;
  }

  logger.error(`[${productId}] ${queueName} failed after ${attempt - 1} retries. Sending to DLQ: ${msg}`);
  await redis.lpush(
    QUEUES.DLQ,
    JSON.stringify({
      productId,
      stage: queueName,
      error: msg,
      occurredAt: new Date().toISOString(),
    })
  );
}

// ============================================================================
// Worker Entry Point
// ============================================================================

async function startWorker() {
  logger.info('🧠 Brain Service started (All Agents). Listening for jobs...');

  while (true) {
    try {
      const result = await redis.blpop(
        QUEUES.VIDEO, 
        QUEUES.COPYWRITE, 
        QUEUES.SOURCING, 
        QUEUES.DISCOVERY, 
        0
      );
      
      if (result) {
        const [queueName, productId] = result;
        await processJob(queueName, productId);
      }
    } catch (error) {
      logger.error(`Error in brain worker: ${error}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function processJob(queueName: string, productId: string) {
  const lock = await acquireJobLock(queueName, productId);
  if (!lock) {
    logger.warn(`[${productId}] Skipping duplicate in-flight job for ${queueName}`);
    return;
  }

  try {
    switch (queueName) {
      case QUEUES.DISCOVERY:
        await handleDiscovery(productId);
        break;
      case QUEUES.SOURCING:
        await handleSourcing(productId);
        break;
      case QUEUES.COPYWRITE:
        await handleCopywrite(productId);
        break;
      case QUEUES.VIDEO:
        await handleVideo(productId);
        break;
      default:
        logger.warn(`Unknown queue: ${queueName}`);
    }
  } catch (err) {
    await handleStageFailure(queueName, productId, err);
  } finally {
    await releaseJobLock(lock);
  }
}

async function handleDiscovery(productId: string) {
  logger.info(`🔍 Discovery: Analyzing product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const verdict = await discoveryAgent.analyze({
    title: product.title || 'Untitled',
    description: product.description || '',
    externalUrl: product.externalUrl,
    rawStats: { views: 0, likes: 0 }
  });

  const status = (verdict.verdict === 'APPROVE' ? 'VETTED' : 'REJECTED') as ProductStatus;
  
  await updateProductState(productId, {
    status,
    viralScore: verdict.viral_score,
    sentiment: verdict.sentiment_score,
  }, {
    agentName: 'Discovery',
    decision: verdict.verdict,
    reason: verdict.reasoning
  });

  if (status === 'VETTED') {
    logger.info(`🚀 Product VETTED! Pushing to Sourcing queue.`);
    await redis.lpush(QUEUES.SOURCING, product.id);
  } else {
    logger.info(`❌ Product REJECTED by Discovery Agent.`);
  }
}

async function handleSourcing(productId: string) {
  logger.info(`📦 Sourcing: Finding suppliers for product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const result = await sourcingAgent.source({
    title: product.title || '',
    imageUrl: product.images?.[0] || product.externalUrl // Prefer scraped image over video URL
  });

  const status = (result.verdict === 'APPROVED' ? 'APPROVED' : 'REJECTED') as ProductStatus;

  await updateProductState(productId, {
    status,
    supplierUrl: result.supplierUrl,
    costPrice: result.costPrice ? result.costPrice : undefined,
  }, {
    agentName: 'Sourcing',
    decision: result.verdict,
    reason: result.reasoning
  });

  logger.info(`✅ Sourcing Complete for ${productId}: ${result.verdict}`);

  if (status === 'APPROVED') {
    logger.info(`✍️ Product APPROVED! Pushing to Copywriter queue.`);
    await redis.lpush(QUEUES.COPYWRITE, product.id);
  }
}

async function handleCopywrite(productId: string): Promise<void> {
  logger.info(`📝 Copywriting: Generating content for product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const copy = await copywriterAgent.generateCopy({
    title: product.title || '',
    description: product.description || ''
  });

  await updateProductState(productId, {
    status: 'READY_FOR_VIDEO' as ProductStatus,
    marketingCopy: JSON.parse(JSON.stringify(copy)) as Prisma.InputJsonValue
  }, {
    agentName: 'Copywriter',
    decision: 'COMPLETED',
    reason: 'Generated marketing copy'
  });

  logger.info(`✨ Copywriting Complete for ${productId}. Pushing to Video queue.`);
  await redis.lpush(QUEUES.VIDEO, product.id);
}

async function handleVideo(productId: string): Promise<void> {
  logger.info(`🎬 Video: Generating script for product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product || !product.marketingCopy) {
    logger.warn(`Missing product or marketing copy for ${productId}`);
    return;
  }

  const copy = product.marketingCopy as unknown as CopywritingResult;
  const script = await videoAgent.generateScript({
    title: product.title || '',
    copy: {
      title: copy.title,
      description_md: copy.description_md,
      ad_hooks: copy.ad_hooks || []
    }
  });

  // Render the video
  let videoPath: string | null = null;
  try {
    const images = product.images.length > 0
      ? product.images
      : [product.externalUrl]; // Fallback (might fail if not an image)

    videoPath = await videoRenderer.renderVideo(script, images);
  } catch (renderError) {
    logger.error(`Failed to render video for ${productId}: ${renderError}`);
    // Continue to sync even if video rendering fails
  }

  await updateProductState(productId, {
    status: 'READY_TO_LIST' as ProductStatus,
    videoScript: JSON.parse(JSON.stringify(script)) as Prisma.InputJsonValue
  }, {
    agentName: 'VideoScript',
    decision: 'COMPLETED',
    reason: `Generated video script${videoPath ? ' and rendered video' : ''}`
  });

  logger.info(`🎞️ Video Script Ready for ${productId}! Syncing to Shopify...`);
  await handleSync(productId, videoPath);
}

// ============================================================================
// Helpers
// ============================================================================

async function updateProductState(
  productId: string,
  productData: ProductUpdateData,
  logData: AgentLogData
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: productData
  });

  await prisma.agentLog.create({
    data: {
      ...logData,
      productId
    }
  });
}

async function handleSync(productId: string, videoPath: string | null = null): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.marketingCopy) return;

  const copy = product.marketingCopy as unknown as CopywritingResult;

  try {
    const priceMultiplier = 2.5;
    const basePrice = Number(product.costPrice || 0);
    const sellingPrice = (basePrice * priceMultiplier).toFixed(2);

    const syncResult = await shopifySync.syncProduct({
      title: copy.title,
      descriptionHtml: shopifySync.convertMarkdownToHtml(copy.description_md),
      price: sellingPrice,
      vendor: 'AutoDropship',
      images: product.images.length > 0 ? product.images : [product.externalUrl],
      videoPath: videoPath ?? undefined,

      // Idempotency: if we already listed this Product before, update it instead of creating duplicates.
      existingProductId: product.shopifyProductId ?? null,
      existingProductGid: product.shopifyProductGid ?? null,
      existingVideoMediaId: product.shopifyVideoMediaId ?? null,
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        status: 'LISTED' as ProductStatus,
        shopifyProductId: syncResult.productId,
        shopifyProductGid: syncResult.productGid,
        shopifyAdminUrl: syncResult.adminUrl,
        shopifyVideoMediaId: syncResult.videoMediaId,
        listedAt: new Date(),
      }
    });

    logger.info(`🛍️ LISTED ON SHOPIFY! ID: ${syncResult.productId}`);
    logger.info(`🛠️ Shopify Admin: ${syncResult.adminUrl}`);
  } catch (err) {
    logger.error(`Failed to list product: ${err}`);
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await closeRedis();
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  startWorker();
}
