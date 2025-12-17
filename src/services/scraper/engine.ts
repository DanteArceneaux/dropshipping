import { ScrapeJobPayload, ProductCandidate } from '../../shared/types';
import { logger } from '../../shared/logger';
import { TikTokScraper } from './tiktok';

export class ScraperEngine {
  private tiktokScraper: TikTokScraper;

  constructor() {
    this.tiktokScraper = new TikTokScraper();
  }

  async init() {
    await this.tiktokScraper.init();
  }

  async close() {
    await this.tiktokScraper.close();
  }
  
  async processJob(job: ScrapeJobPayload): Promise<ProductCandidate> {
    if (job.source !== 'tiktok' && job.source !== 'instagram') {
      throw new Error(`Unsupported platform: ${job.source}`);
    }

    if (job.source === 'tiktok') {
        if (job.hashtag) {
            const results = await this.tiktokScraper.scrapeHashtag(job.hashtag, job.limit || 5);
            if (results.length > 0) {
                return results[0]; // For now, just return the first one as single job result
            }
            throw new Error(`No results found for hashtag #${job.hashtag}`);
        }
        // Fallback for single URL if needed, or implement scrapeUrl in TikTokScraper
        throw new Error('Direct URL scraping not yet implemented in TikTokScraper');
    }

    throw new Error('Not implemented for this job type');
  }

  // Deprecated mock method
  async fetchTikTokData(url: string): Promise<any> {
    return {};
  }
}
