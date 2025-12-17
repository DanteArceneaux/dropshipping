import { SupplierSearchService, SupplierResult } from './supplier-search';
import { logger } from '../../shared/logger';

// SerpApi doesn't have proper TypeScript types, so we define our own
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SerpApi = require('google-search-results-nodejs') as {
  GoogleSearch: new (apiKey: string) => SerpApiClient;
};

// ============================================================================
// Type Definitions for SerpApi
// ============================================================================

interface SerpApiClient {
  json: (params: SerpApiParams, callback: (data: SerpApiResponse) => void) => void;
}

interface SerpApiParams {
  engine: 'google_lens';
  url: string;
  hl: string;
  country: string;
}

interface SerpApiResponse {
  error?: string;
  visual_matches?: SerpApiVisualMatch[];
}

interface SerpApiVisualMatch {
  link?: string;
  title?: string;
  thumbnail?: string;
  price?: {
    extracted_value?: string | number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DROPSHIP_DOMAINS = [
  'aliexpress.com',
  'cjdropshipping.com', 
  'temu.com',
  'dhgate.com'
] as const;

const DEFAULT_SHIPPING_DAYS = { min: 14, max: 30 };
const DEFAULT_RATING = 4.5;
const DEFAULT_STORE_AGE = 1;
const MAX_RESULTS = 5;

// ============================================================================
// Implementation
// ============================================================================

export class SerpApiSupplierSearch implements SupplierSearchService {
  private readonly apiKey: string;
  private readonly search: SerpApiClient;

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
      try {
        this.search.json(
          {
            engine: 'google_lens',
            url: imageUrl,
            hl: 'en',
            country: 'us'
          },
          (data: SerpApiResponse) => {
            try {
              const suppliers = this.parseResponse(data, imageUrl);
              resolve(suppliers);
            } catch (parseError) {
              logger.error(`Failed to parse SerpApi response: ${parseError}`);
              resolve([]);
            }
          }
        );
      } catch (err) {
        logger.error(`SerpApi request failed: ${err}`);
        reject(err);
      }
    });
  }

  private parseResponse(data: SerpApiResponse, fallbackImage: string): SupplierResult[] {
    if (data.error) {
      logger.error(`SerpApi error: ${data.error}`);
      return [];
    }

    if (!data.visual_matches) {
      logger.warn('No visual matches found');
      return [];
    }

    const suppliers: SupplierResult[] = [];

    for (const match of data.visual_matches) {
      const supplier = this.parseMatch(match, fallbackImage);
      if (supplier) {
        suppliers.push(supplier);
      }
    }

    // Remove duplicates by URL
    const unique = this.deduplicateByUrl(suppliers);
    
    logger.info(`Found ${unique.length} potential suppliers`);
    return unique.slice(0, MAX_RESULTS);
  }

  private parseMatch(match: SerpApiVisualMatch, fallbackImage: string): SupplierResult | null {
    const link = match.link || '';
    
    // Check if link matches our whitelist
    const isDropshipSource = DROPSHIP_DOMAINS.some(domain => link.includes(domain));
    if (!isDropshipSource) {
      return null;
    }

    // Extract price if available
    const priceVal = this.extractPrice(match.price);
    
    // Only add if we have a valid price or confident match
    if (priceVal <= 0 && !match.title) {
      return null;
    }

    return {
      url: link,
      price: priceVal,
      shippingDays: DEFAULT_SHIPPING_DAYS,
      rating: DEFAULT_RATING,
      storeAgeYears: DEFAULT_STORE_AGE,
      image: match.thumbnail || fallbackImage
    };
  }

  private extractPrice(priceObj: SerpApiVisualMatch['price']): number {
    if (!priceObj?.extracted_value) {
      return 0;
    }
    
    const value = priceObj.extracted_value;
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  }

  private deduplicateByUrl(suppliers: SupplierResult[]): SupplierResult[] {
    const seen = new Set<string>();
    return suppliers.filter(supplier => {
      if (seen.has(supplier.url)) {
        return false;
      }
      seen.add(supplier.url);
      return true;
    });
  }
}

