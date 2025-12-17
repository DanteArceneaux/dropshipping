import { generateText } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';
import { SupplierSearchService } from './supplier-search';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SourcingResult {
  supplierUrl: string | null;
  costPrice: number | null;
  verdict: 'APPROVED' | 'REJECTED';
  reasoning: string;
}

interface SourcingInput {
  title: string;
  imageUrl?: string;
}

interface LLMSourcingDecision {
  supplier_url?: string;
  cost_price?: number;
  is_verified?: boolean;
  supplier_rating?: number;
  shipping_time_days?: string;
  reasoning?: string;
}

// ============================================================================
// Implementation
// ============================================================================

export class SourcingAgent {
  constructor(private readonly searchService: SupplierSearchService) {}

  async source(product: SourcingInput): Promise<SourcingResult> {
    logger.info(`Sourcing suppliers for: ${product.title}`);

    // Step 1: Find potential suppliers via image search
    const imageUrl = product.imageUrl;
    if (!imageUrl) {
      // We can't do visual sourcing without an image URL. Using a dummy URL would
      // waste API calls and create confusing errors downstream.
      return this.createRejection('Missing image URL. Cannot run supplier image search.');
    }
    const candidates = await this.searchService.findSuppliersByImage(imageUrl);

    if (candidates.length === 0) {
      return this.createRejection('No suppliers found via image search.');
    }

    // Step 2: LLM Evaluation to select best supplier
    try {
      const decision = await this.evaluateCandidates(product.title, candidates);
      return this.processDecision(decision);
    } catch (error) {
      logger.error(`Sourcing analysis failed: ${error}`);
      throw error;
    }
  }

  private async evaluateCandidates(
    productTitle: string,
    candidates: unknown[]
  ): Promise<LLMSourcingDecision> {
    const systemPrompt = await loadPrompt('Sourcing');

    const userContent = `
    Product: ${productTitle}
    
    Here are the found suppliers:
    ${JSON.stringify(candidates)}

    Select the best supplier that meets the criteria.
    CRITICAL INSTRUCTION:
    If there is at least one supplier with a valid URL, APPROVE it.
    Be lenient on shipping times and ratings for this phase.
    We prioritize having a supplier over having no supplier.
    
    Return JSON format as specified in the system prompt.
    `;

    const content = await generateText(systemPrompt, userContent, 'SMART', true);
    return JSON.parse(content) as LLMSourcingDecision;
  }

  private processDecision(decision: LLMSourcingDecision): SourcingResult {
    // Some models omit optional fields (like `is_verified`) even when they mean
    // "approve". Default to `true` if a supplier URL is present.
    const isVerified = decision.is_verified ?? true;

    if (decision.supplier_url && isVerified) {
      return {
        supplierUrl: decision.supplier_url,
        costPrice: decision.cost_price ?? null,
        verdict: 'APPROVED',
        reasoning: `Selected supplier with rating ${decision.supplier_rating ?? 'N/A'} and shipping ${decision.shipping_time_days ?? 'N/A'}`
      };
    }

    return this.createRejection(decision.reasoning || 'No suitable supplier found.');
  }

  private createRejection(reasoning: string): SourcingResult {
    return {
      supplierUrl: null,
      costPrice: null,
      verdict: 'REJECTED',
      reasoning
    };
  }
}

