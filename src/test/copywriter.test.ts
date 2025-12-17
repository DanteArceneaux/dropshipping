import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopywriterAgent } from '../services/brain/copywriter';
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

describe('Copywriter Agent', () => {
  let agent: CopywriterAgent;

  beforeEach(() => {
    agent = new CopywriterAgent();
    vi.mocked(loadPrompt).mockResolvedValue('You are a copywriter...');
  });

  it('should generate valid copywriting content', async () => {
    const mockOutput = {
      title: 'Revolutionary Gadget',
      description_md: '# Best Thing Ever\n\nBuy it now.',
      ad_hooks: ['Hook 1', 'Hook 2', 'Hook 3']
    };

    vi.mocked(llm.generateText).mockResolvedValue(JSON.stringify(mockOutput));

    const result = await agent.generateCopy({
      title: 'Raw Title',
      description: 'Raw Desc'
    });

    expect(result.title).toBe('Revolutionary Gadget');
    expect(result.ad_hooks).toHaveLength(3);
    expect(result.description_md).toContain('Best Thing Ever');
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(llm.generateText).mockRejectedValue(new Error('API Error'));

    await expect(agent.generateCopy({ title: 'T', description: 'D' }))
      .rejects.toThrow('API Error');
  });
});
