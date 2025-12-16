import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScraperEngine } from '../services/scraper/engine';
import { ScrapeJobPayload } from '../shared/types';

describe('Scraper Service', () => {
  let scraper: ScraperEngine;

  beforeEach(() => {
    scraper = new ScraperEngine();
  });

  it('should scrape data from a valid TikTok URL (Mock)', async () => {
    const job: ScrapeJobPayload = {
      source: 'tiktok',
      url: 'https://www.tiktok.com/@user/video/1234567890'
    };

    // Mock the internal fetcher
    const mockData = {
      title: 'Viral Gadget',
      stats: { views: 1000000, likes: 50000 }
    };
    
    // We spy on the method we will implement
    vi.spyOn(scraper, 'fetchTikTokData').mockResolvedValue(mockData);

    const result = await scraper.processJob(job);

    expect(result).toBeDefined();
    expect(result.metadata.title).toBe('Viral Gadget');
    expect(result.rawStats.views).toBe(1000000);
    expect(result.platform).toBe('tiktok');
  });

  it('should throw error for unsupported platform', async () => {
    const job = {
      source: 'invalid',
      url: 'https://example.com'
    } as any;

    await expect(scraper.processJob(job)).rejects.toThrow('Unsupported platform');
  });
});

