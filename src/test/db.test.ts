import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../shared/db';

describe('Database Integration', () => {
  beforeAll(async () => {
    // Clean up DB
    await prisma.agentLog.deleteMany();
    await prisma.product.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create and retrieve a product', async () => {
    const product = await prisma.product.create({
      data: {
        externalUrl: 'https://tiktok.com/video/123456',
        status: 'DETECTED',
        viralScore: 85
      }
    });

    expect(product.id).toBeDefined();
    expect(product.viralScore).toBe(85);

    const found = await prisma.product.findUnique({
      where: { id: product.id }
    });

    expect(found).not.toBeNull();
    expect(found?.externalUrl).toBe('https://tiktok.com/video/123456');
  });
});

