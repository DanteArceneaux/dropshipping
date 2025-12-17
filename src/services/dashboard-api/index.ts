import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });

import http, { type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../shared/db';
import { redis } from '../../shared/redis';
import { logger } from '../../shared/logger';
import { QUEUES } from '../../shared/types';
import type { ProductStatus } from '@prisma/client';

// ============================================================================
// Dashboard API (Read-only)
// ============================================================================
// - Local-only monitoring for products + pipeline progress.
// - Provides REST endpoints + SSE for near real-time UI updates.
// - Serves static frontend assets.
// - DO NOT expose secrets. DO NOT provide mutating endpoints.
// ============================================================================

const PORT = Number(process.env.DASHBOARD_API_PORT || 3030);
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const SSE_INTERVAL_MS = 2000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.resolve(__dirname, '../../../dashboard-ui/dist');
const PUBLIC_DIR_RESOLVED = path.resolve(PUBLIC_DIR);

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

type DlqItem = {
  productId: string;
  stage: string;
  error: string;
  occurredAt: string;
};

type MetricsResponse = {
  serverTime: string;
  productCountsByStatus: Record<string, number>;
  queueLengths: Record<string, number>;
  dlqPreview: DlqItem[];
};

type ProductListItem = {
  id: string;
  externalUrl: string;
  title: string | null;
  description: string | null;
  images: string[];
  status: ProductStatus;
  viralScore: number;
  sentiment: number;
  supplierUrl: string | null;
  costPrice: string | null; // Prisma Decimal serialized
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

type ProductDetailResponse = ProductListItem & {
  logs: Array<{
    id: string;
    agentName: string;
    decision: string;
    reason: string;
    createdAt: string;
  }>;
};

function sendJson(res: ServerResponse, statusCode: number, body: JsonValue) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function notFound(res: ServerResponse) {
  sendJson(res, 404, { error: 'Not found' });
}

function badRequest(res: ServerResponse, message: string) {
  sendJson(res, 400, { error: message });
}

function toNumberOrDefault(value: string | null, def: number) {
  if (!value) return def;
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function getQueueLengths(): Promise<Record<string, number>> {
  const keys = [
    QUEUES.SCRAPE,
    QUEUES.DISCOVERY,
    QUEUES.SOURCING,
    QUEUES.COPYWRITE,
    QUEUES.VIDEO,
    QUEUES.DLQ,
  ];

  const lengths = await Promise.all(keys.map((k) => redis.llen(k)));
  const out: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    out[keys[i]] = lengths[i] ?? 0;
  }
  return out;
}

async function getProductCountsByStatus(): Promise<Record<string, number>> {
  const grouped = await prisma.product.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const out: Record<string, number> = {};
  for (const row of grouped) {
    out[row.status] = row._count._all;
  }
  return out;
}

async function getDlqPreview(limit: number = 10): Promise<DlqItem[]> {
  const raw = await redis.lrange(QUEUES.DLQ, 0, Math.max(0, limit - 1));
  const parsed = raw
    .map((s) => safeJsonParse<DlqItem>(s))
    .filter((x): x is DlqItem => Boolean(x && x.productId && x.stage && x.error && x.occurredAt));
  return parsed;
}

function serializeProductBase(input: any): ProductListItem {
  // Prisma returns Decimal for costPrice; JSON serialize to string for the UI.
  const costPrice =
    input.costPrice === null || input.costPrice === undefined
      ? null
      : String(input.costPrice);

  const lastLogRow = Array.isArray(input.logs) && input.logs.length > 0 ? input.logs[0] : null;

  return {
    id: input.id,
    externalUrl: input.externalUrl,
    title: input.title ?? null,
    description: input.description ?? null,
    images: input.images ?? [],
    status: input.status,
    viralScore: input.viralScore ?? 0,
    sentiment: input.sentiment ?? 0,
    supplierUrl: input.supplierUrl ?? null,
    costPrice,
    shopifyAdminUrl: input.shopifyAdminUrl ?? null,
    shopifyProductId: input.shopifyProductId ?? null,
    shopifyProductGid: input.shopifyProductGid ?? null,
    shopifyVideoMediaId: input.shopifyVideoMediaId ?? null,
    listedAt: input.listedAt ? new Date(input.listedAt).toISOString() : null,
    createdAt: new Date(input.createdAt).toISOString(),
    updatedAt: new Date(input.updatedAt).toISOString(),
    lastLog: lastLogRow
      ? {
          agentName: lastLogRow.agentName,
          decision: lastLogRow.decision,
          reason: lastLogRow.reason,
          createdAt: new Date(lastLogRow.createdAt).toISOString(),
        }
      : null,
  };
}

async function listProducts(params: {
  status?: string | null;
  q?: string | null;
  limit?: number;
}): Promise<ProductListItem[]> {
  const limit = clamp(params.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

  const where: any = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: 'insensitive' } },
      { externalUrl: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return rows.map(serializeProductBase);
}

async function getProductDetail(productId: string): Promise<ProductDetailResponse | null> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      logs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!row) return null;

  const base = serializeProductBase({ ...row, logs: row.logs.slice(-1) });
  const logs = row.logs.map((l) => ({
    id: l.id,
    agentName: l.agentName,
    decision: l.decision,
    reason: l.reason,
    createdAt: new Date(l.createdAt).toISOString(),
  }));

  return { ...base, logs };
}

async function getMetrics(): Promise<MetricsResponse> {
  const [productCountsByStatus, queueLengths, dlqPreview] = await Promise.all([
    getProductCountsByStatus(),
    getQueueLengths(),
    getDlqPreview(10),
  ]);

  return {
    serverTime: new Date().toISOString(),
    productCountsByStatus,
    queueLengths,
    dlqPreview,
  };
}

