import React, { useEffect, useMemo, useState } from 'react';
import type { ProductDetail, ProductListItem } from '../types';
import { X, ExternalLink, ShoppingBag, FileText, Link as LinkIcon, Clock } from 'lucide-react';

interface ProductDrawerProps {
  product: ProductListItem | null;
  onClose: () => void;
}

export const ProductDrawer: React.FC<ProductDrawerProps> = ({ product, onClose }) => {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) {
      setDetail(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    setLoading(true);

    fetch(`/api/products/${product.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load product detail (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data as ProductDetail);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  if (!product) return null;

  const view = (detail ?? product) as ProductListItem;
  const title = view.title || 'Untitled';
  const imageUrl = view.images?.[0] || null;
  const statusLabel = view.status.replaceAll('_', ' ');

  const timestamps = useMemo(() => {
    return {
      createdAt: new Date(view.createdAt).toLocaleString(),
      updatedAt: new Date(view.updatedAt).toLocaleString(),
      listedAt: view.listedAt ? new Date(view.listedAt).toLocaleString() : null,
    };
  }, [view.createdAt, view.updatedAt, view.listedAt]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto p-6">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
            {statusLabel}
          </span>
          <span className="text-gray-500 text-sm">
            ID: {view.id}
          </span>
        </div>

        {imageUrl && (
          <div className="mb-6 rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
            <img src={imageUrl} alt={title} className="w-full h-auto" />
          </div>
        )}

        <div className="space-y-6">
          <Section title="Links" icon={<LinkIcon className="w-4 h-4" />}>
            <div className="space-y-2 text-sm">
              <a
                href={view.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium break-all"
              >
                Open Source <ExternalLink className="w-3 h-3" />
              </a>
              {view.supplierUrl && (
                <a
                  href={view.supplierUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium break-all"
                >
                  Open Supplier <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {view.shopifyAdminUrl && (
                <a
                  href={view.shopifyAdminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium break-all"
                >
                  Open in Shopify Admin <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </Section>

          <Section title="Description" icon={<FileText className="w-4 h-4" />}>
            <p className="text-gray-600 whitespace-pre-wrap">{view.description || 'No description available.'}</p>
          </Section>

          <Section title="Sourcing" icon={<ShoppingBag className="w-4 h-4" />}>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cost Price</span>
                <span className="font-medium">${view.costPrice || '-'}</span>
              </div>
            </div>
          </Section>

          <Section title="Scoring" icon={<FileText className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-gray-500 text-xs">Viral Score</div>
                <div className="font-semibold text-gray-900">{view.viralScore}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-gray-500 text-xs">Sentiment</div>
                <div className="font-semibold text-gray-900">{view.sentiment}</div>
              </div>
            </div>
          </Section>

          <Section title="Timeline" icon={<Clock className="w-4 h-4" />}>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium text-gray-800">{timestamps.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span className="font-medium text-gray-800">{timestamps.updatedAt}</span>
              </div>
              {timestamps.listedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Listed</span>
                  <span className="font-medium text-gray-800">{timestamps.listedAt}</span>
                </div>
              )}
            </div>
          </Section>

          <Section title="Agent Logs" icon={<FileText className="w-4 h-4" />}>
            {loading && <div className="text-sm text-gray-500">Loading logs…</div>}
            {loadError && <div className="text-sm text-red-600">{loadError}</div>}

            {detail?.logs?.length ? (
              <div className="space-y-3">
                {detail.logs.map((l) => (
                  <div key={l.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900">{l.agentName}</div>
                      <div className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      <span className="font-medium">{l.decision}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{l.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No logs available.</div>
            )}
          </Section>

          <Section title="Raw Data" icon={<FileText className="w-4 h-4" />}>
             <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto text-gray-600">
               {JSON.stringify(detail ?? product, null, 2)}
             </pre>
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
      {icon} {title}
    </h3>
    {children}
  </div>
);

