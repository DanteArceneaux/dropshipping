import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourcingAgent } from '../services/brain/sourcing';
import { MockSupplierSearch } from '../services/brain/supplier-search';
import * as llm from '../shared/llm';
import { loadPrompt } from '../shared/prompts';

vi.mock('../shared/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/llm')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});
vi.mock('../shared/prompts');

describe('Sourcing Agent', () => {
  let agent: SourcingAgent;
  let mockSearch: MockSupplierSearch;

  beforeEach(() => {
    mockSearch = new MockSupplierSearch();
    agent = new SourcingAgent(mockSearch);
    vi.mocked(loadPrompt).mockResolvedValue('You are a sourcing agent...');
  });

  it('should approve a good supplier', async () => {
    const mockDecision = {
      supplier_url: 'https://good-supplier.com',
      cost_price: 5.00,
      shipping_time_days: '10-15',
      supplier_rating: 4.8,
      is_verified: true
    };

    vi.mocked(llm.generateText).mockResolvedValue(JSON.stringify(mockDecision));

    const result = await agent.source({ title: 'Test Product' });

    expect(result.verdict).toBe('APPROVED');
    expect(result.costPrice).toBe(5.00);
    expect(result.supplierUrl).toBe('https://good-supplier.com');
  });

  it('should reject if LLM finds no suitable supplier', async () => {
    const mockDecision = {
      supplier_url: null,
      is_verified: false,
      reasoning: 'All suppliers too slow'
    };

    vi.mocked(llm.generateText).mockResolvedValue(JSON.stringify(mockDecision));

    const result = await agent.source({ title: 'Hard to find product' });

    expect(result.verdict).toBe('REJECTED');
    expect(result.supplierUrl).toBeNull();
  });
});
