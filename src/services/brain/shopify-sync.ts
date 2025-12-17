import { shopify, session } from '../../shared/shopify';
import { logger } from '../../shared/logger';
import { CopywritingResult } from './copywriter';
import fs from 'fs';
import path from 'path';
import { DataType } from '@shopify/shopify-api';

export class ShopifySyncService {
  async createProduct(data: {
    title: string;
    descriptionHtml: string;
    price: string;
    vendor: string;
    images: string[];
    videoPath?: string;
  }): Promise<string> {
    logger.info(`Syncing product to Shopify: ${data.title}`);

    if (!session.accessToken) {
      throw new Error('No Shopify access token configured');
    }

    const client = new shopify.clients.Rest({ session });
    const gqlClient = new shopify.clients.Graphql({ session });

    let videoUrl: string | null = null;
    if (data.videoPath) {
      try {
        videoUrl = await this.uploadVideo(gqlClient, data.videoPath);
      } catch (err) {
        logger.error(`Video upload failed, proceeding without video: ${err}`);
      }
    }

    try {
      // Create product with REST (simpler for basic fields)
      // Then add media if needed, or use GraphQL for everything.
      // Mixing REST and GraphQL is fine.
      
      const productData: any = {
        title: data.title,
        body_html: data.descriptionHtml,
        vendor: data.vendor,
        product_type: 'Dropship',
        images: data.images.map(src => ({ src })),
        variants: [
          {
            price: data.price,
            inventory_management: null,
            requires_shipping: true,
          }
        ]
      };

      const response = await client.post({
        path: 'products',
        data: { product: productData },
        type: DataType.JSON,
      });

      const product = (response.body as any).product;
      const productId = product.id;
      logger.info(`Successfully created Shopify product (Base): ${productId}`);

      // If we have a video, we need to attach it.
      // We can't easily attach video in the initial REST Create call (it only takes image URLs).
      // So we use GraphQL to append the media.
      if (videoUrl) {
        await this.attachVideoToProduct(gqlClient, product.admin_graphql_api_id, videoUrl);
      }

      return productId.toString();

    } catch (error) {
      logger.error(`Shopify sync failed: ${error}`);
      throw error;
    }
  }

  private async uploadVideo(client: any, videoPath: string): Promise<string> {
    logger.info(`Starting video upload for ${videoPath}`);
    const stats = fs.statSync(videoPath);
    const fileSize = stats.size.toString();
    const filename = path.basename(videoPath);
    const mimeType = 'video/mp4';

    // 1. Staged Uploads Create
    const stagedUploadsQuery = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
        }
      }
    `;

    const stagedResult = await client.request(stagedUploadsQuery, {
      variables: {
        input: [{
          resource: 'VIDEO',
          filename,
          mimeType,
          fileSize,
          httpMethod: 'POST'
        }]
      }
    });

    const target = stagedResult.data.stagedUploadsCreate.stagedTargets[0];
    const { url, parameters, resourceUrl } = target;

    // 2. Upload File
    const formData = new FormData();
    parameters.forEach((p: any) => formData.append(p.name, p.value));
    
    // Read file as Blob for fetch (Node 20+)
    const fileBuffer = fs.readFileSync(videoPath);
    const fileBlob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', fileBlob, filename);

    const uploadResponse = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to staged target: ${uploadResponse.statusText}`);
    }

    // 3. Return the resourceUrl directly (skipping fileCreate)
    // This URL can be passed to productCreateMedia as originalSource
    logger.info(`Video uploaded to staging URL: ${resourceUrl.substring(0, 50)}...`);
    return resourceUrl;
  }

  private async attachVideoToProduct(client: any, productId: string, videoUrl: string) {
    logger.info(`Attaching video from staging to product ${productId}`);
    
    const mutation = `
      mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
        productCreateMedia(media: $media, productId: $productId) {
          media {
            id
            status
          }
          mediaUserErrors {
            field
            message
          }
        }
      }
    `;

    const result = await client.request(mutation, {
      variables: {
        productId,
        media: [{
          originalSource: videoUrl,
          mediaContentType: 'VIDEO'
        }]
      }
    });

    const data = result.data.productCreateMedia;
    if (data.mediaUserErrors.length > 0) {
      logger.warn(`Failed to attach video: ${JSON.stringify(data.mediaUserErrors)}`);
    } else {
      logger.info('Video attached successfully!');
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
