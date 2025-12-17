import { useEffect, useState } from 'react';
import type { DashboardMetrics, ProductListItem, SseSnapshotEvent } from '../types';

export function useProductStream() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initial fetch
    fetch('/api/products?limit=100')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(console.error);

    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(console.error);

    // SSE Setup
    const es = new EventSource('/api/events');

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    // The API emits a periodic full "snapshot" (metrics + product list).
    // This is intentionally simple and robust vs. diff-based incremental updates.
    es.addEventListener('snapshot', (e) => {
      const snapshot = JSON.parse((e as MessageEvent).data) as SseSnapshotEvent;
      setProducts(snapshot.products);
      setMetrics(snapshot.metrics);
    });

    return () => es.close();
  }, []);

  return { products, metrics, connected };
}

