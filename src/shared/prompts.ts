import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

// Cache prompts in memory
let promptCache: Record<string, string> = {};

export async function loadPrompt(agentName: 'Discovery' | 'Sourcing' | 'Copywriter' | 'Video'): Promise<string> {
  if (promptCache[agentName]) {
    return promptCache[agentName];
  }

  try {
    const promptsPath = path.resolve(process.cwd(), 'PROMPTS.md');
    const content = await fs.readFile(promptsPath, 'utf-8');

    // Simple parser to extract code blocks under headings
    // Looks for "## [Number]. [Agent Name]" and extracts the code block below it
    const regex = new RegExp(`## \\d+\\. ${agentName}.*?\\n\\*\\*Role:.*?[\\s\\S]*?\`\`\`text\\n([\\s\\S]*?)\\n\`\`\``, 'i');
    const match = content.match(regex);

    if (match && match[1]) {
      const prompt = match[1].trim();
      promptCache[agentName] = prompt;
      return prompt;
    }

    throw new Error(`Could not find prompt for agent: ${agentName}`);
  } catch (error) {
    logger.error(`Failed to load prompt: ${error}`);
    throw error;
  }
}

