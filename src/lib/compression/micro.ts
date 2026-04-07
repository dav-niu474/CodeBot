// ============================================================
// Micro Compression — Context-aware Compression
// Optimizes context by removing superseded information.
// ============================================================

import { estimateTokens } from './token-counter';
import type { CompressedMessage } from './types';

/** Max chars for a broad glob/grep result before summarization */
const SEARCH_RESULT_THRESHOLD = 2000;
/** Max chars to keep from a search result summary */
const SEARCH_SUMMARY_MAX_CHARS = 300;

/**
 * Micro compression: Context-aware optimization that removes superseded information.
 *
 * Rules:
 * 1. After a file-edit tool result, check if there's a previous file-read for the
 *    same file and mark it for compression (since the edit supersedes the old read).
 * 2. After a glob/grep result, if the pattern is very broad (large output),
 *    summarize the results to keep only the most relevant entries.
 */
export function microCompress(
  messages: Array<{ role: string; content: string }>,
  lastToolResults: Array<{ name: string; args: Record<string, unknown> }>,
): CompressedMessage[] {
  if (messages.length === 0) return [];

  const result = messages.map((msg) => ({
    role: msg.role as CompressedMessage['role'],
    content: msg.content,
    isCompressed: false,
  }));

  // Apply file-edit → file-read deduplication
  applyFileEditDedup(result, lastToolResults);

  // Apply search result summarization for broad patterns
  applySearchResultSummarization(result, lastToolResults);

  return result;
}

// ────────────────────────────────────────────
// Internal: File edit deduplication
// ────────────────────────────────────────────

function applyFileEditDedup(
  messages: CompressedMessage[],
  lastToolResults: Array<{ name: string; args: Record<string, unknown> }>,
): void {
  // Check if the last tool was a file-edit
  const lastFileEdit = lastToolResults.find(
    (t) => t.name === 'file-edit' || t.name === 'file_write',
  );

  if (!lastFileEdit) return;

  const editedPath = String(lastFileEdit.args.path || lastFileEdit.args.file_path || '');

  if (!editedPath) return;

  // Find and compress prior file-reads for the same path
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role !== 'tool') continue;
    if (msg.isCompressed) continue;

    // Check if this tool message contains a file-read for the same path
    if (msg.content.includes(editedPath) && msg.content.length > 200) {
      // Check if it looks like a file-read result (contains line numbers or file content)
      const isLikelyFileRead =
        /^\s*\d+\s*[→|┃]/.test(msg.content) || // Line number format from our executor
        msg.content.includes('==') || // Separator lines from file output
        (msg.content.split('\n').length > 5); // Multi-line file content

      if (isLikelyFileRead) {
        const originalTokens = estimateTokens(msg.content);
        const preview = msg.content
          .substring(0, 150)
          .replace(/\n/g, ' ')
          .trim();

        msg.content =
          `[File read of "${editedPath}" — superseded by edit] ${preview}... [compressed, was ${originalTokens} tokens]`;
        msg.isCompressed = true;
        msg.originalTokens = originalTokens;
        msg.compressedTokens = estimateTokens(msg.content);
      }
    }
  }
}

// ────────────────────────────────────────────
// Internal: Search result summarization
// ────────────────────────────────────────────

function applySearchResultSummarization(
  messages: CompressedMessage[],
  lastToolResults: Array<{ name: string; args: Record<string, unknown> }>,
): void {
  // Check if the last tool was a glob or grep with broad results
  const lastSearch = lastToolResults.find(
    (t) => t.name === 'glob' || t.name === 'grep',
  );

  if (!lastSearch) return;

  // Find the corresponding tool result message (second-to-last tool message)
  // Tool results come after assistant messages with tool calls
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (msg.role !== 'tool' || msg.isCompressed) continue;

    // Check if this tool message is a large search result
    if (msg.content.length > SEARCH_RESULT_THRESHOLD) {
      const originalTokens = estimateTokens(msg.content);
      const pattern = String(lastSearch.args.pattern || lastSearch.args.query || 'search');

      // Extract first N lines and last N lines as a summary
      const lines = msg.content.split('\n');
      const headLines = lines.slice(0, 10);
      const tailLines = lines.slice(-5);

      const summary =
        `[Search result for "${pattern}" — compressed from ${lines.length} lines]\n` +
        `First matches:\n${headLines.join('\n')}\n` +
        (tailLines.length > 0 ? `\n... [${lines.length - 15} lines omitted]\nLast entries:\n${tailLines.join('\n')}` : '');

      const truncatedSummary =
        summary.length > SEARCH_SUMMARY_MAX_CHARS
          ? summary.substring(0, SEARCH_SUMMARY_MAX_CHARS) +
            `\n... [summary truncated]`
          : summary;

      msg.content = truncatedSummary;
      msg.isCompressed = true;
      msg.originalTokens = originalTokens;
      msg.compressedTokens = estimateTokens(truncatedSummary);

      // Only compress the most recent search result
      break;
    }
  }
}
