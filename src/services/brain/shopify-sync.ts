import { shopify, session } from '../../shared/shopify';
import { logger } from '../../shared/logger';
import { CopywritingResult } from './copywriter';

export class ShopifySyncService {
  async createProduct(data: {
    title: string;
    descriptionHtml: string;
    price: string;
    vendor: string;
    images: string[];
  }): Promise<string> {
    logger.info(`Syncing product to Shopify: ${data.title}`);

    if (!session.accessToken) {
      throw new Error('No Shopify access token configured');
    }

    const client = new shopify.clients.Rest({ session });

    try {
      const response = await client.post({
        path: 'products',
        data: {
          product: {
            title: data.title,
            body_html: data.descriptionHtml,
            vendor: data.vendor,
            product_type: 'Dropship',
            images: data.images.map(src => ({ src })),
            variants: [
              {
                price: data.price,
                inventory_management: null, // Don't track inventory for dropshipping
                requires_shipping: true,
              }
            ]
          }
        },
        type: 'application/json',
      });

      const product = (response.body as any).product;
      logger.info(`Successfully created Shopify product: ${product.id}`);
      return product.id.toString();

    } catch (error) {
      logger.error(`Shopify sync failed: ${error}`);
      throw error;
    }
  }

  // Helper to convert Markdown to simple HTML (simplified for MVP)
  convertMarkdownToHtml(markdown: string): string {
    // Very basic converter. In production, use 'marked' or 'showdown'
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br />');
  }
}

