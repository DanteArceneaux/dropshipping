import { SupplierSearchService, SupplierResult } from './supplier-search';
const SerpApi = require('google-search-results-nodejs');
import { logger } from '../../shared/logger';

export class SerpApiSupplierSearch implements SupplierSearchService {
  private apiKey: string;
  private search: any;

  constructor() {
    this.apiKey = process.env.SERPAPI_KEY || '';
    if (!this.apiKey) {
      logger.warn('SERPAPI_KEY is missing. Sourcing will fail.');
    }
    this.search = new SerpApi.GoogleSearch(this.apiKey);
  }

  async findSuppliersByImage(imageUrl: string): Promise<SupplierResult[]> {
    if (!this.apiKey) {
      throw new Error('SERPAPI_KEY not configured');
    }

    logger.info(`Searching suppliers via Google Lens for image: ${imageUrl}`);

    return new Promise((resolve, reject) => {
      this.search.json({
        engine: "google_lens",
        url: imageUrl,
        hl: "en",
        country: "us"
      }, (json: any) => {
        if (!json || !json.visual_matches) {
          logger.warn('No visual matches found');
          return resolve([]);
        }

        const suppliers: SupplierResult[] = [];
        
        // Filter for dropshipping-friendly domains
        const allowedDomains = ['aliexpress.com', 'cjdropshipping.com', 'temu.com', 'dhgate.com'];

        for (const match of json.visual_matches) {
            const link = match.link || '';
            const source = match.source || '';
            
            // Check if source matches our whitelist
            const isDropshipSource = allowedDomains.some(d => link.includes(d));

            if (isDropshipSource) {
                // Extract price if available (SerpApi often gives price in 'price' object)
                const priceObj = match.price;
                const priceVal = priceObj ? parseFloat(priceObj.extracted_value) : 0;
                
                // Only add if we have a valid price or confident match
                if (priceVal > 0 || match.title) {
                    suppliers.push({
                        url: link,
                        price: priceVal,
                        // Defaults for metadata we can't scrape from Google Results easily
                        shippingDays: { min: 14, max: 30 }, 
                        rating: 4.5, // Assumption, would need deep-scrape to verify
                        storeAgeYears: 1, 
                        image: match.thumbnail || imageUrl
                    });
                }
            }
        }
        
        // Remove duplicates by URL
        const unique = suppliers.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
        
        logger.info(`Found ${unique.length} potential suppliers`);
        resolve(unique.slice(0, 5)); // Return top 5
      });
    });
  }
}

