import { ScrapeJobPayload, ProductCandidate } from '../../shared/types';
import { logger } from '../../shared/logger';
import { YouTubeScraper } from './youtube';

export class ScraperEngine {
  private youtubeScraper: YouTubeScraper;

  constructor() {
    this.youtubeScraper = new YouTubeScraper();
  }

  async init() {
    await this.youtubeScraper.init();
  }

  async close() {
    await this.youtubeScraper.close();
  }
  
  async processJob(job: ScrapeJobPayload): Promise<ProductCandidate> {
    // We treat 'tiktok' jobs as generic 'viral video' jobs and route them to YouTube
    // if the user still sends 'tiktok' as the source.
    
    if (job.hashtag) {
        // Search for "hashtag + shorts" or just the query
        const query = `${job.hashtag} shorts`; 
        const results = await this.youtubeScraper.scrapeHashtag(query, job.limit || 5);
        if (results.length > 0) {
            return results[0]; // Return the first hit
        }
        throw new Error(`No results found for query "${query}"`);
    }

    throw new Error('Direct URL scraping not yet implemented');
  }
}
