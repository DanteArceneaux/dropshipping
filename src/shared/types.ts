export interface ScrapeJobPayload {
  source: 'tiktok' | 'instagram';
  url?: string;
  hashtag?: string;
  limit?: number;
}

export interface ProductCandidate {
  externalUrl: string;
  platform: 'tiktok' | 'instagram';
  rawStats: {
    views: number;
    likes: number;
    shares: number;
    comments: number;
  };
  metadata: {
    title: string;
    description: string;
    postedAt: Date;
    author: string;
  };
}

export const QUEUES = {
  SCRAPE: 'queue:scrape',
  DISCOVERY: 'queue:discovery',
  SOURCING: 'queue:sourcing',
  COPYWRITE: 'queue:copywrite',
  VIDEO: 'queue:video',
};

