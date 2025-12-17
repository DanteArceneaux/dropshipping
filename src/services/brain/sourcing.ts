import { generateText, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';
import { SupplierSearchService, SupplierResult } from './supplier-search';
import { SerpApiSupplierSearch } from './serpapi-sourcing';

export interface SourcingResult {
  supplierUrl: string | null;
  costPrice: number | null;
  verdict: 'APPROVED' | 'REJECTED';
  reasoning: string;
}

export class SourcingAgent {
  constructor(private searchService: SupplierSearchService = new SerpApiSupplierSearch()) {}

  async source(product: { title: string; imageUrl?: string }): Promise<SourcingResult> {
    logger.info(`Sourcing suppliers for: ${product.title}`);

    // 1. Find potential suppliers
    // In real app, we'd use the actual product image. Mock uses dummy URL.
    const candidates = await this.searchService.findSuppliersByImage(product.imageUrl || 'dummy_img_url');

    if (candidates.length === 0) {
      return {
        supplierUrl: null,
        costPrice: null,
        verdict: 'REJECTED',
        reasoning: 'No suppliers found via image search.'
      };
    }

    // 2. LLM Evaluation
    const systemPrompt = await loadPrompt('Sourcing');
    
    // We ask the LLM to pick the best one from the list based on the criteria in PROMPTS.md
    const userContent = `
    Product: ${product.title}
    
    Here are the found suppliers:
    ${JSON.stringify(candidates)}

    Select the best supplier that meets the criteria (Speed > Price).
    If none meet the criteria (e.g. shipping > 30 days), reject all.
    
    Return JSON format as specified in the system prompt.
    `;

    try {
      const content = await generateText(systemPrompt, userContent, 'SMART', true);

      const decision = JSON.parse(content);

      // Map LLM response to our internal result format
      // The prompt asks for { supplier_url, cost_price, is_verified ... }
      if (decision.supplier_url && decision.is_verified) {
        return {
          supplierUrl: decision.supplier_url,
          costPrice: decision.cost_price,
          verdict: 'APPROVED',
          reasoning: `Selected supplier with rating ${decision.supplier_rating} and shipping ${decision.shipping_time_days}`
        };
      } else {
        return {
          supplierUrl: null,
          costPrice: null,
          verdict: 'REJECTED',
          reasoning: decision.reasoning || 'No suitable supplier found.'
        };
      }

    } catch (error) {
      logger.error(`Sourcing analysis failed: ${error}`);
      throw error;
    }
  }
}

