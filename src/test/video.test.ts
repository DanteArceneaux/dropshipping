import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoScriptAgent } from '../services/brain/video';
import { openai } from '../shared/llm';
import { loadPrompt } from '../shared/prompts';

vi.mock('../shared/llm');
vi.mock('../shared/prompts');

describe('Video Script Agent', () => {
  let agent: VideoScriptAgent;

  beforeEach(() => {
    agent = new VideoScriptAgent();
    vi.mocked(loadPrompt).mockResolvedValue('You are a video script writer...');
  });

  it('should generate a structured video script', async () => {
    const mockOutput = {
      scenes: [
        { timestamp: '0:00-0:03', visual: 'Show problem', audio: 'Tired of this?' }
      ]
    };

    vi.mocked(openai.chat.completions.create).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockOutput) } }]
    } as any);

    const result = await agent.generateScript({
      title: 'Product',
      copy: {
        title: 'Title',
        description_md: 'Desc',
        ad_hooks: ['Hook 1']
      }
    });

    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].visual).toBe('Show problem');
  });

  it('should fail cleanly on API errors', async () => {
    vi.mocked(openai.chat.completions.create).mockRejectedValue(new Error('API Down'));

    // Provide minimal valid input to pass initial checks before the API call
    const input = {
      title: 'T',
      copy: { ad_hooks: [], description_md: '' }
    };

    await expect(agent.generateScript(input as any)).rejects.toThrow('API Down');
  });
});

