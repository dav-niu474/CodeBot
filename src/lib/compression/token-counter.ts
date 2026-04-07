// ============================================================
// Token Estimation
// Simple character-based token estimation (no tiktoken dependency)
// ============================================================

/**
 * Estimate token count for text.
 * Rules:
 *  - English text: ~4 chars per token
 *  - CJK characters: ~1.5 chars per token (each CJK char ≈ 0.67 tokens)
 *  - Code symbols (braces, brackets, etc.): ~0.3 tokens per char
 *  - Remaining characters: ~4 chars per token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Detect CJK characters (Chinese, Japanese, Korean)
  const cjkMatches = text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Detect code symbols
  const codeMatches = text.match(/[{}()\[\];:]/g);
  const codeCount = codeMatches ? codeMatches.length : 0;

  const remaining = text.length - cjkCount - codeCount;

  // CJK: ~0.67 tokens per char, code symbols: ~0.33 tokens per char, rest: ~0.25 tokens per char
  return Math.ceil(cjkCount * 0.67 + codeCount * 0.33 + remaining * 0.25);
}

/** Estimate tokens for an array of messages */
export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}
