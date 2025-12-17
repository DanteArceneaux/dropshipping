// Types are aligned to the Dashboard API (`src/services/dashboard-api/index.ts`).
// Keep these in sync so the UI renders real data instead of silently failing.

export type ProductStatus =
  | 'DETECTED'
  | 'VETTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'READY_FOR_VIDEO'
  | 'READY_TO_LIST'
  | 'LISTED';

export type ProductListItem = {
  id: string;
  externalUrl: string;
  title: string | null;
  description: string | null;
  images: string[];
  status: ProductStatus;
  viralScore: number;
  sentiment: number;
  supplierUrl: string | null;
  costPrice: string | null; // Prisma Decimal serialized to string in the API
  shopifyAdminUrl: string | null;
  shopifyProductId: string | null;
  shopifyProductGid: string | null;
  shopifyVideoMediaId: string | null;
  listedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLog: {
    agentName: string;
    decision: string;
    reason: string;
    createdAt: string;
  } | null;
};

export type ProductDetail = ProductListItem & {
  logs: Array<{
    id: string;
    agentName: string;
    decision: string;
    reason: string;
    createdAt: string;
  }>;
};

export type DlqItem = {
  productId: string;
  stage: string;
  error: string;
  occurredAt: string;
};

export type DashboardMetrics = {
  serverTime: string;
  productCountsByStatus: Record<string, number>;
  queueLengths: Record<string, number>;
  dlqPreview: DlqItem[];
};

export type SseSnapshotEvent = {
  serverTime: string;
  metrics: DashboardMetrics;
  products: ProductListItem[];
};
