import { shopify, session } from '../../shared/shopify';
import { logger } from '../../shared/logger';
import fs from 'fs';
import path from 'path';
import { DataType } from '@shopify/shopify-api';

// ============================================================================
// Type Definitions
// ============================================================================

interface CreateProductInput {
  title: string;
  descriptionHtml: string;
  price: string;
  vendor: string;
  images: string[];
  videoPath?: string;
}

interface ShopifyProductData {
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  images: Array<{ src: string }>;
  variants: Array<{
    price: string;
    inventory_management: null;
    requires_shipping: boolean;
  }>;
}

interface ShopifyProductResponse {
  product: {
    id: number;
    admin_graphql_api_id: string;
  };
}

interface StagedUploadTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
}

interface StagedUploadsCreateResponse {
  data: {
    stagedUploadsCreate: {
      stagedTargets: StagedUploadTarget[];
    };
  };
}

interface ProductCreateMediaResponse {
  data: {
    productCreateMedia: {
      media: Array<{ id: string; status: string }>;
      mediaUserErrors: Array<{ field: string[]; message: string }>;
    };
  };
}

type GraphqlClient = InstanceType<typeof shopify.clients.Graphql>;

// ============================================================================
// Implementation
// ============================================================================

export class ShopifySyncService {
  async createProduct(data: CreateProductInput): Promise<string> {
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
      const productData: ShopifyProductData = {
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

      const body = response.body as ShopifyProductResponse;
      const productId = body.product.id;
      const adminGqlId = body.product.admin_graphql_api_id;
      
      logger.info(`Successfully created Shopify product (Base): ${productId}`);

      if (videoUrl) {
        await this.attachVideoToProduct(gqlClient, adminGqlId, videoUrl);
      }

      return productId.toString();

    } catch (error) {
      logger.error(`Shopify sync failed: ${error}`);
      throw error;
    }
  }

  private async uploadVideo(client: GraphqlClient, videoPath: string): Promise<string> {
    logger.info(`Starting video upload for ${videoPath}`);
    
    const stats = fs.statSync(videoPath);
    const fileSize = stats.size.toString();
    const filename = path.basename(videoPath);
    const mimeType = 'video/mp4';

    // Step 1: Get staged upload URL
    const target = await this.createStagedUpload(client, { filename, mimeType, fileSize });
    
    // Step 2: Upload file to staging URL
    await this.uploadToStagingUrl(target, videoPath, mimeType, filename);

    logger.info(`Video uploaded to staging URL: ${target.resourceUrl.substring(0, 50)}...`);
    return target.resourceUrl;
  }

  private async createStagedUpload(
    client: GraphqlClient,
    params: { filename: string; mimeType: string; fileSize: string }
  ): Promise<StagedUploadTarget> {
    const query = `
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

    const result = await client.request(query, {
      variables: {
        input: [{
          resource: 'VIDEO',
          filename: params.filename,
          mimeType: params.mimeType,
          fileSize: params.fileSize,
          httpMethod: 'POST'
        }]
      }
    }) as StagedUploadsCreateResponse;

    const target = result.data.stagedUploadsCreate.stagedTargets[0];
    if (!target) {
      throw new Error('Failed to get staged upload target');
    }
    
    return target;
  }

  private async uploadToStagingUrl(
    target: StagedUploadTarget,
    videoPath: string,
    mimeType: string,
    filename: string
  ): Promise<void> {
    const formData = new FormData();
    
    for (const param of target.parameters) {
      formData.append(param.name, param.value);
    }

    const fileBuffer = fs.readFileSync(videoPath);
    const fileBlob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', fileBlob, filename);

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to staged target: ${uploadResponse.statusText}`);
    }
  }

  private async attachVideoToProduct(
    client: GraphqlClient,
    productId: string,
    videoUrl: string
  ): Promise<void> {
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
    }) as ProductCreateMediaResponse;

    const { mediaUserErrors } = result.data.productCreateMedia;
    
    if (mediaUserErrors.length > 0) {
      logger.warn(`Failed to attach video: ${JSON.stringify(mediaUserErrors)}`);
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
