export interface SupplierResult {
  url: string;
  price: number;
  shippingDays: { min: number; max: number };
  rating: number; // 0-5
  storeAgeYears: number;
  image: string;
}

export interface SupplierSearchService {
  findSuppliersByImage(imageUrl: string): Promise<SupplierResult[]>;
}

export class MockSupplierSearch implements SupplierSearchService {
  async findSuppliersByImage(imageUrl: string): Promise<SupplierResult[]> {
    // Return a mix of good and bad suppliers to test filtering logic
    return [
      {
        url: 'https://aliexpress.com/item/good-supplier',
        price: 5.00,
        shippingDays: { min: 10, max: 15 },
        rating: 4.8,
        storeAgeYears: 3,
        image: 'http://img.ali/good.jpg'
      },
      {
        url: 'https://aliexpress.com/item/bad-shipping',
        price: 3.00,
        shippingDays: { min: 30, max: 50 }, // Should be rejected
        rating: 4.5,
        storeAgeYears: 2,
        image: 'http://img.ali/slow.jpg'
      },
      {
        url: 'https://aliexpress.com/item/bad-rating',
        price: 4.50,
        shippingDays: { min: 10, max: 15 },
        rating: 2.1, // Should be rejected
        storeAgeYears: 1,
        image: 'http://img.ali/bad.jpg'
      }
    ];
  }
}

