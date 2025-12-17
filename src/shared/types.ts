export interface ScrapeJobPayload {
  // Backwards-compatible: we still accept "tiktok"/"instagram" jobs, but the
  // current implementation primarily scrapes YouTube Shorts via search.
  source: 'tiktok' | 'instagram' | 'youtube';
  url?: string;
  hashtag?: string;
  limit?: number;
}

export interface ProductCandidate {
  externalUrl: string;
  // Where the candidate was discovered from. We currently ingest YouTube search
  // results and use thumbnails for sourcing.
  platform: 'tiktok' | 'instagram' | 'youtube';
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
    thumbnailUrl?: string;
  };
}

export const QUEUES = {
  SCRAPE: 'queue:scrape',
  DISCOVERY: 'queue:discovery',
  SOURCING: 'queue:sourcing',
  COPYWRITE: 'queue:copywrite',
  VIDEO: 'queue:video',
};

