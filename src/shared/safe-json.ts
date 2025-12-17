import { logger } from './logger';

interface SafeJsonParseOptions {
  /**
   * Included in logs/errors to make debugging much easier.
   * Example: "DiscoveryAgent" / "SourcingAgent"
   */
  context?: string;

  /**
   * How many characters of the raw LLM output we include in error logs.
   */
  maxLogChars?: number;
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();

  // Handles:
  // ```json
  // { ... }
  // ```
  // as well as ```text / ``` with no language
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    const fenceStart = firstNewline === -1 ? 0 : firstNewline + 1;
    const lastFence = trimmed.lastIndexOf('```');
    if (lastFence > fenceStart) {
      return trimmed.slice(fenceStart, lastFence).trim();
    }
  }

  return trimmed;
}

function extractFirstJsonValue(raw: string): string | null {
  const text = raw;

  for (let startIdx = 0; startIdx < text.length; startIdx++) {
    const start = text[startIdx];
    if (start !== '{' && start !== '[') continue;

    const stack: Array<'{' | '['> = [start];
    let inString = false;
    let escaped = false;

    for (let i = startIdx + 1; i < text.length; i++) {
      const c = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (c === '\\') {
          escaped = true;
          continue;
        }
        if (c === '"') {
          inString = false;
          continue;
        }
        continue;
      }

      if (c === '"') {
        inString = true;
        continue;
      }

      if (c === '{' || c === '[') {
        stack.push(c);
        continue;
      }

      if (c === '}' || c === ']') {
        const last = stack[stack.length - 1];
        const isMatch = (c === '}' && last === '{') || (c === ']' && last === '[');
        if (!isMatch) {
          // Mismatched braces; abandon this start position and keep searching.
          break;
        }

        stack.pop();
        if (stack.length === 0) {
          return text.slice(startIdx, i + 1);
        }
      }
    }
  }

  return null;
}

export function safeJsonParse<T = unknown>(
  raw: string,
  options: SafeJsonParseOptions = {}
): T {
  const { context, maxLogChars = 2000 } = options;

  const cleaned = stripCodeFences(raw);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const extracted = extractFirstJsonValue(cleaned);
    if (extracted) {
      try {
        return JSON.parse(extracted) as T;
      } catch {
        // fall through to error below
      }
    }

    const prefix = context ? `[safeJsonParse:${context}]` : '[safeJsonParse]';
    const preview = cleaned.length > maxLogChars ? `${cleaned.slice(0, maxLogChars)}…` : cleaned;

    // Log once here to keep call-sites clean, then throw.
    logger.error(`${prefix} Failed to parse JSON. Raw output (truncated):\n${preview}`);
    throw new Error(`${prefix} Failed to parse JSON from LLM output`);
  }
}

