// ============================================================
// Responsive Compression — Emergency Truncation
// Aggressively removes oldest messages when context is too large.
// ============================================================

import { estimateTokens, estimateMessagesTokens } from './token-counter';
import type { CompressedMessage, CompressionResult } from './types';

/**
 * Responsive compression: Aggressively truncate when we get a prompt-too-long error.
 *
 * Strategy:
 * 1. Remove oldest messages until we're under the token limit
 * 2. If still too long after removing all removable messages, truncate remaining
 * 3. Always keep system prompts and the last user message
 */
export function responsiveCompress(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): CompressionResult {
  const originalTotalTokens = estimateMessagesTokens(messages);

  // If already under budget, return as-is
  if (originalTotalTokens <= maxTokens) {
    return {
      messages: messages.map((msg) => ({
        role: msg.role as CompressedMessage['role'],
        content: msg.content,
        isCompressed: false,
      })),
      originalTotalTokens,
      compressedTotalTokens: originalTotalTokens,
      ratio: 1,
      strategy: 'responsive',
      compressedCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Separate system messages, find last user message, and removable messages
  const systemMessages: Array<{ role: string; content: string; index: number }> = [];
  let lastUserIndex = -1;
  const removableIndices: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'system') {
      systemMessages.push({ ...messages[i], index: i });
    } else if (messages[i].role === 'user') {
      lastUserIndex = i;
      removableIndices.push(i);
    } else {
      removableIndices.push(i);
    }
  }

  // Build the essential messages: all system + last user message
  const essentialIndices = new Set([
    ...systemMessages.map((m) => m.index),
    lastUserIndex,
  ].filter((i) => i >= 0));

  // Calculate tokens used by essential messages
  let essentialTokens = 0;
  for (const idx of essentialIndices) {
    essentialTokens += estimateTokens(messages[idx].content);
  }

  // Calculate budget for removable messages
  const removableBudget = Math.max(0, maxTokens - essentialTokens);

  // Walk backwards through removable messages (keep newest) until we fit the budget
  const keptRemovableIndices: number[] = [];
  let removableTokens = 0;

  for (let i = removableIndices.length - 1; i >= 0; i--) {
    const idx = removableIndices[i];
    const msgTokens = estimateTokens(messages[idx].content);

    if (removableTokens + msgTokens <= removableBudget) {
      keptRemovableIndices.unshift(idx);
      removableTokens += msgTokens;
    }
    // else: this message is dropped (removed from context)
  }

  // Combine: essential messages + kept removable messages
  const allKeptIndices = new Set([
    ...essentialIndices,
    ...keptRemovableIndices,
  ]);

  const compressedMessages: CompressedMessage[] = messages
    .filter((_, idx) => allKeptIndices.has(idx))
    .map((msg) => ({
      role: msg.role as CompressedMessage['role'],
      content: msg.content,
      isCompressed: false,
    }));

  // If still over budget (extreme case), truncate the longest non-system messages
  let finalTokens = estimateMessagesTokens(compressedMessages);
  if (finalTokens > maxTokens) {
    const nonSystem = compressedMessages.filter((m) => m.role !== 'system');
    const systemMsgs = compressedMessages.filter((m) => m.role === 'system');
    let systemTokens = estimateMessagesTokens(systemMsgs);
    const remainingBudget = maxTokens - systemTokens;

    // Sort non-system messages by length (longest first) for truncation
    const sorted = [...nonSystem].sort(
      (a, b) => b.content.length - a.content.length,
    );

    let currentTokens = estimateMessagesTokens(sorted);
    for (const msg of sorted) {
      if (currentTokens <= remainingBudget) break;
      const msgTokens = estimateTokens(msg.content);
      // Truncate to a fraction
      const keepRatio = Math.max(0.1, remainingBudget / currentTokens);
      const maxChars = Math.floor(msg.content.length * keepRatio);
      msg.content = msg.content.substring(0, maxChars) + '... [truncated]';
      msg.isCompressed = true;
      currentTokens = estimateMessagesTokens(sorted);
    }

    // Reconstruct with system messages first
    compressedMessages.length = 0;
    compressedMessages.push(...systemMsgs, ...sorted);
    finalTokens = estimateMessagesTokens(compressedMessages);
  }

  const compressedCount = messages.length - compressedMessages.length;
  const compressedTotalTokens = estimateMessagesTokens(compressedMessages);

  return {
    messages: compressedMessages,
    originalTotalTokens,
    compressedTotalTokens,
    ratio: compressedTotalTokens / originalTotalTokens || 1,
    strategy: 'responsive',
    compressedCount,
    timestamp: new Date().toISOString(),
  };
}
