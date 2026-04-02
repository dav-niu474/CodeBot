// ============================================================
// Auto Compression — Threshold-triggered AI Summarization
// Uses NVIDIA API to intelligently summarize old messages.
// ============================================================

import { estimateTokens, estimateMessagesTokens } from './token-counter';
import type { CompressedMessage, CompressionConfig, CompressionResult } from './types';
import { chatCompletion } from '@/lib/nvidia';

/** Prompt for AI-based summarization */
const SUMMARIZE_PROMPT = `Summarize the following conversation context, preserving key facts, decisions, user preferences, and any important code or technical details. Be concise but comprehensive. Keep all file paths, function names, and specific values. Output only the summary, no preamble.`;

/** Fallback model for summarization (fast and cheap) */
const SUMMARIZE_MODEL = 'meta/llama-3.1-8b-instruct';

/**
 * Auto compression: When token count exceeds threshold, use AI to summarize old messages.
 *
 * Strategy:
 * 1. Calculate total history tokens
 * 2. If under threshold, return messages unchanged
 * 3. If over threshold, identify oldest messages that can be compressed
 * 4. Group them into batches and ask AI to summarize each batch
 * 5. Replace the batch with a single "system" summary message
 * 6. Always preserve the most recent messages (keep window = config.maxCompressBatch)
 *
 * IMPORTANT: If the API call fails, falls back to snip-style truncation.
 */
export async function autoCompress(
  messages: Array<{ role: string; content: string }>,
  config: CompressionConfig,
): Promise<CompressionResult> {
  const totalTokens = estimateMessagesTokens(messages);
  const originalTotalTokens = totalTokens;

  // If under threshold, no compression needed
  if (totalTokens < config.autoThresholdTokens) {
    return {
      messages: messages.map((msg) => ({
        role: msg.role as CompressedMessage['role'],
        content: msg.content,
        isCompressed: false,
      })),
      originalTotalTokens,
      compressedTotalTokens: totalTokens,
      ratio: 1,
      strategy: 'auto',
      compressedCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Determine how many tokens we need to remove
  const targetTokens = Math.floor(totalTokens * config.autoTargetRatio);
  const tokensToRemove = totalTokens - targetTokens;

  // Find the split point: how many oldest messages to compress
  const keepWindow = config.maxCompressBatch;
  const compressibleMessages = messages.slice(0, Math.max(0, messages.length - keepWindow));

  // If not enough messages to compress, return as-is
  if (compressibleMessages.length < config.minMessagesForCompression) {
    return {
      messages: messages.map((msg) => ({
        role: msg.role as CompressedMessage['role'],
        content: msg.content,
        isCompressed: false,
      })),
      originalTotalTokens,
      compressedTotalTokens: totalTokens,
      ratio: 1,
      strategy: 'auto',
      compressedCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Calculate how many oldest messages to summarize to meet the target
  let cumulativeTokens = 0;
  let splitIndex = 0;
  for (let i = 0; i < compressibleMessages.length; i++) {
    cumulativeTokens += estimateTokens(compressibleMessages[i].content);
    if (cumulativeTokens >= tokensToRemove) {
      splitIndex = i + 1;
      break;
    }
  }
  // If we couldn't find enough tokens, compress all compressible messages
  if (splitIndex === 0) {
    splitIndex = compressibleMessages.length;
  }

  const toCompress = compressibleMessages.slice(0, splitIndex);
  const toKeep = [
    ...compressibleMessages.slice(splitIndex),
    ...messages.slice(Math.max(0, messages.length - keepWindow)),
  ];

  // Try AI summarization
  let summaryContent: string | null = null;

  try {
    summaryContent = await summarizeMessages(toCompress);
  } catch (err) {
    // Fallback: simple truncation summary
    console.warn('[compression:auto] AI summarization failed, using fallback:', err);
    const fallbackTokens = estimateMessagesTokens(toCompress);
    const kept = toCompress.filter(
      (m) => m.role === 'user' || m.role === 'system'
    );
    const userMessages = kept
      .map((m) => `[${m.role}]: ${m.content.substring(0, 200)}`)
      .join('\n');
    summaryContent =
      `[Compressed context, ${fallbackTokens} tokens → fallback summary]\n` +
      `Key user messages preserved:\n${userMessages}\n` +
      `[${toCompress.length - kept.length} messages compressed]`;
  }

  // Build the summary system message
  const summaryMessage: CompressedMessage = {
    role: 'system',
    content:
      `[Conversation Summary — ${toCompress.length} earlier messages compressed]\n\n` +
      summaryContent,
    isCompressed: true,
    originalTokens: estimateMessagesTokens(toCompress),
    compressedTokens: estimateTokens(summaryContent || ''),
  };

  // Combine: summary + kept messages
  const compressedMessages: CompressedMessage[] = [
    summaryMessage,
    ...toKeep.map((msg) => ({
      role: msg.role as CompressedMessage['role'],
      content: msg.content,
      isCompressed: false,
    })),
  ];

  const compressedTotalTokens = estimateMessagesTokens(compressedMessages);
  const compressedCount = toCompress.length;

  return {
    messages: compressedMessages,
    originalTotalTokens,
    compressedTotalTokens,
    ratio: compressedTotalTokens / originalTotalTokens || 1,
    strategy: 'auto',
    compressedCount,
    timestamp: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────
// Internal: Summarize messages via NVIDIA API
// ────────────────────────────────────────────

async function summarizeMessages(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  // Format messages for the summarizer
  const conversationText = messages
    .map((m) => `[${m.role}]: ${m.content.substring(0, 2000)}`)
    .join('\n\n');

  const response = await chatCompletion({
    model: SUMMARIZE_MODEL,
    messages: [
      { role: 'system', content: SUMMARIZE_PROMPT },
      { role: 'user', content: conversationText },
    ],
    temperature: 0.3,
    maxTokens: 1024,
  });

  const content = response.choices[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty summarization response');
  }

  return content.trim();
}
