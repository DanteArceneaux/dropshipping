import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import { logger } from './logger';

const shop = process.env.SHOPIFY_SHOP_DOMAIN;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

if (!shop || !accessToken) {
  logger.warn('SHOPIFY credentials are not set. Product syncing will fail.');
}

export const shopify = shopifyApi({
  apiKey: 'dummy', // Not needed for Admin API access token
  apiSecretKey: 'dummy',
  scopes: ['write_products', 'read_products', 'write_files', 'read_files'],
  hostName: shop ? shop.replace('https://', '') : 'localhost',
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: false,
});

export const session = new Session({
  id: 'offline_session',
  shop: shop ? shop.replace('https://', '') : 'localhost',
  state: 'state',
  isOnline: false,
  accessToken: accessToken,
});

