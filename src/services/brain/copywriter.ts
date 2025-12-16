import { openai, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';

export interface CopywritingResult {
  title: string;
  description_md: string;
  ad_hooks: string[];
}

export class CopywriterAgent {
  async generateCopy(product: { title: string; description: string }): Promise<CopywritingResult> {
    logger.info(`Generating copy for: ${product.title}`);

    const systemPrompt = await loadPrompt('Copywriter');
    
    const userContent = `
    Product Title: ${product.title}
    Product Description: ${product.description}
    
    Generate high-converting copy using the PAS framework.
    Return JSON format: { "title": "...", "description_md": "...", "ad_hooks": ["...", "...", "..."] }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: MODELS.SMART, // Creative writing needs GPT-4
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8, // Slightly higher temp for creativity
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response from LLM');

      const result = JSON.parse(content) as CopywritingResult;
      
      return result;

    } catch (error) {
      logger.error(`Copywriting generation failed: ${error}`);
      throw error;
    }
  }
}

