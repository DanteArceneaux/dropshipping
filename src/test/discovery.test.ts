import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryAgent } from '../services/brain/discovery';
import { openai } from '../shared/llm';
import { loadPrompt } from '../shared/prompts';

// Mock dependencies
vi.mock('../shared/llm');
vi.mock('../shared/prompts');

describe('Discovery Agent', () => {
  let agent: DiscoveryAgent;

  beforeEach(() => {
    agent = new DiscoveryAgent();
    vi.mocked(loadPrompt).mockResolvedValue('You are a viral product expert...');
  });

  it('should analyze a product and return a structured verdict', async () => {
    const mockProduct = {
      id: '123',
      title: 'Magic Chopper',
      externalUrl: 'http://tiktok.com/123',
      rawStats: { views: 100000, likes: 5000 },
      description: 'Cool gadget'
    };

    const mockResponse = {
      product_name: 'Magic Chopper',
      viral_score: 85,
      sentiment_score: 90,
      verdict: 'APPROVE',
      reasoning: 'Good engagement ratio.'
    };

    // Mock OpenAI chat completion
    vi.mocked(openai.chat.completions.create).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockResponse)
          }
        }
      ]
    } as any);

    const result = await agent.analyze(mockProduct);

    expect(result.verdict).toBe('APPROVE');
    expect(result.viral_score).toBe(85);
    expect(openai.chat.completions.create).toHaveBeenCalled();
  });

  it('should handle invalid JSON from LLM gracefully', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValue({
      choices: [{ message: { content: 'Not JSON' } }]
    } as any);

    await expect(agent.analyze({} as any)).rejects.toThrow();
  });
});

