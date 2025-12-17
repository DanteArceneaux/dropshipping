import React from 'react';
import type { ProductListItem } from '../types';
import { ExternalLink, DollarSign, Store } from 'lucide-react';

interface ProductCardProps {
  product: ProductListItem;
  onClick: (product: ProductListItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const title = product.title || 'Untitled';
  const imageUrl = product.images?.[0] || null;
  const statusLabel = product.status.replaceAll('_', ' ');

  return (
    <div 
      onClick={() => onClick(product)}
      className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900 truncate flex-1" title={title}>
          {title}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(product.status)}`}>
          {statusLabel}
        </span>
      </div>
      
      {imageUrl && (
        <div className="mb-2 aspect-video bg-gray-100 rounded overflow-hidden">
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-center text-xs text-gray-500 gap-3">
        {product.costPrice && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {product.costPrice}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {product.supplierUrl && (
            <span title="Supplier link available">
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </span>
          )}
          {product.shopifyAdminUrl && (
            <span title="Listed on Shopify">
              <Store className="w-3 h-3 text-green-600" />
            </span>
          )}
        </div>
      </div>

      {product.lastLog && (
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">{product.lastLog.agentName}</span>: {product.lastLog.decision}
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-400">
        ID: {product.id.slice(0, 8)}
      </div>
    </div>
  );
};

function getStatusColor(status: string) {
  if (status.includes('REJECTED')) return 'bg-red-100 text-red-800';
  if (status.includes('LISTED')) return 'bg-green-100 text-green-800';
  if (status.includes('APPROVED')) return 'bg-blue-100 text-blue-800';
  if (status.includes('VETTED')) return 'bg-indigo-100 text-indigo-800';
  return 'bg-gray-100 text-gray-800';
}

