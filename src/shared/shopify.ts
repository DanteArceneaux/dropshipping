import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import { logger } from './logger';

const shopUrl = process.env.SHOPIFY_SHOP_URL;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

if (!shopUrl || !accessToken) {
  logger.warn('SHOPIFY credentials are not set. Product syncing will fail.');
}

export const shopify = shopifyApi({
  apiKey: 'dummy', // Not needed for Admin API access token
  apiSecretKey: 'dummy',
  scopes: ['write_products', 'read_products'],
  hostName: shopUrl ? shopUrl.replace('https://', '') : 'localhost',
  apiVersion: ApiVersion.January24,
  isEmbeddedApp: false,
});

export const session = new Session({
  id: 'offline_session',
  shop: shopUrl ? shopUrl.replace('https://', '') : 'localhost',
  state: 'state',
  isOnline: false,
  accessToken: accessToken,
});

