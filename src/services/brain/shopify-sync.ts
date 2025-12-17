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

interface SyncProductInput extends CreateProductInput {
  /**
   * If provided, we will update the existing Shopify product instead of creating
   * a new one. This is the key to idempotency.
   */
  existingProductId?: string | null;

  /**
   * Shopify GraphQL GID for the product (gid://shopify/Product/123).
   * If omitted, we will derive it from `existingProductId` when possible.
   */
  existingProductGid?: string | null;

  /**
   * If present, we assume video has already been attached and will skip re-uploading.
   */
  existingVideoMediaId?: string | null;
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

interface ShopifyProductGetResponse {
  product: {
    id: number;
    variants?: Array<{ id: number }>;
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

interface SyncProductResult {
  productId: string;
  productGid: string;
  adminUrl: string;
  videoMediaId: string | null;
}

type GraphqlClient = InstanceType<typeof shopify.clients.Graphql>;

// ============================================================================
// Implementation
// ============================================================================

export class ShopifySyncService {
  /**
   * Backwards-compatible helper. Prefer `syncProduct()` for idempotency.
   */
  async createProduct(data: CreateProductInput): Promise<string> {
    const result = await this.syncProduct(data);
    return result.productId;
  }

  /**
   * Create-or-update Shopify sync entrypoint.
   * - If `existingProductId` is present, we update that product (no duplicates).
   * - Otherwise, we create a new product.
   * Returns IDs and an admin URL that can be stored on the Product record.
   */
  async syncProduct(data: SyncProductInput): Promise<SyncProductResult> {
    logger.info(`Syncing product to Shopify: ${data.title}`);

    if (!session.accessToken) {
      throw new Error('No Shopify access token configured');
    }

    const client = new shopify.clients.Rest({ session });
    const gqlClient = new shopify.clients.Graphql({ session });

    const isUpdate = Boolean(data.existingProductId);

    let productId: string;
    let productGid: string;

    // ------------------------------------------------------------------------
    // 1) Create or Update base product (title/description/vendor)
    // ------------------------------------------------------------------------

    if (isUpdate) {
      const existingId = data.existingProductId as string;

      // Update product basic fields. (We intentionally do NOT overwrite images here
      // to avoid accidental deletions. Images can be a separate step later.)
      await client.put({
        path: `products/${existingId}`,
        data: {
          product: {
            id: Number(existingId),
            title: data.title,
            body_html: data.descriptionHtml,
            vendor: data.vendor,
            product_type: 'Dropship',
          }
        },
        type: DataType.JSON,
      });

      // Update the first variant price if possible.
      try {
        const existing = await client.get({
          path: `products/${existingId}`,
          type: DataType.JSON,
        });
        const existingBody = existing.body as ShopifyProductGetResponse;
        const variantId = existingBody.product.variants?.[0]?.id;

        if (variantId) {
          await client.put({
            path: `variants/${variantId}`,
            data: {
              variant: {
                id: variantId,
                price: data.price,
              }
            },
            type: DataType.JSON,
          });
        }
      } catch (variantErr) {
        logger.warn(`Failed to update variant price for product ${existingId}: ${variantErr}`);
      }

      productId = existingId;
      productGid = data.existingProductGid || `gid://shopify/Product/${existingId}`;

      logger.info(`Successfully updated Shopify product (Base): ${productId}`);

    } else {
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
      productId = body.product.id.toString();
      productGid = body.product.admin_graphql_api_id;

      logger.info(`Successfully created Shopify product (Base): ${productId}`);
    }

    const adminUrl = this.buildAdminUrl(productId);

    // ------------------------------------------------------------------------
    // 2) Attach video (only if we have not already attached one)
    // ------------------------------------------------------------------------

    let videoMediaId: string | null = data.existingVideoMediaId || null;

    if (data.videoPath && !videoMediaId) {
      let videoUrl: string | null = null;
      try {
        videoUrl = await this.uploadVideo(gqlClient, data.videoPath);
      } catch (err) {
        logger.error(`Video upload failed, proceeding without video: ${err}`);
      }

      if (videoUrl) {
        const attached = await this.attachVideoToProduct(gqlClient, productGid, videoUrl);
        videoMediaId = attached;
      }
    }

    return {
      productId,
      productGid,
      adminUrl,
      videoMediaId,
    };
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
  ): Promise<string | null> {
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
      return null;
    } else {
      logger.info('Video attached successfully!');
      return result.data.productCreateMedia.media?.[0]?.id ?? null;
    }
  }

  private buildAdminUrl(productId: string): string {
    // `session.shop` is stored without protocol in our shared shopify session.
    // Example: "my-store.myshopify.com"
    const shopDomain = session.shop || process.env.SHOPIFY_SHOP_DOMAIN || '';
    const clean = shopDomain.replace(/^https?:\/\//, '');
    return `https://${clean}/admin/products/${productId}`;
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
