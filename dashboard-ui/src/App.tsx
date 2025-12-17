import React, { useMemo, useState } from 'react';
import { useProductStream } from './hooks/useProductStream';
import { ProductCard } from './components/ProductCard';
import { ProductDrawer } from './components/ProductDrawer';
import type { ProductListItem, ProductStatus } from './types';
import { Activity, Package, CheckCircle, XCircle, Film, ShoppingBag } from 'lucide-react';

type ColumnId = 'discovered' | 'sourcing' | 'creative' | 'published' | 'rejected';

const COLUMNS: { id: ColumnId; title: string; icon: React.ReactNode; statuses: ProductStatus[] }[] = [
  { 
    id: 'discovered', 
    title: 'Detected', 
    icon: <Package className="w-4 h-4" />, 
    statuses: ['DETECTED'] 
  },
  { 
    id: 'sourcing', 
    title: 'Vetting + Sourcing', 
    icon: <ShoppingBag className="w-4 h-4" />, 
    statuses: ['VETTED', 'APPROVED'] 
  },
  { 
    id: 'creative', 
    title: 'Creative', 
    icon: <Film className="w-4 h-4" />, 
    statuses: ['READY_FOR_VIDEO', 'READY_TO_LIST'] 
  },
  { 
    id: 'published', 
    title: 'Listed', 
    icon: <CheckCircle className="w-4 h-4 text-green-600" />, 
    statuses: ['LISTED'] 
  },
  { 
    id: 'rejected', 
    title: 'Rejected', 
    icon: <XCircle className="w-4 h-4 text-red-500" />, 
    statuses: ['REJECTED'] 
  },
];

function App() {
  const { products, metrics, connected } = useProductStream();
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null);

  const columns = useMemo(() => {
    const acc: Record<ColumnId, ProductListItem[]> = {
      discovered: [],
      sourcing: [],
      creative: [],
      published: [],
      rejected: []
    };

    products.forEach(product => {
      const column = COLUMNS.find(c => c.statuses.includes(product.status));
      if (column) {
        acc[column.id].push(product);
      }
    });

    return acc;
  }, [products]);

  const totalProducts = useMemo(() => {
    if (!metrics) return products.length;
    return Object.values(metrics.productCountsByStatus).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  }, [metrics, products.length]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Dropshipping Pipeline</h1>
          <div className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {connected ? 'Live' : 'Disconnected'}
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-500">
           <div className="flex flex-col items-end">
             <span className="text-xs text-gray-400">Total Products</span>
             <span className="font-bold text-gray-900">{totalProducts}</span>
           </div>
           <div className="h-8 w-px bg-gray-200" />
           {/* Simple Queue Metrics */}
           <div className="flex gap-4">
              {Object.entries(metrics?.queueLengths || {}).map(([q, len]) => (
                len > 0 && (
                  <div key={q} className="flex flex-col items-center">
                    <span className="text-xs text-gray-400 uppercase">{q.replace('queue:', '')}</span>
                    <span className="font-medium text-blue-600">{len}</span>
                  </div>
                )
              ))}
           </div>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="h-full flex p-6 gap-6 min-w-max">
          {COLUMNS.map(col => (
            <div key={col.id} className="w-80 flex flex-col h-full bg-gray-100/50 rounded-xl border border-gray-200/60">
              <div className="p-4 flex items-center justify-between border-b border-gray-200/60 bg-white/50 rounded-t-xl">
                <div className="flex items-center gap-2 font-medium text-gray-700">
                  {col.icon}
                  {col.title}
                </div>
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {columns[col.id].length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {columns[col.id].map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onClick={setSelectedProduct} 
                  />
                ))}
                {columns[col.id].length === 0 && (
                  <div className="h-24 flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 rounded-lg">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <ProductDrawer 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
}

export default App;
