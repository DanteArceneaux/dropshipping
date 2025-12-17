import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { logger } from '../../shared/logger';
import { ProductCandidate } from '../../shared/types';

puppeteer.use(StealthPlugin());

// ============================================================================
// Type Definitions
// ============================================================================

interface RawVideoData {
  externalUrl: string;
  platform: string;
  rawStats: {
    viewString: string;
  };
  metadata: {
    title: string;
    description: string;
    postedAt: string;
    author: string;
    thumbnailUrl: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-notifications'
] as const;

const NAVIGATION_TIMEOUT = 60000;
const VIEW_MULTIPLIERS: Record<string, number> = {
  K: 1000,
  M: 1000000,
  B: 1000000000
};

// ============================================================================
// Implementation
// ============================================================================

export class YouTubeScraper {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [...BROWSER_ARGS]
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private parseViews(viewString: string | undefined): number {
    if (!viewString) return 0;

    const clean = viewString.replace(/ views?/i, '').trim().toUpperCase();
    
    for (const [suffix, multiplier] of Object.entries(VIEW_MULTIPLIERS)) {
      if (clean.includes(suffix)) {
        const num = parseFloat(clean.replace(/[KMB]/g, ''));
        return Math.floor(num * multiplier) || 0;
      }
    }

    return parseInt(clean.replace(/\D/g, ''), 10) || 0;
  }

  async scrapeHashtag(query: string, limit: number = 5): Promise<ProductCandidate[]> {
    logger.info(`Scraping YouTube Search: "${query}"`);

    let page: Page | null = null;

    try {
      if (!this.browser) {
        await this.init();
      }

      page = await this.browser!.newPage();
      
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      logger.info(`Navigating to ${url}...`);

      await page.goto(url, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT });

      // Extract video data from DOM
      const candidates = await page.evaluate((): RawVideoData[] => {
        // We look for both video renderers (long form) and reel items (shorts)
        const items = document.querySelectorAll('ytd-video-renderer, ytd-reel-item-renderer');
        const results: RawVideoData[] = [];

        items.forEach((item) => {
          try {
            const titleEl = item.querySelector('#video-title') || item.querySelector('.headline');
            const linkEl = item.querySelector('a#thumbnail') || item.querySelector('a');
            
            // View count selectors vary
            const viewEl = item.querySelector('#metadata-line span') || item.querySelector('.inline-metadata-item');
            
            // Channel/Author
            const authorEl = item.querySelector('#channel-info #text') || item.querySelector('.ytd-channel-name');
            
            // Thumbnail
            const imgEl = item.querySelector('img');

            if (titleEl && linkEl) {
               const link = (linkEl as HTMLAnchorElement).href;
               
               // Robust Thumbnail Extraction
               let reliableThumbnail = imgEl?.src || '';
               try {
                   // Try to construct high-res thumbnail from Video ID
                   // Supports: /shorts/ID and /watch?v=ID
                   const urlParts = link.split('/');
                   const shortsIndex = urlParts.indexOf('shorts');
                   let videoId = '';
                   
                   if (shortsIndex !== -1 && urlParts[shortsIndex + 1]) {
                       // Sometimes the shorts URL includes query params (e.g. /shorts/ID?si=...).
                       // Strip them so the thumbnail URL stays valid.
                       videoId = urlParts[shortsIndex + 1].split('?')[0];
                   } else if (link.includes('v=')) {
                       videoId = link.split('v=')[1]?.split('&')[0];
                   }
                   
                   if (videoId) {
                       reliableThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                   }
               } catch (e) {
                   // Keep existing src
               }

               results.push({
                externalUrl: link,
                platform: link.includes('/shorts/') ? 'youtube_shorts' : 'youtube',
                rawStats: {
                  viewString: viewEl?.textContent?.trim() || '0 views',
                  // Likes/Comments hard to get from search results page
                },
                metadata: {
                  title: titleEl.textContent?.trim() || 'No Title',
                  description: '', // Desc not fully available on search page
                  postedAt: new Date().toISOString(),
                  author: authorEl?.textContent?.trim() || 'unknown',
                  thumbnailUrl: reliableThumbnail
                }
              });
            }
          } catch (err) {
            // skip item
          }
        });
        return results;
      });

      logger.info(`Found ${candidates.length} videos`);

      const validCandidates = this.transformCandidates(candidates);
      return validCandidates.slice(0, limit);

    } catch (error) {
      logger.error(`YouTube scraping failed: ${error}`);
      return [];
    } finally {
      await this.closePage(page);
    }
  }

  private transformCandidates(rawCandidates: RawVideoData[]): ProductCandidate[] {
    return rawCandidates.map(c => ({
      externalUrl: c.externalUrl,
      platform: 'youtube' as const,
      rawStats: {
        views: this.parseViews(c.rawStats.viewString),
        likes: 0,
        shares: 0,
        comments: 0
      },
      metadata: {
        title: c.metadata.title,
        description: c.metadata.description,
        postedAt: new Date(c.metadata.postedAt),
        author: c.metadata.author,
        thumbnailUrl: c.metadata.thumbnailUrl
      }
    }));
  }

  private async closePage(page: Page | null): Promise<void> {
    if (!page) return;
    
    try {
      await page.close();
    } catch (closeError) {
      logger.warn(`Failed to close page: ${closeError}`);
    }
  }
}

