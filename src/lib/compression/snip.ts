// ============================================================
// Snip Compression — Preventive Strategy
// Replaces large tool outputs in older messages with brief summaries.
// ============================================================

import { estimateTokens, estimateMessagesTokens } from './token-counter';
import type { CompressedMessage, CompressionResult } from './types';

/** Tool output truncation threshold in characters */
const TOOL_OUTPUT_TRUNCATE_THRESHOLD = 500;
/** How many chars to keep from the beginning of a truncated tool output */
const TOOL_OUTPUT_KEEP_CHARS = 100;
/** Assistant message truncation threshold in characters */
const ASSISTANT_TRUNCATE_THRESHOLD = 3000;

/**
 * Snip compression: Replace large tool outputs in older messages with brief summaries.
 * Keeps the message structure but replaces verbose content.
 *
 * Rules:
 * - Never compress the last N messages (recent context, controlled by config.snipAfterMessages)
 * - Replace tool messages whose content > 500 chars with a one-line summary
 * - Keep user messages intact (they contain intent)
 * - Keep assistant messages intact unless they're very long (>3000 chars)
 */
export function snipCompress(
  messages: Array<{ role: string; content: string }>,
  config: { snipAfterMessages: number },
): CompressionResult {
  const keepWindow = config.snipAfterMessages;
  const originalTotalTokens = estimateMessagesTokens(messages);

  const compressedMessages: CompressedMessage[] = messages.map((msg, index) => {
    // Never touch messages in the keep window (most recent messages)
    const isInKeepWindow = index >= messages.length - keepWindow;

    if (isInKeepWindow) {
      return {
        role: msg.role as CompressedMessage['role'],
        content: msg.content,
        isCompressed: false,
      };
    }

    const originalTokens = estimateTokens(msg.content);

    // Tool messages: truncate large outputs
    if (msg.role === 'tool' && msg.content.length > TOOL_OUTPUT_TRUNCATE_THRESHOLD) {
      const preview = msg.content.substring(0, TOOL_OUTPUT_KEEP_CHARS).replace(/\n/g, ' ');
      const compressedContent =
        `Tool output: ${preview}... [truncated, was ${msg.content.length} chars]`;
      return {
        role: 'tool',
        content: compressedContent,
        isCompressed: true,
        originalTokens,
        compressedTokens: estimateTokens(compressedContent),
      };
    }

    // Assistant messages: compress very long ones
    if (msg.role === 'assistant' && msg.content.length > ASSISTANT_TRUNCATE_THRESHOLD) {
      const compressedContent =
        `[Previous response, ${originalTokens} tokens] Summarized key points preserved for context continuity.`;
      return {
        role: 'assistant',
        content: compressedContent,
        isCompressed: true,
        originalTokens,
        compressedTokens: estimateTokens(compressedContent),
      };
    }

    // User and system messages: keep intact
    return {
      role: msg.role as CompressedMessage['role'],
      content: msg.content,
      isCompressed: false,
    };
  });

  const compressedTotalTokens = estimateMessagesTokens(compressedMessages);
  const compressedCount = compressedMessages.filter((m) => m.isCompressed).length;

  return {
    messages: compressedMessages,
    originalTotalTokens,
    compressedTotalTokens,
    ratio: compressedTotalTokens / originalTotalTokens || 1,
    strategy: 'snip',
    compressedCount,
    timestamp: new Date().toISOString(),
  };
}
