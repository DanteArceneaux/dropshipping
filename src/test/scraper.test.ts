import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScraperEngine } from '../services/scraper/engine';
import { ScrapeJobPayload } from '../shared/types';

describe('Scraper Service', () => {
  let scraper: ScraperEngine;

  beforeEach(() => {
    scraper = new ScraperEngine();
  });

  it('should scrape data from a valid TikTok hashtag', async () => {
    const job: ScrapeJobPayload = {
      source: 'tiktok',
      hashtag: 'amazonfinds',
      limit: 1
    };
    
    // We mock the internal scraper call
    // Note: We need to cast because 'tiktokScraper' is private, but for testing we bypass or we mocking the public method if we could inject it
    // Better way: Spy on the prototype of TikTokScraper
    const { TikTokScraper } = await import('../services/scraper/tiktok');
    vi.spyOn(TikTokScraper.prototype, 'scrapeHashtag').mockResolvedValue([
        {
            externalUrl: 'https://tiktok.com/video/123',
            platform: 'tiktok',
            rawStats: { views: 1000, likes: 50, shares: 0, comments: 0 },
            metadata: { title: 'Mock Video', description: '', postedAt: new Date(), author: 'user' }
        }
    ]);

    const result = await scraper.processJob(job);
    
    expect(result).toBeDefined();
    expect(result.platform).toBe('tiktok');
    expect(result.externalUrl).toBe('https://tiktok.com/video/123');
  });

  it('should throw error for unsupported platform', async () => {
    const job = {
      source: 'invalid',
      url: 'https://example.com'
    } as any;

    await expect(scraper.processJob(job)).rejects.toThrow('Unsupported platform');
  });
});

