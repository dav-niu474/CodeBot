// ============================================================
// Token Compression Engine — Main Orchestrator
// V3.5.0: Automatically selects the best compression strategy
// ============================================================

import { estimateTokens, estimateMessagesTokens } from './token-counter';
import type { CompressionConfig, CompressionResult, CompressionType } from './types';
import { snipCompress } from './snip';
import { autoCompress } from './auto';
import { responsiveCompress } from './responsive';
import { microCompress } from './micro';

// ────────────────────────────────────────────
// Default Configuration
// ────────────────────────────────────────────

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxContextTokens: 100000,    // ~100K tokens context window
  systemPromptTokens: 500,     // System prompt budget
  responseTokens: 8192,        // Max tokens for response
  historyBudget: 100000 - 500 - 8192, // ~91.3K for history
  snipAfterMessages: 10,       // Keep last 10 messages intact for snip
  autoThresholdTokens: 65000,  // Trigger auto compression at 65K
  autoTargetRatio: 0.4,        // Target 40% of original after compression
  maxCompressBatch: 10,        // Max messages to compress at once
  minMessagesForCompression: 8,
};

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Main compression entry point.
 * Automatically selects the appropriate strategy based on context.
 *
 * @param messages - The conversation messages to compress
 * @param config - Optional partial config overrides
 * @param options - Force strategy or provide tool results for micro compression
 */
export async function compressMessages(
  messages: Array<{ role: string; content: string }>,
  config?: Partial<CompressionConfig>,
  options?: {
    force?: CompressionType;
    lastToolResults?: Array<{ name: string; args: Record<string, unknown> }>;
  },
): Promise<CompressionResult> {
  const resolvedConfig: CompressionConfig = {
    ...DEFAULT_COMPRESSION_CONFIG,
    ...config,
    historyBudget:
      (config?.maxContextTokens ?? DEFAULT_COMPRESSION_CONFIG.maxContextTokens) -
      (config?.systemPromptTokens ?? DEFAULT_COMPRESSION_CONFIG.systemPromptTokens) -
      (config?.responseTokens ?? DEFAULT_COMPRESSION_CONFIG.responseTokens),
  };

  const totalTokens = estimateMessagesTokens(messages);
  const force = options?.force;
  const toolResults = options?.lastToolResults || [];

  // Step 1: Apply micro compression if tool results provided
  let workingMessages: Array<{ role: string; content: string }> = messages;
  let microResult: CompressionResult | null = null;

  if (toolResults.length > 0 && !force) {
    const microMessages = microCompress(messages, toolResults);
    const microTokens = estimateMessagesTokens(microMessages);
    const microCompressedCount = microMessages.filter((m) => m.isCompressed).length;

    if (microCompressedCount > 0) {
      microResult = {
        messages: microMessages,
        originalTotalTokens: totalTokens,
        compressedTotalTokens: microTokens,
        ratio: microTokens / totalTokens || 1,
        strategy: 'micro',
        compressedCount: microCompressedCount,
        timestamp: new Date().toISOString(),
      };

      // If micro compression brought us under threshold, we're done
      if (microTokens < resolvedConfig.autoThresholdTokens) {
        return microResult;
      }

      // Otherwise, continue with micro-compressed messages
      workingMessages = microMessages;
    }
  }

  // Step 2: Check if further compression is needed
  const workingTokens = estimateMessagesTokens(workingMessages);

  // Emergency: tokens way over budget (>90% of context window)
  if (force === 'responsive' || workingTokens > resolvedConfig.maxContextTokens * 0.9) {
    console.log(
      `[compression] Emergency responsive compression: ${workingTokens} tokens → max ${resolvedConfig.maxContextTokens}`,
    );
    return responsiveCompress(workingMessages, resolvedConfig.maxContextTokens);
  }

  // Slightly over: use snip (fast, no API call)
  if (force === 'snip' || workingTokens > resolvedConfig.historyBudget) {
    console.log(
      `[compression] Snip compression: ${workingTokens} tokens > history budget ${resolvedConfig.historyBudget}`,
    );
    return snipCompress(workingMessages, resolvedConfig);
  }

  // Significantly over threshold: use auto (AI-powered)
  if (force === 'auto' || workingTokens > resolvedConfig.autoThresholdTokens) {
    console.log(
      `[compression] Auto compression: ${workingTokens} tokens > threshold ${resolvedConfig.autoThresholdTokens}`,
    );
    return autoCompress(workingMessages, resolvedConfig);
  }

  // No compression needed — return micro result if micro compression happened
  if (microResult) {
    return microResult;
  }

  // No compression at all
  return {
    messages: workingMessages.map((msg) => ({
      role: msg.role as CompressionResult['messages'][number]['role'],
      content: msg.content,
      isCompressed: false,
    })),
    originalTotalTokens: totalTokens,
    compressedTotalTokens: workingTokens,
    ratio: 1,
    strategy: 'snip', // Default strategy label when no compression happens
    compressedCount: 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Quick check: does the conversation need compression?
 * Returns true if total tokens exceed the auto threshold.
 */
export function needsCompression(
  messages: Array<{ role: string; content: string }>,
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): boolean {
  const totalTokens = estimateMessagesTokens(messages);
  return totalTokens > config.autoThresholdTokens;
}

// ────────────────────────────────────────────
// Re-exports
// ────────────────────────────────────────────

export { estimateTokens, estimateMessagesTokens } from './token-counter';
export { snipCompress } from './snip';
export { autoCompress } from './auto';
export { responsiveCompress } from './responsive';
export { microCompress } from './micro';
export type { CompressionType, CompressedMessage, CompressionResult, CompressionConfig } from './types';