// ============================================================================
// SSE
// ============================================================================

type SseClient = {
  id: string;
  res: ServerResponse;
};

const sseClients = new Map<string, SseClient>();
let sseTickRunning = false;

function sseWriteEvent(res: ServerResponse, event: string, data: JsonValue) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function sseTick() {
  if (sseTickRunning) return;
  if (sseClients.size === 0) return;

  sseTickRunning = true;
  try {
    const [metrics, products] = await Promise.all([
      getMetrics(),
      listProducts({ limit: DEFAULT_LIMIT }),
    ]);

    const payload = {
      serverTime: new Date().toISOString(),
      metrics,
      products,
    };

    for (const { res } of sseClients.values()) {
      try {
        sseWriteEvent(res, 'snapshot', payload);
      } catch {
        // ignore; close handler will clean up
      }
    }
  } catch (err) {
    logger.warn(`SSE tick failed: ${err}`);
  } finally {
    sseTickRunning = false;
  }
}

setInterval(() => {
  void sseTick();
}, SSE_INTERVAL_MS);

// ============================================================================
// HTTP Server
// ============================================================================

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const { pathname } = url;

    // Basic routing
    if (req.method === 'GET' && pathname === '/api/health') {
      // Lightweight checks; don't fail the whole dashboard if a check errors.
      let dbOk = false;
      let redisOk = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbOk = true;
      } catch {
        dbOk = false;
      }
      try {
        const pong = await redis.ping();
        redisOk = pong === 'PONG';
      } catch {
        redisOk = false;
      }

      return sendJson(res, 200, {
        status: 'ok',
        serverTime: new Date().toISOString(),
        db: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      });
    }

    if (req.method === 'GET' && pathname === '/api/metrics') {
      const metrics = await getMetrics();
      return sendJson(res, 200, metrics as unknown as JsonValue);
    }

    if (req.method === 'GET' && pathname === '/api/products') {
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q');
      const limit = clamp(toNumberOrDefault(url.searchParams.get('limit'), DEFAULT_LIMIT), 1, MAX_LIMIT);

      const products = await listProducts({ status, q, limit });
      return sendJson(res, 200, products as unknown as JsonValue);
    }

    if (req.method === 'GET' && pathname.startsWith('/api/products/')) {
      const productId = pathname.replace('/api/products/', '').trim();
      if (!productId) return badRequest(res, 'Missing product id');

      const detail = await getProductDetail(productId);
      if (!detail) return notFound(res);
      return sendJson(res, 200, detail as unknown as JsonValue);
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Immediately establish the stream.
      res.write(`retry: ${SSE_INTERVAL_MS}\n\n`);

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sseClients.set(id, { id, res });

      // Send an initial snapshot so the UI can render quickly.
      try {
        const [metrics, products] = await Promise.all([
          getMetrics(),
          listProducts({ limit: DEFAULT_LIMIT }),
        ]);
        sseWriteEvent(res, 'snapshot', {
          serverTime: new Date().toISOString(),
          metrics,
          products,
        });
      } catch (err) {
        sseWriteEvent(res, 'error', { message: String(err) });
      }

      req.on('close', () => {
        sseClients.delete(id);
      });
      return;
    }

    // Static File Serving
    if (req.method === 'GET' && !pathname.startsWith('/api')) {
      // NOTE: `pathname` always starts with "/". On Linux, `path.join(PUBLIC_DIR, "/assets/x")`
      // would ignore `PUBLIC_DIR` (because "/assets/x" is absolute). Always strip the leading
      // slash before resolving.
      const requestedRelPath = (pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')) || 'index.html';

      // Helpful message if the UI hasn't been built locally (dist missing).
      const indexPath = path.resolve(PUBLIC_DIR_RESOLVED, 'index.html');
      if (pathname === '/' && !fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(
          [
            'Dashboard UI is not built yet.',
            '',
            'Build it with:',
            '  npm --prefix dashboard-ui install',
            '  npm --prefix dashboard-ui run build',
            '',
            'Or run the dev server:',
            '  npm --prefix dashboard-ui run dev',
            '  (then open http://localhost:5173)',
            '',
          ].join('\n')
        );
        return;
      }

      let filePath = path.resolve(PUBLIC_DIR_RESOLVED, requestedRelPath);

      // Prevent directory traversal (ensure the resolved path stays under PUBLIC_DIR).
      if (!filePath.startsWith(PUBLIC_DIR_RESOLVED + path.sep)) {
        return notFound(res);
      }

      // SPA fallback: if the request isn't a direct asset (no extension), serve index.html.
      if (!fs.existsSync(filePath)) {
        if (!requestedRelPath.includes('.') && fs.existsSync(indexPath)) {
          filePath = indexPath;
        } else {
          return notFound(res);
        }
      }

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    return notFound(res);
  } catch (err) {
    logger.error(`Dashboard API request failed: ${err}`);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res);
});

server.listen(PORT, () => {
  logger.info(`📊 Dashboard API (read-only) listening on http://localhost:${PORT}`);
  logger.info(`- Health:   http://localhost:${PORT}/api/health`);
  logger.info(`- Metrics:  http://localhost:${PORT}/api/metrics`);
  logger.info(`- Products: http://localhost:${PORT}/api/products`);
  logger.info(`- SSE:      http://localhost:${PORT}/api/events`);
});

process.on('SIGINT', async () => {
  logger.info('Dashboard API shutting down...');
  server.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});


