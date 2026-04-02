// ============================================================
// Token Compression — Type Definitions
// V3.5.0: 4 compression strategies (snip/auto/responsive/micro)
// ============================================================

/** Compression strategy type */
export type CompressionType = 'snip' | 'auto' | 'responsive' | 'micro';

/** A message that has been processed for compression */
export interface CompressedMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** True if this message's content was compressed/summarized */
  isCompressed: boolean;
  /** Original token count before compression */
  originalTokens?: number;
  /** Token count after compression */
  compressedTokens?: number;
}

/** Result of a compression operation */
export interface CompressionResult {
  messages: CompressedMessage[];
  /** Total tokens before compression */
  originalTotalTokens: number;
  /** Total tokens after compression */
  compressedTotalTokens: number;
  /** Compression ratio (0-1), where lower means more aggressive */
  ratio: number;
  /** Strategy used */
  strategy: CompressionType;
  /** How many messages were compressed */
  compressedCount: number;
  /** Timestamp of compression */
  timestamp: string;
}

/** Configuration for compression */
export interface CompressionConfig {
  /** Maximum tokens for the context window */
  maxContextTokens: number;
  /** Tokens reserved for system prompt */
  systemPromptTokens: number;
  /** Tokens reserved for new user message + response */
  responseTokens: number;
  /** Effective token budget for conversation history */
  historyBudget: number;
  /** Snip: replace tool outputs older than N messages with summaries */
  snipAfterMessages: number;
  /** Auto: trigger compression when history exceeds threshold */
  autoThresholdTokens: number;
  /** Target compression ratio for auto mode (0-1) */
  autoTargetRatio: number;
  /** Max messages to compress at once */
  maxCompressBatch: number;
  /** Minimum messages before compression is considered */
  minMessagesForCompression: number;
}
