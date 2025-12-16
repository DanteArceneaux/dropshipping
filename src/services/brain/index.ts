import { redis, closeRedis } from '../../shared/redis';
import { prisma } from '../../shared/db';
import { QUEUES } from '../../shared/types';
import { DiscoveryAgent } from './discovery';
import { SourcingAgent } from './sourcing';
import { CopywriterAgent } from './copywriter';
import { VideoScriptAgent } from './video';
import { ShopifySyncService } from './shopify-sync';
import { MockSupplierSearch } from './supplier-search';
import { logger } from '../../shared/logger';

const discoveryAgent = new DiscoveryAgent();
const sourcingAgent = new SourcingAgent(new MockSupplierSearch());
const copywriterAgent = new CopywriterAgent();
const videoAgent = new VideoScriptAgent();
const shopifySync = new ShopifySyncService();

async function startWorker() {
  logger.info('🧠 Brain Service started (All Agents). Listening for jobs...');

  while (true) {
    try {
      // Prioritize: Video > Copywrite > Sourcing > Discovery
      const result = await redis.blpop(
        QUEUES.VIDEO, 
        QUEUES.COPYWRITE, 
        QUEUES.SOURCING, 
        QUEUES.DISCOVERY, 
        0
      );
      
      if (result) {
        const [queueName, productId] = result;
        
        if (queueName === QUEUES.DISCOVERY) {
          await handleDiscovery(productId);
        } else if (queueName === QUEUES.SOURCING) {
          await handleSourcing(productId);
        } else if (queueName === QUEUES.COPYWRITE) {
          await handleCopywrite(productId);
        } else if (queueName === QUEUES.VIDEO) {
          await handleVideo(productId);
        }
      }
    } catch (error) {
      logger.error(`Error in brain worker: ${error}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
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

  const status = verdict.verdict === 'APPROVE' ? 'VETTED' : 'REJECTED';
  
  await prisma.product.update({
    where: { id: productId },
    data: {
      status,
      viralScore: verdict.viral_score,
      sentiment: verdict.sentiment_score,
    }
  });

  await prisma.agentLog.create({
    data: {
      agentName: 'Discovery',
      decision: verdict.verdict,
      reason: verdict.reasoning,
      productId: product.id
    }
  });

  if (status === 'VETTED') {
    logger.info(`🚀 Product VETTED! Pushing to Sourcing queue.`);
    await redis.lpush(QUEUES.SOURCING, product.id);
  }
}

async function handleSourcing(productId: string) {
  logger.info(`📦 Sourcing: Finding suppliers for product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const result = await sourcingAgent.source({
    title: product.title || '',
    imageUrl: product.externalUrl
  });

  const status = result.verdict === 'APPROVED' ? 'APPROVED' : 'REJECTED';

  await prisma.product.update({
    where: { id: productId },
    data: {
      status,
      supplierUrl: result.supplierUrl,
      costPrice: result.costPrice ? result.costPrice : undefined,
    }
  });

  await prisma.agentLog.create({
    data: {
      agentName: 'Sourcing',
      decision: result.verdict,
      reason: result.reasoning,
      productId: product.id
    }
  });

  logger.info(`✅ Sourcing Complete for ${productId}: ${result.verdict}`);

  if (status === 'APPROVED') {
    logger.info(`✍️ Product APPROVED! Pushing to Copywriter queue.`);
    await redis.lpush(QUEUES.COPYWRITE, product.id);
  }
}

async function handleCopywrite(productId: string) {
  logger.info(`📝 Copywriting: Generating content for product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const copy = await copywriterAgent.generateCopy({
    title: product.title || '',
    description: product.description || ''
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      status: 'READY_FOR_VIDEO',
      marketingCopy: copy as any
    }
  });

  await prisma.agentLog.create({
    data: {
      agentName: 'Copywriter',
      decision: 'COMPLETED',
      reason: 'Generated marketing copy',
      productId: product.id
    }
  });

  logger.info(`✨ Copywriting Complete for ${productId}. Pushing to Video queue.`);
  await redis.lpush(QUEUES.VIDEO, product.id);
}

async function handleVideo(productId: string) {
  logger.info(`🎬 Video: Generating script for product ${productId}`);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  
  if (!product || !product.marketingCopy) {
    logger.warn(`Missing product or marketing copy for ${productId}`);
    return;
  }

  const copy = product.marketingCopy as any;
  const script = await videoAgent.generateScript({
    title: product.title || '',
    copy: {
      title: copy.title,
      description_md: copy.description_md,
      ad_hooks: copy.ad_hooks || []
    }
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      status: 'READY_TO_LIST',
      videoScript: script as any
    }
  });

  await prisma.agentLog.create({
    data: {
      agentName: 'VideoScript',
      decision: 'COMPLETED',
      reason: 'Generated video script',
      productId: product.id
    }
  });

  logger.info(`🎞️ Video Script Ready for ${productId}! Syncing to Shopify...`);
  await handleSync(productId);
}

async function handleSync(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.marketingCopy) return;

  const copy = product.marketingCopy as any;
  
  try {
    const shopifyId = await shopifySync.createProduct({
      title: copy.title,
      descriptionHtml: shopifySync.convertMarkdownToHtml(copy.description_md),
      price: (Number(product.costPrice || 0) * 2.5).toFixed(2),
      vendor: 'AutoDropship',
      images: [product.externalUrl] 
    });

    await prisma.product.update({
      where: { id: productId },
      data: { status: 'LISTED' }
    });

    logger.info(`🛍️ LISTED ON SHOPIFY! ID: ${shopifyId}`);
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
