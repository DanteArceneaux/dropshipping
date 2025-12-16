import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopifySyncService } from '../services/brain/shopify-sync';
import { shopify } from '../shared/shopify';

// Mock the Shopify client
const mockPost = vi.fn();
vi.mock('../shared/shopify', async () => {
  const actual = await vi.importActual('../shared/shopify');
  return {
    ...actual,
    session: { accessToken: 'fake_token' },
    shopify: {
      clients: {
        Rest: class {
          constructor() {}
          post = mockPost;
        }
      }
    }
  };
});

describe('Shopify Sync Service', () => {
  let service: ShopifySyncService;

  beforeEach(() => {
    service = new ShopifySyncService();
    mockPost.mockReset();
  });

  it('should create a product via Shopify API', async () => {
    mockPost.mockResolvedValue({
      body: {
        product: { id: 123456789 }
      }
    });

    const result = await service.createProduct({
      title: 'Test Product',
      descriptionHtml: '<p>Desc</p>',
      price: '19.99',
      vendor: 'Test Vendor',
      images: ['http://img.com/1.jpg']
    });

    expect(result).toBe('123456789');
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({
      path: 'products',
      data: expect.objectContaining({
        product: expect.objectContaining({
          title: 'Test Product',
          variants: expect.arrayContaining([
            expect.objectContaining({ price: '19.99' })
          ])
        })
      })
    }));
  });

  it('should convert markdown to simple HTML', () => {
    const md = '# Header\n- Item 1';
    const html = service.convertMarkdownToHtml(md);
    expect(html).toContain('<h1>Header</h1>');
    expect(html).toContain('<li>Item 1</li>');
  });
});
